export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email } = await request.json();

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!email || !emailRe.test(email)) {
      return Response.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    // Rate limit: max 5 emails per address per 10 minutes
    const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const rlRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/email_rate_limits?email=eq.${encodeURIComponent(email)}&created_at=gte.${encodeURIComponent(windowStart)}&select=id`,
      { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
    );
    const rlRows = await rlRes.json().catch(() => []);
    if (Array.isArray(rlRows) && rlRows.length >= 5) {
      return Response.json({ error: 'Too many requests. Please wait a few minutes before trying again.' }, { status: 429 });
    }
    await fetch(`${env.SUPABASE_URL}/rest/v1/email_rate_limits`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ email }),
    });

    const secret = env.HMAC_SECRET;
    if (!secret) return Response.json({ error: 'Server config error.' }, { status: 500 });

    // 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Sign: email + code + 10-min window (stateless, no DB needed)
    const window = Math.floor(Date.now() / 600000);
    const message = `${email}:${code}:${window}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    const token = btoa(String.fromCharCode(...new Uint8Array(sig)));

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@zenlootexchange.com',
        to: email,
        subject: 'Your ZenLootX verification code',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0A0E0C;padding:40px;border-radius:12px">
            <h2 style="color:#E8EDE9;margin:0 0 16px">Verify your email</h2>
            <p style="color:#9BA8A0;margin:0 0 24px">Enter this code to finish creating your ZenLootX account.</p>
            <div style="font-size:36px;font-weight:700;letter-spacing:10px;padding:28px;background:#121814;color:#19C37D;border-radius:8px;text-align:center;border:1px solid #232B26">
              ${code}
            </div>
            <p style="color:#6B776F;font-size:13px;margin-top:20px">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return Response.json({ error: err.message || 'Failed to send email.' }, { status: 500 });
    }

    return Response.json({ token });

  } catch (e) {
    return Response.json({ error: 'Server error.' }, { status: 500 });
  }
}
