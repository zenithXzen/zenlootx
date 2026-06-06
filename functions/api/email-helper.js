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
  return `<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0A0E0C;color:#E8EDE9;padding:40px 32px;border-radius:12px;">
    <div style="font-size:24px;font-weight:700;margin-bottom:6px;">Zen<span style="color:#19C37D;">Loot</span>X</div>
    <hr style="border:none;border-top:1px solid #232B26;margin:20px 0;">
    ${content}
    <hr style="border:none;border-top:1px solid #232B26;margin:28px 0 16px;">
    <p style="font-size:12px;color:#6B776F;">© 2026 ZenLootX · zenlootexchange.com</p>
  </div>`;
}
