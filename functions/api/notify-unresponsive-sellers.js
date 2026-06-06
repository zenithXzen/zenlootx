export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const authRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!authRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
    };

    // Find orders in 'holding' that are 24–72 hours old (auto-release handles 72h+)
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const cutoff72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const ordRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/orders?escrow_status=eq.holding&created_at=lte.${encodeURIComponent(cutoff24h)}&created_at=gte.${encodeURIComponent(cutoff72h)}&select=id,seller_id,buyer_id`,
      { headers: { ...hdr, Prefer: '' } }
    );
    const orders = await ordRes.json().catch(() => []);
    if (!Array.isArray(orders) || !orders.length) return Response.json({ reminded: 0 });

    let reminded = 0;
    for (const order of orders) {
      const notifLink = `/orders?highlight=${order.id}`;

      // Only send once — check if seller reminder already exists for this exact order link
      const checkRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/notifications?user_id=eq.${order.seller_id}&type=eq.seller_reminder&link=eq.${encodeURIComponent(notifLink)}&select=id`,
        { headers: { ...hdr, Prefer: '' } }
      );
      const existing = await checkRes.json().catch(() => []);
      if (Array.isArray(existing) && existing.length > 0) continue;

      // Notify seller
      await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST',
        headers: { ...hdr, Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: order.seller_id,
          title:   '⚠️ Pending order — action required',
          message: 'A buyer is waiting. Please send the account credentials via Messages. If you don\'t respond, the buyer may open a dispute.',
          type:    'seller_reminder',
          link:    notifLink,
          read:    false,
        }),
      });

      // Notify buyer they can now dispute
      await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST',
        headers: { ...hdr, Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: order.buyer_id,
          title:   '⏰ Seller has not responded yet',
          message: 'It\'s been over 24 hours since your purchase. If you haven\'t received the account credentials, you can file a dispute from your Orders page.',
          type:    'seller_reminder',
          link:    '/orders',
          read:    false,
        }),
      });

      reminded++;
    }

    return Response.json({ reminded });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
