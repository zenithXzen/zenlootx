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

      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers: { ...hdr, Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id:     order.seller_id,
          type:        'credit',
          amount:      amount,
          description: `Sale completed: ${title}`,
          reference:   orderId,
          status:      'completed',
        }),
      });
      // Update buyer's escrow transaction to completed
      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions?reference=eq.${orderId}&user_id=eq.${order.buyer_id}`, {
        method: 'PATCH',
        headers: { ...hdr, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'completed', description: `Purchase completed: ${title}` }),
      });
      // Update seller's escrow transaction to completed (funds moved to balance)
      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions?reference=eq.${orderId}&user_id=eq.${order.seller_id}&type=eq.escrow`, {
        method: 'PATCH',
        headers: { ...hdr, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'completed', description: `Sale completed: ${title}` }),
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

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
