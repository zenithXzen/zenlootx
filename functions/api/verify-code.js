export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email, code, token } = await request.json();

    if (!email || !code || !token) {
      return Response.json({ error: 'Missing fields.' }, { status: 400 });
    }

    // Rate limit: max 5 failed attempts per email per 10 minutes
    const rlKey = `vfy::${email}`;
    const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const rlHdr = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
    const rlRes  = await fetch(
      `${env.SUPABASE_URL}/rest/v1/email_rate_limits?email=eq.${encodeURIComponent(rlKey)}&created_at=gte.${encodeURIComponent(windowStart)}&select=id`,
      { headers: rlHdr }
    );
    const rlRows = await rlRes.json().catch(() => []);
    if (Array.isArray(rlRows) && rlRows.length >= 5) {
      return Response.json({ error: 'Too many incorrect attempts. Please wait a few minutes or request a new code.' }, { status: 429 });
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

    // Log this failed attempt so future calls can rate-limit
    await fetch(`${env.SUPABASE_URL}/rest/v1/email_rate_limits`, {
      method: 'POST',
      headers: { ...rlHdr, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ email: rlKey }),
    }).catch(() => {});

    return Response.json({ valid: false, error: 'Invalid or expired code.' }, { status: 400 });

  } catch (e) {
    return Response.json({ error: 'Server error.' }, { status: 500 });
  }
}
