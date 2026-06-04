export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email, token, password } = await request.json();

    if (!email || !token || !password) {
      return Response.json({ error: 'Missing fields.' }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const secret = env.HMAC_SECRET;
    if (!secret) return Response.json({ error: 'Server config error.' }, { status: 500 });

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const now = Math.floor(Date.now() / 900000);
    let valid = false;

    for (const w of [now, now - 1]) {
      const message = `reset:${email}:${w}`;
      const sig     = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
      const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
                        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      if (expected === token) { valid = true; break; }
    }

    if (!valid) {
      return Response.json({ error: 'Reset link is invalid or has expired.' }, { status: 400 });
    }

    // Look up user by email to get their ID
    const lookupRes = await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
        },
      }
    );
    const lookupData = await lookupRes.json();
    const userId = lookupData?.users?.[0]?.id;
    if (!userId) {
      return Response.json({ error: 'Account not found.' }, { status: 404 });
    }

    // Update password via Supabase admin API
    const updateRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.json();
      return Response.json({ error: err?.msg || 'Failed to update password.' }, { status: 500 });
    }

    return Response.json({ success: true });

  } catch (e) {
    return Response.json({ error: 'Server error.' }, { status: 500 });
  }
}
