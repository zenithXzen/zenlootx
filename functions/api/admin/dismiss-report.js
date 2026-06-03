async function verifyAdmin(token, env) {
  try {
    const res  = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return false;
    const user = await res.json();
    return user?.app_metadata?.is_admin === true;
  } catch { return false; }
}

export async function onRequestPost({ request, env }) {
  try {
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const isAdmin = await verifyAdmin(token, env);
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { reportId } = await request.json();
    if (!reportId) return Response.json({ error: 'Missing reportId' }, { status: 400 });

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/reports?id=eq.${reportId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ status: 'reviewed', reviewed_at: new Date().toISOString() }),
    });

    if (!res.ok) return Response.json({ error: await res.text() }, { status: res.status });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
