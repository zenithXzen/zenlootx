import { verifyAdmin } from './_shared.js';

export async function onRequestGet({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const admin = await verifyAdmin(token, env);
    if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

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

    // Get frozen/banned status from profiles
    const profileRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?select=id,is_frozen,is_banned`, {
      headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY },
    });
    const profileData = await profileRes.json();
    const profileMap  = {};
    (Array.isArray(profileData) ? profileData : []).forEach(p => { profileMap[p.id] = p; });

    const reports = (Array.isArray(data) ? data : []).map(r => ({
      ...r,
      _reporter: { ...userMap[r.reporter_id], ...profileMap[r.reporter_id] } || {},
      _reported: { ...userMap[r.reported_user_id], ...profileMap[r.reported_user_id] } || {},
    }));

    return Response.json({ reports });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
