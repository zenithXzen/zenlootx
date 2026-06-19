import { verifyAdmin, logAdminAction } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const admin = await verifyAdmin(token, env);
    if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

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
      body: JSON.stringify({ status: 'reviewed' }),
    });

    if (!res.ok) return Response.json({ error: await res.text() }, { status: res.status });
    await logAdminAction(env, admin.id, 'dismiss_report', reportId, 'report', {});
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
