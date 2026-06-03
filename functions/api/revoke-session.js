export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = JSON.parse(atob(token.split('.')[1]));
    const tokenUserId = payload.sub;

    const { sessionId, userId } = await request.json();
    if (!sessionId || !userId) return Response.json({ error: 'Missing fields' }, { status: 400 });
    if (tokenUserId !== userId) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Mark as inactive instead of deleting — keeps history
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sessionId}&user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active:     false,
          signed_out_at: new Date().toISOString(),
        }),
      }
    );

    return Response.json({ success: true });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
