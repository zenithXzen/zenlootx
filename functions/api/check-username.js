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

    // Rate limit: 10 username lookups per IP per minute
    const ip     = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rlKey  = `ipck::${ip}`;
    const rl1min = new Date(Date.now() - 60 * 1000).toISOString();
    const rlRes  = await fetch(
      `${env.SUPABASE_URL}/rest/v1/email_rate_limits?email=eq.${encodeURIComponent(rlKey)}&created_at=gte.${encodeURIComponent(rl1min)}&select=id`,
      { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
    );
    const rlRows = await rlRes.json().catch(() => []);
    if (Array.isArray(rlRows) && rlRows.length >= 10) {
      return Response.json({ available: false, error: 'Too many requests. Please wait a moment.' }, { status: 429 });
    }
    await fetch(`${env.SUPABASE_URL}/rest/v1/email_rate_limits`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ email: rlKey }),
    }).catch(() => {});

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
