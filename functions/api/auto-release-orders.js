export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ released: 0 });
    const user = await userRes.json();
    if (!user?.id) return Response.json({ released: 0 });

    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    // Orders older than 72 hours still in holding (for this user as buyer or seller)
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const oRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/orders?or=(buyer_id.eq.${user.id},seller_id.eq.${user.id})&escrow_status=eq.holding&created_at=lt.${encodeURIComponent(cutoff)}&select=*`,
      { headers: hdr }
    );
    const orders = await oRes.json();
    if (!Array.isArray(orders) || !orders.length) return Response.json({ released: 0 });

    // Exclude any orders with an open dispute
    const dRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/disputes?status=eq.open&select=order_id`,
      { headers: hdr }
    );
    const disputes = await dRes.json();
    const disputed = new Set((Array.isArray(disputes) ? disputes : []).map(d => d.order_id));

    const toRelease = orders.filter(o => !disputed.has(o.id));
    if (!toRelease.length) return Response.json({ released: 0 });

    let released = 0;
    for (const order of toRelease) {
      try {
        const amount    = Number(order.amount);
        const feeAmount = Math.round(amount * 5) / 100;
        const netAmount = amount - feeAmount;

        // Credit seller wallet (net of 5% platform fee)
        const wRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/wallets?user_id=eq.${order.seller_id}&select=balance,total_earned,escrow`,
          { headers: hdr }
        );
        const wData = await wRes.json();
        const wallet = wData[0];

        if (wallet) {
          await fetch(`${env.SUPABASE_URL}/rest/v1/wallets?user_id=eq.${order.seller_id}`, {
            method: 'PATCH',
            headers: { ...hdr, Prefer: 'return=minimal' },
            body: JSON.stringify({
              balance:      Number(wallet.balance) + netAmount,
              total_earned: Number(wallet.total_earned) + netAmount,
              escrow:       Math.max(0, Number(wallet.escrow || 0) - amount),
            }),
          });
        } else {
          await fetch(`${env.SUPABASE_URL}/rest/v1/wallets`, {
            method: 'POST',
            headers: { ...hdr, Prefer: 'return=minimal' },
            body: JSON.stringify({ user_id: order.seller_id, balance: netAmount, total_earned: netAmount, escrow: 0 }),
          });
        }

        // Log platform earnings
        fetch(`${env.SUPABASE_URL}/rest/v1/platform_earnings`, {
          method: 'POST',
          headers: { ...hdr, Prefer: 'return=minimal' },
          body: JSON.stringify({
            order_id: order.id, listing_id: order.listing_id,
            seller_id: order.seller_id, gross_amount: amount,
            fee_percent: 5, fee_amount: feeAmount, net_amount: netAmount,
          }),
        }).catch(() => {});

        // Mark order released
        await fetch(`${env.SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`, {
          method: 'PATCH',
          headers: { ...hdr, Prefer: 'return=minimal' },
          body: JSON.stringify({ escrow_status: 'released' }),
        });

        // Update transactions
        try {
          await fetch(`${env.SUPABASE_URL}/rest/v1/transactions?reference=eq.${order.id}&user_id=eq.${order.buyer_id}`, {
            method: 'PATCH',
            headers: { ...hdr, Prefer: 'return=minimal' },
            body: JSON.stringify({ status: 'completed', description: 'Purchase auto-completed after 72 hours' }),
          });
          await fetch(`${env.SUPABASE_URL}/rest/v1/transactions?reference=eq.${order.id}&user_id=eq.${order.seller_id}&type=eq.escrow`, {
            method: 'PATCH',
            headers: { ...hdr, Prefer: 'return=minimal' },
            body: JSON.stringify({
              type: 'credit', status: 'completed',
              description: 'Sale auto-completed after 72 hours',
            }),
          });
        } catch {}

        // Notify both parties
        try {
          const fmt = v => `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
          await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
            method: 'POST', headers: { ...hdr, Prefer: 'return=minimal' },
            body: JSON.stringify({
              user_id: order.seller_id,
              title:   '💸 Payment auto-released',
              message: `${fmt(netAmount)} (after 5% fee) was automatically released after 72 hours.`,
              type: 'listing', link: '/wallet',
            }),
          });
          await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
            method: 'POST', headers: { ...hdr, Prefer: 'return=minimal' },
            body: JSON.stringify({
              user_id: order.buyer_id,
              title:   '✅ Order auto-completed',
              message: `Your order was automatically completed after 72 hours. Payment has been released to the seller.`,
              type: 'order', link: '/orders',
            }),
          });
        } catch {}

        released++;
      } catch {}
    }

    // Clean up images for listings sold more than 14 days ago
    try {
      const imageCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const soldRes  = await fetch(
        `${env.SUPABASE_URL}/rest/v1/orders?escrow_status=eq.released&created_at=lt.${encodeURIComponent(imageCutoff)}&select=listing_id`,
        { headers: hdr }
      );
      const soldOrders = await soldRes.json();
      const listingIds = [...new Set((Array.isArray(soldOrders) ? soldOrders : []).map(o => o.listing_id).filter(Boolean))];

      if (listingIds.length > 0) {
        const liRes  = await fetch(
          `${env.SUPABASE_URL}/rest/v1/listings?id=in.(${listingIds.join(',')})&images=neq.[]&select=id,images`,
          { headers: hdr }
        );
        const listings = await liRes.json();
        const prefix   = `${env.SUPABASE_URL}/storage/v1/object/public/listing-images/`;

        for (const listing of (Array.isArray(listings) ? listings : [])) {
          const images = Array.isArray(listing.images) ? listing.images : [];
          const paths  = images
            .map(img => typeof img === 'string' ? img : (img?.url || img?.src || ''))
            .filter(url => url.startsWith(prefix))
            .map(url => url.replace(prefix, ''));

          if (paths.length > 0) {
            await fetch(`${env.SUPABASE_URL}/storage/v1/object/listing-images`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ prefixes: paths }),
            }).catch(() => {});

            // Clear images array on the listing row
            await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listing.id}`, {
              method: 'PATCH',
              headers: { ...hdr, Prefer: 'return=minimal' },
              body: JSON.stringify({ images: [] }),
            }).catch(() => {});
          }
        }
      }
    } catch {}

    return Response.json({ released });
  } catch (e) {
    return Response.json({ released: 0, error: e.message });
  }
}
