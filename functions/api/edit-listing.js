export async function onRequestPost({ request, env }) {
  try {
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { listingId, title, price, currency, description } = await request.json();

    if (!listingId) return Response.json({ error: 'Missing listingId' }, { status: 400 });
    if (!title?.trim()) return Response.json({ error: 'Title is required' }, { status: 400 });
    if (!price || isNaN(price) || Number(price) <= 0) return Response.json({ error: 'Enter a valid price' }, { status: 400 });

    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };

    // Verify ownership
    const lRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=seller_id`, { headers: { ...hdr, Prefer: '' } });
    const lData = await lRes.json();
    const listing = lData[0];
    if (!listing) return Response.json({ error: 'Listing not found' }, { status: 404 });
    if (listing.seller_id !== user.id) return Response.json({ error: 'Not your listing' }, { status: 403 });

    await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
      method: 'PATCH',
      headers: hdr,
      body: JSON.stringify({
        title:       title.trim(),
        price:       Number(price),
        currency:    currency || 'PHP',
        description: description?.trim() || null,
      }),
    });

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
