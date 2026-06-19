import { verifyAdmin, logAdminAction, notify, sb, incrementBalance } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const admin = await verifyAdmin(token, env);
    if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

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
    const oRes  = await sb(env, `orders?id=eq.${orderId}&select=escrow_status,amount,listing_id`, { method: 'GET', headers: { Prefer: '' } });
    const oData = await oRes.json();
    const order = oData[0];

    const feeAmount   = Math.round(amount * 5) / 100;
    const netAmount   = amount - feeAmount;
    const fmt         = n => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

    // Filing a dispute always overwrites orders.escrow_status to 'disputed', even if the
    // order had already been released — so by resolution time, escrow_status can no longer
    // tell us whether the seller was actually paid. Check the transactions ledger instead,
    // which records the real credit if release-payment.js (or a prior dispute resolution) ran.
    const txRes  = await sb(env, `transactions?reference=eq.${orderId}&user_id=eq.${sellerId}&type=eq.credit&select=id`, { method: 'GET', headers: { Prefer: '' } });
    const txData = await txRes.json();
    const wasReleased = Array.isArray(txData) && txData.length > 0;

    if (action === 'refund_buyer') {
      // Buyer always gets back the full price they paid
      await sb(env, 'wallets', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: buyerId, balance: 0, escrow: 0, total_earned: 0 }),
      });
      await incrementBalance(env, buyerId, amount);

      // Seller: claw back only what they actually received.
      // If the order was never released, their spendable balance was never touched at
      // purchase time (only the escrow stat was) — so only escrow needs reversing.
      // If it was already released, the netAmount credited to balance/total_earned must be reversed too.
      if (wasReleased) {
        await incrementBalance(env, sellerId, -netAmount);
        const statsRes  = await sb(env, `wallets?user_id=eq.${sellerId}&select=total_earned`, { method: 'GET', headers: { Prefer: '' } });
        const statsData = await statsRes.json();
        const totalEarned = Number(statsData[0]?.total_earned || 0);
        await sb(env, `wallets?user_id=eq.${sellerId}`, {
          method: 'PATCH',
          body: JSON.stringify({ total_earned: Math.max(0, totalEarned - netAmount) }),
        });
      } else {
        const escRes  = await sb(env, `wallets?user_id=eq.${sellerId}&select=escrow`, { method: 'GET', headers: { Prefer: '' } });
        const escData = await escRes.json();
        const escrow  = Number(escData[0]?.escrow || 0);
        await sb(env, `wallets?user_id=eq.${sellerId}`, {
          method: 'PATCH',
          body: JSON.stringify({ escrow: Math.max(0, escrow - netAmount) }),
        });
      }

      // Mark order refunded
      await sb(env, `orders?id=eq.${orderId}`, { method: 'PATCH', body: JSON.stringify({ escrow_status: 'refunded' }) });
      // Log refund credit for buyer
      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ user_id: buyerId, type: 'refund', amount, description: 'Dispute resolved — refunded', reference: orderId, status: 'completed' }),
      });
      // Log deduction debit for seller only if their spendable balance actually decreased
      if (wasReleased) {
        await fetch(`${env.SUPABASE_URL}/rest/v1/transactions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ user_id: sellerId, type: 'debit', amount: netAmount, description: 'Dispute penalty — refund deducted from balance', reference: orderId, status: 'completed' }),
        });
      }
      await notify(env, buyerId, '✅ Dispute resolved — refund issued', `Your dispute was reviewed. ${fmt(amount)} has been refunded to your wallet.`, '/wallet');
      await notify(env, sellerId, 'Dispute resolved', wasReleased
        ? `A dispute was resolved in the buyer's favour. ${fmt(netAmount)} has been deducted from your balance.`
        : `A dispute was resolved in the buyer's favour. The order has been refunded.`, '/wallet');

    } else {
      // Release to seller — skip if already released, to avoid double-crediting
      if (!wasReleased) {
        await sb(env, 'wallets', {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify({ user_id: sellerId, balance: 0, escrow: 0, total_earned: 0 }),
        });
        await incrementBalance(env, sellerId, netAmount);

        const statsRes  = await sb(env, `wallets?user_id=eq.${sellerId}&select=total_earned,escrow`, { method: 'GET', headers: { Prefer: '' } });
        const statsData = await statsRes.json();
        const stats = statsData[0] || { total_earned: 0, escrow: 0 };
        await sb(env, `wallets?user_id=eq.${sellerId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            total_earned: Number(stats.total_earned || 0) + netAmount,
            escrow:       Math.max(0, Number(stats.escrow || 0) - netAmount),
          }),
        });

        // Log platform earnings (matches the normal release flow)
        fetch(`${env.SUPABASE_URL}/rest/v1/platform_earnings`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ order_id: orderId, listing_id: order?.listing_id || null, seller_id: sellerId, gross_amount: amount, fee_percent: 5, fee_amount: feeAmount, net_amount: netAmount }),
        }).catch(() => {});

        await fetch(`${env.SUPABASE_URL}/rest/v1/transactions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ user_id: sellerId, type: 'credit', amount: netAmount, description: 'Dispute resolved — payment released', reference: orderId, status: 'completed' }),
        });
      }
      await sb(env, `orders?id=eq.${orderId}`, { method: 'PATCH', body: JSON.stringify({ escrow_status: 'released' }) });
      await notify(env, sellerId, '💸 Dispute resolved — payment released', `Your dispute was reviewed. ${fmt(netAmount)} has been released to your wallet (after 5% platform fee).`, '/wallet');
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

    await logAdminAction(env, admin.id, action === 'refund_buyer' ? 'dispute_refund' : 'dispute_release', disputeId, 'dispute', { orderId, buyerId, sellerId, amount, notes: notes || null });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
