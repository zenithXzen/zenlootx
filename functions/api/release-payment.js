import { sendPushToUser } from './push-helper.js';
import { getUserInfo, sendEmail, wrap } from './email-helper.js';

export async function onRequestPost({ request, env }) {
  try {
    // Verify auth
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { orderId } = await request.json();
    if (!orderId) return Response.json({ error: 'Missing orderId' }, { status: 400 });

    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    // Get order — verify caller is the buyer and escrow is still holding
    const oRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}&select=*`, { headers: hdr });
    const oData = await oRes.json();
    const order = oData[0];

    if (!order)                          return Response.json({ error: 'Order not found.' }, { status: 404 });
    if (order.buyer_id !== user.id)      return Response.json({ error: 'Only the buyer can release payment.' }, { status: 403 });
    if (order.escrow_status === 'released') return Response.json({ error: 'Payment already released.' }, { status: 409 });
    if (order.escrow_status !== 'holding')  return Response.json({ error: 'Order is not in escrow.' }, { status: 400 });

    const amount = Number(order.amount);

    // Credit seller wallet
    const wRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/wallets?user_id=eq.${order.seller_id}&select=balance,total_earned,escrow`, { headers: hdr });
    const wData = await wRes.json();
    const wallet = wData[0];

    if (wallet) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/wallets?user_id=eq.${order.seller_id}`, {
        method: 'PATCH', headers: { ...hdr, Prefer: 'return=minimal' },
        body: JSON.stringify({
          balance:      Number(wallet.balance) + amount,
          total_earned: Number(wallet.total_earned) + amount,
          escrow:       Math.max(0, Number(wallet.escrow || 0) - amount),
        }),
      });
    } else {
      // Create wallet for seller if missing
      await fetch(`${env.SUPABASE_URL}/rest/v1/wallets`, {
        method: 'POST', headers: { ...hdr, Prefer: 'return=minimal' },
        body: JSON.stringify({ user_id: order.seller_id, balance: amount, total_earned: amount, escrow: 0 }),
      });
    }

    // Mark order as released + completed
    await fetch(`${env.SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
      method: 'PATCH', headers: { ...hdr, Prefer: 'return=minimal' },
      body: JSON.stringify({ escrow_status: 'released' }),
    });

    // Log transactions
    try {
      const listRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${order.listing_id}&select=title`, { headers: hdr });
      const listData = await listRes.json();
      const title    = listData[0]?.title || 'Listing';

      // Update buyer's escrow transaction to completed
      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions?reference=eq.${orderId}&user_id=eq.${order.buyer_id}`, {
        method: 'PATCH',
        headers: { ...hdr, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'completed', description: `Purchase completed: ${title}` }),
      });
      // Upgrade seller's escrow transaction to credit (turns green with + instead of creating a duplicate)
      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions?reference=eq.${orderId}&user_id=eq.${order.seller_id}&type=eq.escrow`, {
        method: 'PATCH',
        headers: { ...hdr, Prefer: 'return=minimal' },
        body: JSON.stringify({ type: 'credit', status: 'completed', description: `Sale completed: ${title}` }),
      });
    } catch {}

    // Notify seller
    try {
      const listRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${order.listing_id}&select=title`, { headers: hdr });
      const listData = await listRes.json();
      const title    = listData[0]?.title || 'Your listing';

      await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST', headers: { ...hdr, Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: order.seller_id,
          title:   '💸 Payment released!',
          message: `The buyer confirmed delivery of "${title}". ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been added to your wallet.`,
          type:    'listing',
          link:    '/wallet',
        }),
      });
    } catch {}

    // Push notification to seller
    sendPushToUser(order.seller_id, env, {
      title: '💸 Payment released!',
      body:  `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been added to your wallet.`,
      url:   '/wallet',
    }).catch(() => {});

    // Email notification to seller
    getUserInfo(order.seller_id, env).then(({ email, name }) => {
      if (!email) return;
      const fmt   = n => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
      const listRes = fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${order.listing_id}&select=title`, {
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY },
      }).then(r => r.json()).then(d => d[0]?.title || 'your listing').catch(() => 'your listing');
      return listRes.then(title => sendEmail(env, {
        to:      email,
        subject: `💸 Payment released — ${fmt(amount)} is in your wallet`,
        html: wrap(`
          <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">Payment released! 💸</h2>
          <p style="font-size:15px;color:#9BA8A0;line-height:1.7;margin-bottom:20px;">
            Hi <strong style="color:#E8EDE9;">${name}</strong>, the buyer has confirmed receipt of <strong style="color:#E8EDE9;">${title}</strong>.
          </p>
          <div style="background:#121814;border:1px solid #232B26;border-radius:10px;padding:20px 22px;margin-bottom:24px;">
            <div style="font-size:13px;color:#6B776F;margin-bottom:4px;">Amount credited to your wallet</div>
            <div style="font-size:26px;font-weight:700;color:#19C37D;">${fmt(amount)}</div>
          </div>
          <p style="font-size:14px;color:#9BA8A0;line-height:1.7;">You can withdraw your earnings from your wallet at any time.</p>
          <a href="https://zenlootexchange.com/wallet" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#19C37D;color:#0A0E0C;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px;">View Wallet →</a>`),
      }));
    }).catch(() => {});

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
