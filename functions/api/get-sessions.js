export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ sessions: [] });

    // Verify the JWT is real — Supabase checks the signature for us
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ sessions: [] });
    const user = await userRes.json();
    const userId = user?.id;
    if (!userId) return Response.json({ sessions: [] });

    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/user_sessions?user_id=eq.${userId}&order=last_active.desc`,
      {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
        },
      }
    );

    const sessions = await res.json();
    return Response.json({ sessions: Array.isArray(sessions) ? sessions : [] });

  } catch (e) {
    return Response.json({ sessions: [], error: e.message });
  }
}
