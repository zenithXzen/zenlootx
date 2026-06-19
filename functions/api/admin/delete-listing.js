import { verifyAdmin, logAdminAction } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const admin = await verifyAdmin(token, env);
    if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { listingId } = await request.json();
    if (!listingId) return Response.json({ error: 'Missing listingId' }, { status: 400 });

    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };

    // Fetch images before deleting
    const lRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=images`, { headers: { ...hdr, Prefer: '' } });
    const lData = await lRes.json();
    const images = Array.isArray(lData[0]?.images) ? lData[0].images : [];
    const prefix = `${env.SUPABASE_URL}/storage/v1/object/public/listing-images/`;
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
    }

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
      method: 'DELETE', headers: hdr,
    });

    if (!res.ok) return Response.json({ error: await res.text() }, { status: res.status });
    await logAdminAction(env, admin.id, 'delete_listing', listingId, 'listing', {});
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
