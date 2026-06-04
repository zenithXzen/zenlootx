export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { username, userId } = await request.json();

    if (!username || username.length < 3) {
      return Response.json({ available: false, error: 'Username must be at least 3 characters.' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return Response.json({ available: false, error: 'Only letters, numbers, and underscores allowed.' });
    }

    // Check profiles table (case-insensitive)
    let url = `${env.SUPABASE_URL}/rest/v1/profiles?select=id&username=ilike.${encodeURIComponent(username)}`;
    if (userId) url += `&id=neq.${userId}`;

    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    });

    const data = await res.json();
    const taken = Array.isArray(data) && data.length > 0;

    return Response.json({ available: !taken });

  } catch {
    return Response.json({ available: false, error: 'Server error.' });
  }
}
