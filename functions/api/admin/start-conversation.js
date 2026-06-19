import { verifyAdmin, logAdminAction } from './_shared.js';

// Finds an existing conversation between the admin and the target user (either direction),
// or creates a new one — used so "Message seller/buyer" links in the admin panel work even
// when there's no order/purchase tying the two users together yet.
export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const admin = await verifyAdmin(token, env);
    if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { userId, listingId = null } = await request.json();
    if (!userId) return Response.json({ error: 'Missing userId' }, { status: 400 });
    if (userId === admin.id) return Response.json({ error: 'Cannot start a conversation with yourself' }, { status: 400 });

    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
    };

    const findUrl = `${env.SUPABASE_URL}/rest/v1/conversations?or=(and(buyer_id.eq.${admin.id},seller_id.eq.${userId}),and(buyer_id.eq.${userId},seller_id.eq.${admin.id}))&limit=1`;
    const findRes = await fetch(findUrl, { headers: hdr });
    const found   = await findRes.json();
    if (Array.isArray(found) && found[0]) {
      return Response.json({ conversationId: found[0].id });
    }

    const createRes = await fetch(`${env.SUPABASE_URL}/rest/v1/conversations`, {
      method: 'POST',
      headers: { ...hdr, Prefer: 'return=representation' },
      body: JSON.stringify({ buyer_id: admin.id, seller_id: userId, order_id: null, listing_id: listingId }),
    });
    if (!createRes.ok) return Response.json({ error: 'Failed to start conversation' }, { status: 500 });

    const created = await createRes.json();
    const conversationId = (Array.isArray(created) ? created[0] : created)?.id;
    if (!conversationId) return Response.json({ error: 'Failed to start conversation' }, { status: 500 });

    await logAdminAction(env, admin.id, 'start_conversation', userId, 'user', { listingId });
    return Response.json({ conversationId });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
