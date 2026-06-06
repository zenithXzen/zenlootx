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

    // Signed reset token valid for 15 minutes
    const window  = Math.floor(Date.now() / 900000);
    const message = `reset:${email}:${window}`;
    const secret  = env.HMAC_SECRET;
    if (!secret) return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
    const key     = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig   = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    const token = btoa(String.fromCharCode(...new Uint8Array(sig)))
                    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const resetLink = `https://zenlootexchange.com/reset-password?email=${encodeURIComponent(email)}&token=${token}`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ZenLootX <no-reply@zenlootexchange.com>',
        to: email,
        subject: 'Reset your ZenLootX password',
        html: `
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:480px;margin:0 auto;background:#0A0E0C;color:#E8EDE9;padding:40px 32px;border-radius:12px;">
            <div style="font-size:22px;font-weight:700;margin-bottom:6px;">Zen<span style="color:#19C37D;">Loot</span>X</div>
            <hr style="border:none;border-top:1px solid #232B26;margin:18px 0;">
            <h2 style="font-size:20px;font-weight:700;margin:0 0 12px;">Reset your password</h2>
            <p style="color:#9BA8A0;font-size:15px;line-height:1.7;margin:0 0 24px;">
              We received a request to reset the password for your ZenLootX account (<strong style="color:#E8EDE9;">${email}</strong>). Click the button below to set a new password.
            </p>
            <a href="${resetLink}" style="display:inline-block;padding:14px 28px;background:#19C37D;color:#0A0E0C;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;">
              Reset password →
            </a>
            <p style="color:#6B776F;font-size:13px;margin-top:24px;line-height:1.6;">
              This link expires in <strong style="color:#E8EDE9;">15 minutes</strong>. If you did not request a password reset, you can safely ignore this email — your account has not been changed.
            </p>
            <hr style="border:none;border-top:1px solid #232B26;margin:24px 0 14px;">
            <p style="font-size:12px;color:#6B776F;">© 2026 ZenLootX · zenlootexchange.com</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return Response.json({ error: err.message || 'Failed to send email.' }, { status: 500 });
    }

    return Response.json({ sent: true });

  } catch (e) {
    return Response.json({ error: 'Server error.' }, { status: 500 });
  }
}
