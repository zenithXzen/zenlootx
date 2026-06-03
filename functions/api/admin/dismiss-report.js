function isAdmin(p) { return p?.app_metadata?.is_admin === true; }
function decode(t) { try { return JSON.parse(atob(t.split('.')[1])); } catch { return null; } }

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!isAdmin(decode(token))) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { reportId } = await request.json();
    if (!reportId) return Response.json({ error: 'Missing reportId' }, { status: 400 });

    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/reports?id=eq.${reportId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status: 'reviewed', reviewed_at: new Date().toISOString() }),
      }
    );

    if (!res.ok) return Response.json({ error: await res.text() }, { status: res.status });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
