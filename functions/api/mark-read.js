export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();

    const { conversationId } = await request.json();
    if (!conversationId) return Response.json({ error: 'Missing conversationId' }, { status: 400 });

    const hdr = {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    };

    // Get conversation to determine user's role
    const convRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}&select=buyer_id,seller_id`, { headers: { ...hdr, Prefer: '' } });
    const convData = await convRes.json();
    const conv     = convData[0];
    if (!conv) return Response.json({ error: 'Not found' }, { status: 404 });

    const field = conv.buyer_id === user.id ? 'buyer_unread_count' : 'seller_unread_count';

    await fetch(`${env.SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}`, {
      method: 'PATCH',
      headers: { ...hdr, Prefer: 'return=minimal' },
      body: JSON.stringify({ [field]: 0 }),
    });

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
