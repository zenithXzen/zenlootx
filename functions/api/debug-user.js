export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'No token' });

    const res  = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=10`, {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
      },
    });

    const data = await res.json();
    const users = (data.users || []).map(u => ({
      email: u.email,
      user_metadata: u.user_metadata,
      raw_user_meta_data: u.raw_user_meta_data,
      app_metadata: u.app_metadata,
    }));

    return Response.json({ users });
  } catch (e) {
    return Response.json({ error: e.message });
  }
}
