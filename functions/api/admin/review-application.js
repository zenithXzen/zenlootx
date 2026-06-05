async function verifyAdmin(token, env) {
  try {
    const res  = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return false;
    const user = await res.json();
    return user?.app_metadata?.is_admin === true;
  } catch { return false; }
}

export async function onRequestPost({ request, env }) {
  try {
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const isAdmin = await verifyAdmin(token, env);
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { applicationId, userId, action, reason } = await request.json();
    if (!applicationId || !userId || !['approve', 'reject'].includes(action)) {
      return Response.json({ error: 'Missing or invalid fields' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const patchBody = {
      status:      newStatus,
      reviewed_at: new Date().toISOString(),
      ...(action === 'reject' && reason ? { rejection_reason: reason } : {}),
    };

    const patchRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/seller_applications?id=eq.${applicationId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(patchBody),
      }
    );
    if (!patchRes.ok) return Response.json({ error: await patchRes.text() }, { status: patchRes.status });

    await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ app_metadata: { is_seller: action === 'approve' } }),
    });

    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };

    if (action === 'approve') {
      // In-app notification
      await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST', headers: hdr,
        body: JSON.stringify({
          user_id: userId,
          title:   '🎉 You are now a verified seller!',
          message: 'Your seller application has been approved. You can now list your game accounts, items, and top-ups on ZenLootX.',
          type:    'application',
          link:    '/create-listing',
          read:    false,
        }),
      });

      // Email notification via Resend
      try {
        const userRes  = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY },
        });
        const userData = await userRes.json();
        const email    = userData?.email;
        const username = userData?.user_metadata?.username || 'Seller';

        if (email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from:    'ZenLootX <no-reply@zenlootexchange.com>',
              to:      [email],
              subject: '🎉 You are now a verified seller on ZenLootX!',
              html: `
                <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0A0E0C;color:#E8EDE9;padding:40px 32px;border-radius:12px;">
                  <div style="font-size:24px;font-weight:700;margin-bottom:6px;">Zen<span style="color:#19C37D;">Loot</span>X</div>
                  <hr style="border:none;border-top:1px solid #232B26;margin:20px 0;">
                  <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">Congratulations, ${username}! 🎉</h2>
                  <p style="font-size:15px;color:#9BA8A0;line-height:1.7;margin-bottom:20px;">
                    Your seller application has been reviewed and <strong style="color:#19C37D;">approved</strong>. You are now a verified seller on ZenLootX.
                  </p>
                  <div style="background:#121814;border:1px solid #232B26;border-radius:10px;padding:20px 22px;margin-bottom:24px;">
                    <div style="font-size:13px;color:#6B776F;margin-bottom:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">What you can do now</div>
                    <div style="font-size:14px;color:#9BA8A0;line-height:1.9;">
                      ✅ List your Genshin Impact, MLBB, and Valorant accounts<br>
                      ✅ Sell items and top-ups<br>
                      ✅ Receive escrow-protected payments
                    </div>
                  </div>
                  <a href="https://zenlootexchange.com/create-listing" style="display:inline-block;padding:12px 24px;background:#19C37D;color:#0A0E0C;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px;">Create your first listing →</a>
                  <hr style="border:none;border-top:1px solid #232B26;margin:28px 0 16px;">
                  <p style="font-size:12px;color:#6B776F;">© 2026 ZenLootX · zenlootexchange.com</p>
                </div>`,
            }),
          });
        }
      } catch {}
    } else {
      // Rejected — in-app notification
      await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST', headers: hdr,
        body: JSON.stringify({
          user_id: userId,
          title:   'Seller application not approved',
          message: reason
            ? `Your application was not approved: ${reason}. You may re-apply with updated information.`
            : 'Your seller application was not approved. You may re-apply with updated information or contact support.',
          type:    'application',
          link:    '/sell',
          read:    false,
        }),
      });
    }

    return Response.json({ success: true, status: newStatus });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
