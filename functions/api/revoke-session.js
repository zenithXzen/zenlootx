export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId, userId } = await request.json();
    if (!sessionId || !userId) return Response.json({ error: 'Missing fields' }, { status: 400 });

    // Decode JWT to verify user owns this session
    let tokenUserId;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      tokenUserId = payload.sub;
    } catch {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }
    if (tokenUserId !== userId) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Revoke the specific session
    const res = await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users/${userId}/sessions/${sessionId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
        },
      }
    );

    if (!res.ok) return Response.json({ error: 'Failed to revoke session' }, { status: 500 });
    return Response.json({ success: true });

  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
