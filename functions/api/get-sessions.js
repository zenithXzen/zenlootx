export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
      return Response.json({ error: 'Missing env vars', sessions: [] }, { status: 500 });
    }

    // Verify token and get user
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_SERVICE_KEY,
      },
    });

    if (!userRes.ok) return Response.json({ error: 'Unauthorized', sessions: [] }, { status: 401 });
    const user = await userRes.json();

    // Get sessions
    const sessRes = await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}/sessions`,
      {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
        },
      }
    );

    const raw  = await sessRes.text();
    let sessions = [];

    try {
      const data = JSON.parse(raw);
      // Handle both {sessions:[]} and [] formats
      sessions = Array.isArray(data) ? data : (data.sessions || []);
    } catch {
      return Response.json({ sessions: [] });
    }

    return Response.json({ sessions });

  } catch (e) {
    return Response.json({ sessions: [], error: e.message }, { status: 500 });
  }
}
