// TEMPORARY — delete this file after use
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    const newPassword = url.searchParams.get('pw');

    if (secret !== 'zenloot-reset-2026') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Decode key role for debugging (safe — only shows the role claim)
    const keyPayload = JSON.parse(atob(env.SUPABASE_SERVICE_KEY.split('.')[1]));
    const keyRole = keyPayload.role;

    const userId = '04b53ba1-4ffb-4307-8e58-ee3d0dc303bb';

    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: newPassword }),
    });

    const data = await res.json();
    if (!res.ok) return Response.json({ error: data, key_role: keyRole }, { status: 500 });

    return Response.json({ success: true, key_role: keyRole });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
