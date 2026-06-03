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

    // Verify the HMAC token (15-min window)
    const secret = env.HMAC_SECRET || 'zenlootx-default-secret';
    const key    = await crypto.subtle.importKey(
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

    // TODO: update password in Supabase
    // const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
    // await supabase.auth.admin.updateUserByEmail(email, { password })

    return Response.json({ success: true });

  } catch (e) {
    return Response.json({ error: 'Server error.' }, { status: 500 });
  }
}
