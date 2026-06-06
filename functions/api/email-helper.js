const FROM = 'ZenLootX <no-reply@zenlootexchange.com>';

export async function getUserInfo(userId, env) {
  try {
    const res  = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY },
    });
    const data = await res.json();
    return { email: data?.email || null, name: data?.user_metadata?.username || 'there' };
  } catch { return { email: null, name: 'there' }; }
}

export async function sendEmail(env, { to, subject, html }) {
  if (!to || !env.RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
}

export function wrap(content) {
  return `
  <div style="background:#060908;padding:32px 16px;">
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0A0E0C;color:#E8EDE9;padding:48px 40px;border-radius:16px;border:1px solid #1A211C;">
      <div style="margin-bottom:8px;">
        <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">Zen<span style="color:#19C37D;">Loot</span>X</span>
      </div>
      <p style="font-size:12px;color:#6B776F;margin:0 0 28px;">Secure game account marketplace</p>
      <hr style="border:none;border-top:1px solid #232B26;margin:0 0 32px;">
      ${content}
      <hr style="border:none;border-top:1px solid #232B26;margin:36px 0 24px;">
      <p style="font-size:12px;color:#6B776F;margin:0;line-height:1.8;">© 2026 ZenLootX &nbsp;·&nbsp; <a href="https://zenlootexchange.com" style="color:#6B776F;text-decoration:none;">zenlootexchange.com</a></p>
    </div>
  </div>`;
}
