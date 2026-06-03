function isAdmin(payload) {
  return payload?.app_metadata?.is_admin === true;
}

function decodeToken(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch { return null; }
}

export async function onRequestGet({ request, env }) {
  try {
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const payload = decodeToken(token);
    if (!payload || !isAdmin(payload)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url    = new URL(request.url);
    const status = url.searchParams.get('status');

    let endpoint = `${env.SUPABASE_URL}/rest/v1/seller_applications?order=submitted_at.desc`;
    if (status) endpoint += `&status=eq.${status}`;

    const res  = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
      },
    });

    const data = await res.json();
    if (!res.ok) return Response.json({ error: data }, { status: res.status });

    // Fetch matching user emails from auth admin API
    const usersRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
      },
    });
    const usersData = await usersRes.json();
    const userMap   = {};
    (usersData.users || []).forEach(u => {
      userMap[u.id] = { email: u.email, username: u.user_metadata?.username, avatar_url: u.user_metadata?.avatar_url };
    });

    const applications = (Array.isArray(data) ? data : []).map(app => ({
      ...app,
      _user: userMap[app.user_id] || {},
    }));

    return Response.json({ applications });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
