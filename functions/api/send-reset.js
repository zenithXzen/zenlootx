export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Invalid email.' }, { status: 400 });
    }

    // Signed reset token valid for 15 minutes
    const window  = Math.floor(Date.now() / 900000);
    const message = `reset:${email}:${window}`;
    const secret  = env.HMAC_SECRET || 'zenlootx-default-secret';
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
        from: 'noreply@zenlootexchange.com',
        to: email,
        subject: 'Reset your ZenLootX password',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0A0E0C;padding:40px;border-radius:12px">
            <h2 style="color:#E8EDE9;margin:0 0 16px">Reset your password</h2>
            <p style="color:#9BA8A0;margin:0 0 24px">
              We detected 6 failed sign-in attempts on your account. Click the button below to reset your password.
            </p>
            <a href="${resetLink}"
               style="display:inline-block;padding:14px 28px;background:#19C37D;color:#0A0E0C;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none">
              Reset password
            </a>
            <p style="color:#6B776F;font-size:13px;margin-top:24px">
              This link expires in 15 minutes. If you didn't try to sign in, you can ignore this email — your account is safe.
            </p>
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
