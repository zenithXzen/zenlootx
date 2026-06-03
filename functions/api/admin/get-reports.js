function isAdmin(p) { return p?.app_metadata?.is_admin === true; }
function decode(t) { try { return JSON.parse(atob(t.split('.')[1])); } catch { return null; } }

export async function onRequestGet({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!isAdmin(decode(token))) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const res  = await fetch(
      `${env.SUPABASE_URL}/rest/v1/reports?order=created_at.desc`,
      { headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY } }
    );
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data }, { status: res.status });

    // Fetch user info for reporters and reported users
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
