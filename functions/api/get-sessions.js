export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify token and get user
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_SERVICE_KEY,
      },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();

    // Get all sessions for this user
    const sessRes = await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}/sessions`,
      {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
        },
      }
    );
    const data = await sessRes.json();
    return Response.json({ sessions: data.sessions || [] });

  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
