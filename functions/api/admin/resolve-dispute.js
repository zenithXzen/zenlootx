async function verifyAdmin(token, env) {
  try {
    const res  = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return false;
    return (await res.json())?.app_metadata?.is_admin === true;
  } catch { return false; }
}

function sb(env, path, opts = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(opts.headers || {}),
    },
  });
}

async function notify(env, userId, title, message, link = '/orders') {
  await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ user_id: userId, title, message, type: 'general', link, read: false }),
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const isAdmin = await verifyAdmin(token, env);
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { disputeId, action, notes } = await request.json();
    if (!disputeId || !['refund_buyer', 'release_seller'].includes(action)) {
      return Response.json({ error: 'Missing or invalid fields' }, { status: 400 });
    }

    // Get dispute
    const dRes  = await sb(env, `disputes?id=eq.${disputeId}&select=*`, { method: 'GET', headers: { Prefer: '' } });
    const dData = await dRes.json();
    const dispute = dData[0];
    if (!dispute) return Response.json({ error: 'Dispute not found' }, { status: 404 });

    const orderId  = dispute.order_id;
    const buyerId  = dispute.buyer_id;
    const sellerId = dispute.seller_id;
    const amount   = Number(dispute.amount || 0);

    // Get order
    const oRes  = await sb(env, `orders?id=eq.${orderId}&select=escrow_status,amount`, { method: 'GET', headers: { Prefer: '' } });
    const oData = await oRes.json();
    const order = oData[0];

    if (action === 'refund_buyer') {
      // Return funds to buyer
      const wRes  = await sb(env, `wallets?user_id=eq.${buyerId}&select=balance`, { method: 'GET', headers: { Prefer: '' } });
      const wData = await wRes.json();
      const bal   = Number(wData[0]?.balance || 0);
      await sb(env, `wallets?user_id=eq.${buyerId}`, {
        method: 'PATCH',
        body: JSON.stringify({ balance: bal + amount }),
      });
      // Deduct from seller balance (covers both escrow and already-released orders)
      const swRes  = await sb(env, `wallets?user_id=eq.${sellerId}&select=balance,escrow`, { method: 'GET', headers: { Prefer: '' } });
      const swData = await swRes.json();
      const sellerBalance = Number(swData[0]?.balance || 0);
      const sellerEscrow  = Number(swData[0]?.escrow  || 0);
      await sb(env, `wallets?user_id=eq.${sellerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          balance: Math.max(0, sellerBalance - amount),
          escrow:  Math.max(0, sellerEscrow  - amount),
        }),
      });
      // Mark order refunded
      await sb(env, `orders?id=eq.${orderId}`, { method: 'PATCH', body: JSON.stringify({ escrow_status: 'refunded' }) });
      // Log refund credit for buyer
      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ user_id: buyerId, type: 'refund', amount, description: 'Dispute resolved — refunded', reference: orderId, status: 'completed' }),
      });
      // Log deduction debit for seller
      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ user_id: sellerId, type: 'debit', amount, description: 'Dispute penalty — refund deducted from balance', reference: orderId, status: 'completed' }),
      });
      await notify(env, buyerId, '✅ Dispute resolved — refund issued', `Your dispute was reviewed. ₱${amount.toLocaleString()} has been refunded to your wallet.`, '/wallet');
      await notify(env, sellerId, 'Dispute resolved', `A dispute was resolved in the buyer's favour. ₱${amount.toLocaleString()} has been deducted from your balance.`, '/wallet');

    } else {
      // Release to seller (same as normal release)
      const wRes  = await sb(env, `wallets?user_id=eq.${sellerId}&select=balance,total_earned,escrow`, { method: 'GET', headers: { Prefer: '' } });
      const wData = await wRes.json();
      const w     = wData[0];
      if (w) {
        await sb(env, `wallets?user_id=eq.${sellerId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            balance:      Number(w.balance) + amount,
            total_earned: Number(w.total_earned) + amount,
            escrow:       Math.max(0, Number(w.escrow || 0) - amount),
          }),
        });
      }
      await sb(env, `orders?id=eq.${orderId}`, { method: 'PATCH', body: JSON.stringify({ escrow_status: 'released' }) });
      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ user_id: sellerId, type: 'credit', amount, description: 'Dispute resolved — payment released', reference: orderId, status: 'completed' }),
      });
      await notify(env, sellerId, '💸 Dispute resolved — payment released', `Your dispute was reviewed. ₱${amount.toLocaleString()} has been released to your wallet.`, '/wallet');
      await notify(env, buyerId, 'Dispute resolved', `A dispute was resolved in the seller's favour. The payment has been released to the seller.`, '/orders');
    }

    // Mark dispute resolved
    await sb(env, `disputes?id=eq.${disputeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resolved', resolution: action, resolution_notes: notes || null, resolved_at: new Date().toISOString() }),
    });

    // Unfreeze both wallets
    await sb(env, `wallets?user_id=eq.${buyerId}`,  { method: 'PATCH', body: JSON.stringify({ frozen: false }) });
    await sb(env, `wallets?user_id=eq.${sellerId}`, { method: 'PATCH', body: JSON.stringify({ frozen: false }) });

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
