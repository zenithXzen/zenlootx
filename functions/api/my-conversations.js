export async function onRequestGet({ request, env }) {
  try {
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    // Fetch existing conversations
    const convRes  = await fetch(
      `${env.SUPABASE_URL}/rest/v1/conversations?or=(buyer_id.eq.${user.id},seller_id.eq.${user.id})&order=created_at.desc`,
      { headers: hdr }
    );
    const existing = await convRes.json();
    const convs    = Array.isArray(existing) ? existing : [];

    const coveredOrders = new Set(convs.map(c => c.order_id).filter(Boolean));

    // Fetch orders — create a conversation for each order that doesn't have one yet
    const ordRes  = await fetch(
      `${env.SUPABASE_URL}/rest/v1/orders?or=(buyer_id.eq.${user.id},seller_id.eq.${user.id})&order=created_at.desc`,
      { headers: hdr }
    );
    const orders = await ordRes.json();

    for (const o of (Array.isArray(orders) ? orders : [])) {
      if (coveredOrders.has(o.id)) continue;

      const ncRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/conversations`, {
        method: 'POST', headers: hdr,
        body: JSON.stringify({ buyer_id: o.buyer_id, seller_id: o.seller_id, order_id: o.id, listing_id: o.listing_id }),
      });
      const ncData = await ncRes.json();
      const nc     = Array.isArray(ncData) ? ncData[0] : ncData;

      if (nc?.id) {
        // Send welcome message
        await fetch(`${env.SUPABASE_URL}/rest/v1/messages`, {
          method: 'POST',
          headers: { ...hdr, Prefer: 'return=minimal' },
          body: JSON.stringify({
            conversation_id: nc.id,
            sender_id:       o.buyer_id,
            content:         `__system__ 🎉 Thank you for doing business on ZenLootX. The seller will deliver your account details shortly. Feel free to ask any questions here — we're happy to help make this a smooth experience for both of you.`,
          }),
        });
        convs.push(nc);
        coveredOrders.add(o.id);
      }
    }

    // Enrich with listing titles and profiles
    const listingIds = [...new Set(convs.map(c => c.listing_id).filter(Boolean))];
    const userIds    = [...new Set(convs.flatMap(c => [c.buyer_id, c.seller_id]).filter(Boolean))];

    const [listingsRes, profilesRes] = await Promise.all([
      listingIds.length
        ? fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=in.(${listingIds.join(',')})&select=id,title,game`, { headers: hdr })
        : Promise.resolve({ json: () => [] }),
      userIds.length
        ? fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=in.(${userIds.join(',')})&select=id,username,avatar_url`, { headers: hdr })
        : Promise.resolve({ json: () => [] }),
    ]);

    const listings = await listingsRes.json();
    const profiles = await profilesRes.json();

    const listingMap = Object.fromEntries((Array.isArray(listings) ? listings : []).map(l => [l.id, l]));
    const profileMap = Object.fromEntries((Array.isArray(profiles) ? profiles : []).map(p => [p.id, p]));

    // Fetch order details for each conversation
    const orderIds = [...new Set(convs.map(c => c.order_id).filter(Boolean))];
    let orderMap = {};
    if (orderIds.length) {
      const orRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/orders?id=in.(${orderIds.join(',')})&select=id,amount,currency,escrow_status,created_at`, { headers: hdr });
      const orData = await orRes.json();
      orderMap = Object.fromEntries((Array.isArray(orData) ? orData : []).map(o => [o.id, o]));
    }

    const enriched = convs.map(c => ({
      ...c,
      listing: listingMap[c.listing_id] || null,
      order:   c.order_id ? (orderMap[c.order_id] || null) : null,
    }));

    return Response.json({ conversations: enriched, profiles: profileMap });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
