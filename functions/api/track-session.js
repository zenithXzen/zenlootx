export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Decode JWT to get user ID
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId  = payload.sub;
    if (!userId) return Response.json({ error: 'Invalid token' }, { status: 401 });

    const { userAgent, deviceName, browser } = await request.json();

    // Upsert session — one row per user agent to avoid duplicates
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/user_sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify({
        user_id:     userId,
        user_agent:  userAgent,
        device_name: deviceName,
        browser:     browser,
        last_active: new Date().toISOString(),
      }),
    });

    // Update last_active for existing session with same user_agent
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/user_sessions?user_id=eq.${userId}&user_agent=eq.${encodeURIComponent(userAgent)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ last_active: new Date().toISOString() }),
      }
    );

    return Response.json({ success: true });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
