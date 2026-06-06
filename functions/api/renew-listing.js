export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { listingId } = await request.json();
    if (!listingId) return Response.json({ error: 'Missing listingId' }, { status: 400 });

    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };

    // Verify ownership
    const lRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=id,seller_id,status`, { headers: hdr });
    const lData = await lRes.json();
    const listing = lData[0];
    if (!listing) return Response.json({ error: 'Listing not found.' }, { status: 404 });
    if (listing.seller_id !== user.id && !user.app_metadata?.is_admin) {
      return Response.json({ error: 'Not authorized.' }, { status: 403 });
    }
    if (listing.status === 'sold') {
      return Response.json({ error: 'Cannot renew a sold listing.' }, { status: 400 });
    }

    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
      method: 'PATCH',
      headers: hdr,
      body: JSON.stringify({ expires_at: newExpiry, status: 'active' }),
    });

    return Response.json({ success: true, expires_at: newExpiry });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
