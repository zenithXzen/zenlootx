export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ sessions: [] });

    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId  = payload.sub;
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
