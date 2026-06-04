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

    const { userId, action } = await request.json();
    if (!userId || !['freeze', 'unfreeze'].includes(action)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const isFreezing = action === 'freeze';
    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };

    await Promise.all([
      // 1. Mark profile as frozen
      fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH', headers: hdr,
        body: JSON.stringify({ is_frozen: isFreezing }),
      }),

      // 2. Set app_metadata so the JWT carries frozen status on next refresh
      fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_metadata: { is_frozen: isFreezing } }),
      }),

      // 3. Notify the user
      fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST', headers: hdr,
        body: JSON.stringify({
          user_id: userId,
          title:   isFreezing ? '🔒 Account restricted' : '✅ Account restriction lifted',
          message: isFreezing
            ? 'Your account has been temporarily restricted by an admin. You can still browse but cannot list, buy, withdraw, or message until the restriction is lifted.'
            : 'Your account restriction has been lifted. All features are now available again.',
          type: 'general', link: '/', read: false,
        }),
      }),
    ]);

    return Response.json({ success: true, action });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
