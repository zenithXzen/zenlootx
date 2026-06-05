export async function onRequestPost({ request, env }) {
  try {
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();
    if (!user?.id || !user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const username = user.user_metadata?.username || user.email.split('@')[0];

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'ZenLootX <no-reply@zenlootexchange.com>',
        to:      [user.email],
        subject: 'Your seller application was received — ZenLootX',
        html: `
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0A0E0C;color:#E8EDE9;padding:40px 32px;border-radius:12px;">
            <div style="font-size:24px;font-weight:700;margin-bottom:6px;">Zen<span style="color:#19C37D;">Loot</span>X</div>
            <hr style="border:none;border-top:1px solid #232B26;margin:20px 0;">
            <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">Application received ✅</h2>
            <p style="font-size:15px;color:#9BA8A0;line-height:1.7;margin-bottom:20px;">
              Hi <strong style="color:#E8EDE9;">${username}</strong>, we've received your seller application and our team is reviewing it.
            </p>
            <div style="background:#121814;border:1px solid #232B26;border-radius:10px;padding:20px 22px;margin-bottom:24px;">
              <div style="font-size:13px;font-weight:600;color:#6B776F;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">What happens next</div>
              <div style="display:flex;flex-direction:column;gap:10px;">
                <div style="font-size:14px;color:#9BA8A0;"><span style="color:#19C37D;font-weight:700;">1.</span> Our team reviews your submitted ID and information.</div>
                <div style="font-size:14px;color:#9BA8A0;"><span style="color:#19C37D;font-weight:700;">2.</span> We'll email you with the result within 1–2 business days.</div>
                <div style="font-size:14px;color:#9BA8A0;"><span style="color:#19C37D;font-weight:700;">3.</span> Once approved, you can start listing your game accounts.</div>
              </div>
            </div>
            <p style="font-size:13px;color:#6B776F;line-height:1.6;">
              If you have questions, reply to this email or contact us at
              <a href="mailto:support@zenlootexchange.com" style="color:#19C37D;">support@zenlootexchange.com</a>.
            </p>
            <hr style="border:none;border-top:1px solid #232B26;margin:24px 0 16px;">
            <p style="font-size:12px;color:#6B776F;">© 2026 ZenLootX · zenlootexchange.com</p>
          </div>`,
      }),
    });

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
