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

export async function onRequestGet({ request, env }) {
  try {
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const isAdmin = await verifyAdmin(token, env);
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const res  = await fetch(`${env.SUPABASE_URL}/rest/v1/reports?order=created_at.desc`, {
      headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY },
    });
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data }, { status: res.status });

    const usersRes  = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
      headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY },
    });
    const usersData = await usersRes.json();
    const userMap   = {};
    (usersData.users || []).forEach(u => {
      userMap[u.id] = { email: u.email, username: u.user_metadata?.username };
    });

    const reports = (Array.isArray(data) ? data : []).map(r => ({
      ...r,
      _reporter: userMap[r.reporter_id] || {},
      _reported: userMap[r.reported_user_id] || {},
    }));

    return Response.json({ reports });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
