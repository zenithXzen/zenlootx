import { sendPushToUser } from './push-helper.js';
import { getUserInfo, sendEmail, wrap } from './email-helper.js';

async function verifyUser(token, env) {
  try {
    const res  = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function sb(env, path, opts = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      Authorization:  `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey:         env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer:         'return=representation',
      ...(opts.headers || {}),
    },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const user  = await verifyUser(token, env);
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { orderId, reason } = await request.json();
    if (!orderId || !reason?.trim()) {
      return Response.json({ error: 'Missing orderId or reason' }, { status: 400 });
    }

    // Verify the order exists and belongs to this user
    const orderRes  = await sb(env, `orders?id=eq.${orderId}&select=id,buyer_id,seller_id,escrow_status,amount`, { method: 'GET', headers: { Prefer: '' } });
    const orderData = await orderRes.json();
    const order     = orderData[0];

    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (!order.amount || Number(order.amount) <= 0) {
      return Response.json({ error: 'Order has no valid amount and cannot be disputed.' }, { status: 400 });
    }
    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (order.escrow_status === 'disputed') {
      return Response.json({ error: 'A dispute is already open for this order' }, { status: 409 });
    }
    if (order.escrow_status === 'refunded' || order.escrow_status === 'cancelled') {
      return Response.json({ error: 'This order has already been refunded and cannot be disputed' }, { status: 409 });
    }

    // Insert the dispute — include amount so resolve-dispute can refund correctly
    const dispRes  = await sb(env, 'disputes', {
      method: 'POST',
      body: JSON.stringify({
        order_id:  orderId,
        filed_by:  user.id,
        buyer_id:  order.buyer_id,
        seller_id: order.seller_id,
        amount:    order.amount,
        reason:    reason.trim(),
        status:    'open',
      }),
    });

    if (!dispRes.ok) {
      const err = await dispRes.json().catch(() => ({}));
      return Response.json({ error: err.message || 'Failed to file dispute' }, { status: 400 });
    }

    // Mark the order as disputed (service key — safe)
    await sb(env, `orders?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ escrow_status: 'disputed' }),
    });

    // Push notifications to both parties
    const otherId = user.id === order.buyer_id ? order.seller_id : order.buyer_id;
    sendPushToUser(otherId, env, {
      title: '⚠️ A dispute has been opened',
      body:  'A dispute was filed on one of your orders. Our team will review it shortly.',
      url:   '/orders',
    }).catch(() => {});
    sendPushToUser(user.id, env, {
      title: '📋 Dispute submitted',
      body:  'Your dispute has been filed. We\'ll review it and respond within 24 hours.',
      url:   '/orders',
    }).catch(() => {});

    // Email both parties
    const filerId = user.id;

    Promise.all([
      getUserInfo(filerId, env),
      getUserInfo(otherId, env),
    ]).then(([filer, other]) => {
      const disputeUrl = 'https://zenlootexchange.com/orders';

      // Email to the person who filed — confirmation
      if (filer.email) {
        sendEmail(env, {
          to:      filer.email,
          subject: '📋 Your dispute has been submitted — ZenLootX',
          html: wrap(`
            <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">Dispute submitted</h2>
            <p style="font-size:15px;color:#9BA8A0;line-height:1.7;margin-bottom:16px;">
              Hi <strong style="color:#E8EDE9;">${filer.name}</strong>, we've received your dispute. Our team will review both sides and respond within 24–48 hours.
            </p>
            <div style="background:#121814;border:1px solid #232B26;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <div style="font-size:13px;color:#6B776F;margin-bottom:6px;">Reason submitted</div>
              <div style="font-size:14px;color:#E8EDE9;line-height:1.6;">${reason.trim()}</div>
            </div>
            <p style="font-size:14px;color:#9BA8A0;line-height:1.7;">Do not release payment or take any action on this order while the dispute is under review.</p>
            <a href="${disputeUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#19C37D;color:#0A0E0C;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px;">View Order →</a>`),
        }).catch(() => {});
      }

      // Email to the other party — heads-up
      if (other.email) {
        sendEmail(env, {
          to:      other.email,
          subject: '⚠️ A dispute has been opened on your order — ZenLootX',
          html: wrap(`
            <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">A dispute was opened ⚠️</h2>
            <p style="font-size:15px;color:#9BA8A0;line-height:1.7;margin-bottom:16px;">
              Hi <strong style="color:#E8EDE9;">${other.name}</strong>, the other party has filed a dispute on one of your orders. Our team will review the case and reach out if more information is needed.
            </p>
            <p style="font-size:14px;color:#9BA8A0;line-height:1.7;">Please do not take any action on this order while it is under review. We aim to resolve all disputes within 24–48 hours.</p>
            <a href="${disputeUrl}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#EF4444;color:#fff;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px;">View Order →</a>`),
        }).catch(() => {});
      }
    }).catch(() => {});

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
