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

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
