async function verifyUser(token, env) {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const user  = await verifyUser(token, env);
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Only allow deleting your own rejected application
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/seller_applications?user_id=eq.${user.id}&status=eq.rejected`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
          Prefer: 'return=minimal',
        },
      }
    );

    if (!res.ok) return Response.json({ error: 'Failed to clear application' }, { status: 500 });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
