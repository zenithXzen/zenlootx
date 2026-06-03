export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized', sessions: [] }, { status: 401 });

    // Decode JWT to get user ID (already signed by Supabase — safe to trust)
    let userId;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
    } catch {
      return Response.json({ error: 'Invalid token', sessions: [] }, { status: 401 });
    }

    if (!userId) return Response.json({ error: 'No user ID', sessions: [] }, { status: 401 });

    // Get all sessions for this user using the service key
    const sessRes = await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users/${userId}/sessions`,
      {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
        },
      }
    );

    const raw = await sessRes.text();
    let sessions = [];

    try {
      const data = JSON.parse(raw);
      sessions = Array.isArray(data) ? data : (data.sessions || []);
    } catch {
      return Response.json({ sessions: [] });
    }

    return Response.json({ sessions });

  } catch (e) {
    return Response.json({ sessions: [], error: e.message }, { status: 500 });
  }
}
