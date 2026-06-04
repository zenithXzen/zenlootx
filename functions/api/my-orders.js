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
    };

    // Fetch purchases and sales in parallel
    const [buyRes, sellRes] = await Promise.all([
      fetch(`${env.SUPABASE_URL}/rest/v1/orders?buyer_id=eq.${user.id}&order=created_at.desc`, { headers: hdr }),
      fetch(`${env.SUPABASE_URL}/rest/v1/orders?seller_id=eq.${user.id}&order=created_at.desc`, { headers: hdr }),
    ]);

    const purchases = await buyRes.json();
    const sales     = await sellRes.json();

    // Collect listing IDs and user IDs for enrichment
    const allOrders  = [...(Array.isArray(purchases) ? purchases : []), ...(Array.isArray(sales) ? sales : [])];
    const listingIds = [...new Set(allOrders.map(o => o.listing_id).filter(Boolean))];
    const userIds    = [...new Set(allOrders.flatMap(o => [o.buyer_id, o.seller_id]).filter(Boolean))];

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

    function enrich(orders, role) {
      return (Array.isArray(orders) ? orders : []).map(o => ({
        ...o,
        listings:       listingMap[o.listing_id] || null,
        seller_profile: role === 'buyer'  ? (profileMap[o.seller_id] || null) : null,
        buyer_profile:  role === 'seller' ? (profileMap[o.buyer_id]  || null) : null,
      }));
    }

    return Response.json({
      purchases: enrich(purchases, 'buyer'),
      sales:     enrich(sales,     'seller'),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
