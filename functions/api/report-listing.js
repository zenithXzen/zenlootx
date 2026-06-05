export async function onRequestPost({ request, env }) {
  try {
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { listingId, reason, details } = await request.json();
    if (!listingId) return Response.json({ error: 'Missing listingId' }, { status: 400 });
    if (!reason)    return Response.json({ error: 'Please select a reason.' }, { status: 400 });

    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey:        env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
    };

    // Fetch listing — verify it exists and reporter isn't the seller
    const lRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=id,title,seller_id`, { headers: hdr });
    const lData = await lRes.json();
    const listing = lData[0];
    if (!listing) return Response.json({ error: 'Listing not found.' }, { status: 404 });
    if (listing.seller_id === user.id) return Response.json({ error: 'You cannot report your own listing.' }, { status: 403 });

    // Prevent duplicate reports (same user + same listing still pending)
    const dupRes  = await fetch(
      `${env.SUPABASE_URL}/rest/v1/reports?listing_id=eq.${listingId}&reporter_id=eq.${user.id}&status=eq.pending&select=id`,
      { headers: hdr }
    );
    const dupData = await dupRes.json();
    if (Array.isArray(dupData) && dupData.length > 0) {
      return Response.json({ error: 'You have already reported this listing.' }, { status: 409 });
    }

    await fetch(`${env.SUPABASE_URL}/rest/v1/reports`, {
      method: 'POST',
      headers: { ...hdr, Prefer: 'return=minimal' },
      body: JSON.stringify({
        listing_id:       listingId,
        listing_title:    listing.title,
        reporter_id:      user.id,
        reported_user_id: listing.seller_id,
        reason,
        details:          details || null,
        status:           'pending',
      }),
    });

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
