export async function onRequestGet({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await userRes.json();
  if (!user.app_metadata?.is_admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const svcHeaders = {
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    apikey: env.SUPABASE_SERVICE_KEY,
    Prefer: 'count=exact',
  };

  function parseCount(cr) {
    if (!cr) return 0;
    const m = cr.match(/\/(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  }

  const [d, a, t, w] = await Promise.all([
    fetch(`${env.SUPABASE_URL}/rest/v1/disputes?status=eq.open&select=id`, { headers: svcHeaders }).then(r => parseCount(r.headers.get('content-range'))),
    fetch(`${env.SUPABASE_URL}/rest/v1/seller_applications?status=eq.pending&select=id`, { headers: svcHeaders }).then(r => parseCount(r.headers.get('content-range'))),
    fetch(`${env.SUPABASE_URL}/rest/v1/topup_requests?status=eq.pending&select=id`, { headers: svcHeaders }).then(r => parseCount(r.headers.get('content-range'))),
    fetch(`${env.SUPABASE_URL}/rest/v1/withdrawal_requests?status=eq.pending&select=id`, { headers: svcHeaders }).then(r => parseCount(r.headers.get('content-range'))),
  ]);

  return Response.json({ disputes: d, applications: a, topups: t, withdrawals: w, total: d + a + t + w });
}
