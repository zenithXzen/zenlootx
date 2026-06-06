async function verifyAdmin(token, env) {
  try {
    const res  = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.app_metadata?.is_admin === true ? user : null;
  } catch { return null; }
}

async function logAdminAction(env, adminId, action, targetId, targetType, details = {}) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/admin_logs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ admin_id: adminId, action, target_id: targetId ? String(targetId) : null, target_type: targetType, details }),
  }).catch(() => {});
}

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const admin = await verifyAdmin(token, env);
    if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { listingId } = await request.json();
    if (!listingId) return Response.json({ error: 'Missing listingId' }, { status: 400 });

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
        Prefer: 'return=minimal',
      },
    });

    if (!res.ok) return Response.json({ error: await res.text() }, { status: res.status });
    await logAdminAction(env, admin.id, 'delete_listing', listingId, 'listing', {});
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
