import { verifyAdmin } from './_shared.js';

export async function onRequestGet({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const admin = await verifyAdmin(token, env);
    if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const res  = await fetch(`${env.SUPABASE_URL}/rest/v1/disputes?order=created_at.desc`, {
      headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY },
    });

    if (!res.ok) return Response.json({ disputes: [] });

    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return Response.json({ disputes: [] });

    const usersRes  = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
      headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY },
    });
    const usersData = await usersRes.json();
    const userMap   = {};
    (usersData.users || []).forEach(u => {
      userMap[u.id] = { email: u.email, username: u.user_metadata?.username };
    });

    const disputes = data.map(d => ({
      ...d,
      _buyer:  userMap[d.buyer_id]  || {},
      _seller: userMap[d.seller_id] || {},
    }));

    return Response.json({ disputes });
  } catch (e) {
    return Response.json({ disputes: [] });
  }
}
