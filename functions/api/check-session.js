export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ active: false });

    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId  = payload.sub;
    if (!userId) return Response.json({ active: false });

    // Use the actual User-Agent header from the request (most reliable)
    const ua = request.headers.get('User-Agent') || '';

    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/user_sessions?user_id=eq.${userId}&user_agent=eq.${encodeURIComponent(ua)}&select=is_active&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
        },
      }
    );

    const rows = await res.json();

    // If no session found or marked inactive → sign out
    if (!Array.isArray(rows) || rows.length === 0) return Response.json({ active: true });
    const active = rows[0].is_active !== false;

    return Response.json({ active });

  } catch {
    return Response.json({ active: true }); // fail safe — don't sign out on error
  }
}
