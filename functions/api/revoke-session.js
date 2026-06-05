export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify the JWT is real — Supabase checks the signature for us
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();
    const tokenUserId = user?.id;

    const { sessionId, userId } = await request.json();
    if (!sessionId || !userId) return Response.json({ error: 'Missing fields' }, { status: 400 });
    if (tokenUserId !== userId)  return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get the Supabase session ID from our table
    const getRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sessionId}&user_id=eq.${userId}&select=supabase_session_id`,
      {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
        },
      }
    );
    const rows = await getRes.json();
    const supabaseSessionId = rows?.[0]?.supabase_session_id;

    // Revoke the Supabase session to force sign-out on that device
    if (supabaseSessionId) {
      await fetch(
        `${env.SUPABASE_URL}/auth/v1/admin/users/${userId}/sessions/${supabaseSessionId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            apikey: env.SUPABASE_SERVICE_KEY,
          },
        }
      );
    }

    // Mark our record as inactive
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sessionId}&user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active:     false,
          signed_out_at: new Date().toISOString(),
        }),
      }
    );

    return Response.json({ success: true });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
