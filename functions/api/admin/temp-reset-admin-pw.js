// TEMPORARY — delete this file after use
export async function onRequestPost({ request, env }) {
  try {
    const { secret, newPassword } = await request.json();

    if (secret !== 'zenloot-reset-2026') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = '04b53ba1-4ffb-4307-8e58-ee3d0dc303bb';

    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: newPassword }),
    });

    const data = await res.json();
    if (!res.ok) return Response.json({ error: data }, { status: 500 });

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
