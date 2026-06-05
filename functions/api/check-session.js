export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ active: false });

    // Verify the JWT is real — Supabase checks the signature for us
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ active: false });
    const user = await userRes.json();
    const userId = user?.id;
    if (!userId) return Response.json({ active: false });

    // Match by session row ID — not by user-agent (which can be faked)
    const url = new URL(request.url);
    const sessionRowId = url.searchParams.get('sessionRowId');
    if (!sessionRowId) return Response.json({ active: true });

    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sessionRowId}&user_id=eq.${userId}&select=is_active&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
        },
      }
    );

    const rows = await res.json();

    if (!Array.isArray(rows) || rows.length === 0) return Response.json({ active: true });
    const active = rows[0].is_active !== false;

    return Response.json({ active });

  } catch {
    return Response.json({ active: true });
  }
}
