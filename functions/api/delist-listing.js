export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { listingId, action } = await request.json();
    if (!listingId || !['delist', 'delete'].includes(action)) {
      return Response.json({ error: 'Missing or invalid fields' }, { status: 400 });
    }

    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };

    // Verify user is the seller
    const lRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=seller_id,escrow_status`, { headers: { ...hdr, Prefer: '' } });
    const lData = await lRes.json();
    const listing = lData[0];

    if (!listing) return Response.json({ error: 'Listing not found' }, { status: 404 });
    if (listing.seller_id !== user.id) return Response.json({ error: 'Not your listing' }, { status: 403 });

    if (action === 'delist') {
      await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
        method: 'PATCH', headers: hdr,
        body: JSON.stringify({ status: 'inactive' }),
      });
    } else {
      await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
        method: 'DELETE', headers: hdr,
      });
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
