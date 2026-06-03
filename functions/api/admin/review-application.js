function isAdmin(payload) {
  return payload?.app_metadata?.is_admin === true;
}

function decodeToken(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch { return null; }
}

export async function onRequestPost({ request, env }) {
  try {
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const payload = decodeToken(token);
    if (!payload || !isAdmin(payload)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { applicationId, userId, action, reason } = await request.json();
    if (!applicationId || !userId || !['approve', 'reject'].includes(action)) {
      return Response.json({ error: 'Missing or invalid fields' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const patchBody = {
      status:      newStatus,
      reviewed_at: new Date().toISOString(),
      ...(action === 'reject' && reason ? { rejection_reason: reason } : {}),
    };

    // Update seller_applications row
    const patchRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/seller_applications?id=eq.${applicationId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(patchBody),
      }
    );
    if (!patchRes.ok) {
      const err = await patchRes.text();
      return Response.json({ error: err }, { status: patchRes.status });
    }

    // Update user app_metadata with seller status
    await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_metadata: { is_seller: action === 'approve' },
        }),
      }
    );

    return Response.json({ success: true, status: newStatus });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
