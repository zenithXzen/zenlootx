async function verifyAdmin(token, env) {
  try {
    const res  = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return false;
    return (await res.json())?.app_metadata?.is_admin === true;
  } catch { return false; }
}

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!await verifyAdmin(token, env)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { userId, action, duration, deductAmount, deductReason } = await request.json();
    if (!userId || !['freeze', 'unfreeze'].includes(action)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const isFreezing = action === 'freeze';

    // Calculate frozen_until from duration string
    let frozenUntil = null;
    if (isFreezing && duration && duration !== 'permanent') {
      const now = new Date();
      const map = { '1h':1*60*60*1000, '24h':24*60*60*1000, '3d':3*24*60*60*1000, '7d':7*24*60*60*1000, '30d':30*24*60*60*1000 };
      if (map[duration]) frozenUntil = new Date(now.getTime() + map[duration]).toISOString();
    }
    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };

    await Promise.all([
      // 1. Mark profile as frozen with optional expiry
      fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH', headers: hdr,
        body: JSON.stringify({ is_frozen: isFreezing, frozen_until: isFreezing ? frozenUntil : null }),
      }),

      // 2. Set app_metadata so the JWT carries frozen status on next refresh
      fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_metadata: { is_frozen: isFreezing } }),
      }),

      // 3. Notify the user
      fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST', headers: hdr,
        body: JSON.stringify({
          user_id: userId,
          title:   isFreezing ? '🔒 Account restricted' : '✅ Account restriction lifted',
          message: isFreezing
            ? `Your account has been temporarily restricted by an admin${frozenUntil ? ` until ${new Date(frozenUntil).toLocaleString('en-PH', {dateStyle:'medium',timeStyle:'short'})}` : ' indefinitely'}. You can still browse but cannot list, buy, withdraw, or message until the restriction is lifted.`
            : 'Your account restriction has been lifted. All features are now available again.',
          type: 'general', link: '/', read: false,
        }),
      }),
    ]);

    // Optional: deduct from seller balance (e.g. dispute refund penalty)
    if (isFreezing && deductAmount && Number(deductAmount) > 0) {
      const walletRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/wallets?user_id=eq.${userId}&select=balance`, {
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY },
      });
      const walletData = await walletRes.json();
      const balance    = Number(walletData?.[0]?.balance || 0);
      const newBalance = Math.max(0, balance - Number(deductAmount));
      await fetch(`${env.SUPABASE_URL}/rest/v1/wallets?user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: { ...hdr },
        body: JSON.stringify({ balance: newBalance }),
      });
      // Log deduction transaction
      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers: { ...hdr },
        body: JSON.stringify({
          user_id:     userId,
          type:        'debit',
          amount:      Number(deductAmount),
          description: deductReason || 'Deduction — dispute penalty',
          status:      'completed',
        }),
      });
    }

    return Response.json({ success: true, action });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
