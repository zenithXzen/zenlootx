export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId           = payload.sub;
    const supabaseSessionId = payload.session_id || null;
    if (!userId) return Response.json({ error: 'Invalid token' }, { status: 401 });

    const { userAgent, deviceName, browser } = await request.json();
    const now = new Date().toISOString();

    // Check if session exists for this user_agent
    const checkRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/user_sessions?user_id=eq.${userId}&user_agent=eq.${encodeURIComponent(userAgent)}&select=id`,
      {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
        },
      }
    );
    const existing = await checkRes.json();

    if (Array.isArray(existing) && existing.length > 0) {
      // Reactivate and update session ID
      await fetch(
        `${env.SUPABASE_URL}/rest/v1/user_sessions?user_id=eq.${userId}&user_agent=eq.${encodeURIComponent(userAgent)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            apikey: env.SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            is_active:           true,
            signed_out_at:       null,
            last_active:         now,
            supabase_session_id: supabaseSessionId,
          }),
        }
      );
    } else {
      await fetch(`${env.SUPABASE_URL}/rest/v1/user_sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id:             userId,
          user_agent:          userAgent,
          device_name:         deviceName,
          browser:             browser,
          last_active:         now,
          is_active:           true,
          supabase_session_id: supabaseSessionId,
        }),
      });
    }

    return Response.json({ success: true });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
