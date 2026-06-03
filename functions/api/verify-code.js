export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email, code, token } = await request.json();

    if (!email || !code || !token) {
      return Response.json({ error: 'Missing fields.' }, { status: 400 });
    }

    const secret = env.HMAC_SECRET || 'zenlootx-default-secret';
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Check current window and the previous one (10 min total grace period)
    const now = Math.floor(Date.now() / 600000);
    for (const w of [now, now - 1]) {
      const message = `${email}:${code}:${w}`;
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
      const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
      if (expected === token) {
        return Response.json({ valid: true });
      }
    }

    return Response.json({ valid: false, error: 'Invalid or expired code.' }, { status: 400 });

  } catch (e) {
    return Response.json({ error: 'Server error.' }, { status: 500 });
  }
}
