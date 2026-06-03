export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId, userId } = await request.json();
    if (!sessionId || !userId) return Response.json({ error: 'Missing fields' }, { status: 400 });

    // Verify the requesting user owns this session
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_SERVICE_KEY,
      },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();
    if (user.id !== userId) return Response.json({ error: 'Forbidden' }, { status: 403 });

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
