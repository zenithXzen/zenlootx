export async function onRequestGet({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await userRes.json();
  if (!user.app_metadata?.is_admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const svc = {
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    apikey: env.SUPABASE_SERVICE_KEY,
  };

  async function count(table, filter) {
    try {
      const res  = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${filter}&select=id`, { headers: svc });
      const data = await res.json();
      return Array.isArray(data) ? data.length : 0;
    } catch { return 0; }
  }

  const [d, a, t, w] = await Promise.all([
    count('disputes',            'status=eq.open'),
    count('seller_applications', 'status=eq.pending'),
    count('topup_requests',      'status=eq.pending'),
    count('withdrawal_requests', 'status=eq.pending'),
  ]);

  return Response.json({ disputes: d, applications: a, topups: t, withdrawals: w, total: d + a + t + w });
}
