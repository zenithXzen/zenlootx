export async function onRequestGet({ request, env }) {
  try {
    const userId = new URL(request.url).searchParams.get('id');
    if (!userId) return Response.json({ error: 'Missing id' }, { status: 400 });

    // Fetch user from Supabase Admin API (service key required)
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
      },
    });

    if (!res.ok) return Response.json({ error: 'User not found' }, { status: 404 });
    const user = await res.json();

    // Return only public-safe fields — never expose email or sensitive metadata
    return Response.json({
      id:         user.id,
      username:   user.user_metadata?.username || user.email?.split('@')[0] || 'Unknown',
      avatar_url: user.user_metadata?.avatar_url || null,
      bio:        user.user_metadata?.bio        || null,
      created_at: user.created_at,
    }, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
