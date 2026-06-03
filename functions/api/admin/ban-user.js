async function verifyAdmin(token, env) {
  try {
    const res  = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return false;
    return (await res.json())?.app_metadata?.is_admin === true;
  } catch { return false; }
}

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!await verifyAdmin(token, env)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { userId, action, reason } = await request.json();
    if (!userId || !['ban', 'unban'].includes(action)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const isBanning = action === 'ban';
    const headers   = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };

    await Promise.all([
      // 1. Update profile ban status
      fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          is_banned:  isBanning,
          ban_reason: isBanning ? (reason || null) : null,
        }),
      }),

      // 2. Stamp app_metadata so the JWT carries the ban on next refresh
      fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ app_metadata: { is_banned: isBanning } }),
      }),

      // 3. Delete all active sessions → kicks them out immediately
      fetch(`${env.SUPABASE_URL}/rest/v1/user_sessions?user_id=eq.${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
          Prefer: 'return=minimal',
        },
      }),

      // 4. Hide/restore listings
      isBanning
        ? fetch(`${env.SUPABASE_URL}/rest/v1/listings?seller_id=eq.${userId}&status=eq.active`, {
            method: 'PATCH', headers,
            body: JSON.stringify({ status: 'banned' }),
          })
        : fetch(`${env.SUPABASE_URL}/rest/v1/listings?seller_id=eq.${userId}&status=eq.banned`, {
            method: 'PATCH', headers,
            body: JSON.stringify({ status: 'active' }),
          }),
    ]);

    return Response.json({ success: true, action });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
