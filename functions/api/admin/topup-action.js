async function verifyAdmin(token, env) {
  try {
    const res  = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.app_metadata?.is_admin === true ? user : null;
  } catch { return null; }
}

async function logAdminAction(env, adminId, action, targetId, targetType, details = {}) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/admin_logs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ admin_id: adminId, action, target_id: targetId ? String(targetId) : null, target_type: targetType, details }),
  }).catch(() => {});
}

async function notify(env, userId, title, message, link = '/wallet') {
  await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ user_id: userId, title, message, type: 'general', link, read: false }),
  });
}

function sb(env, path, opts = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(opts.headers || {}),
    },
  });
}

// GET ?list=1  →  return all topup_requests enriched with user info
export async function onRequestGet({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const admin = await verifyAdmin(token, env);
    if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const res  = await sb(env, 'topup_requests?order=created_at.desc', { method: 'GET', headers: { Prefer: '' } });
    const data = await res.json();

    return Response.json({ requests: Array.isArray(data) ? data : [] });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST  { id, userId, amount, action: 'approve'|'reject' }
export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const admin = await verifyAdmin(token, env);
    if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { id, userId, amount, action, method: bodyMethod } = await request.json();
    if (!id || !userId || !['approve', 'reject'].includes(action)) {
      return Response.json({ error: 'Missing or invalid fields' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Mark the request
    const patchRes = await sb(env, `topup_requests?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus, reviewed_at: new Date().toISOString() }),
    });
    if (!patchRes.ok) return Response.json({ error: await patchRes.text() }, { status: patchRes.status });

    // Credit wallet only on approve
    if (action === 'approve') {
      // Upsert wallet row in case it doesn't exist
      await sb(env, 'wallets', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify({ user_id: userId, balance: 0, escrow: 0, total_earned: 0 }),
      });
      // Increment balance via RPC
      const rpcRes = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/increment_balance`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_user_id: userId, p_amount: Number(amount) }),
      });
      if (!rpcRes.ok) {
        // Fallback: read current balance then add (never overwrite)
        const curRes  = await sb(env, `wallets?user_id=eq.${userId}&select=balance`, { method: 'GET', headers: { Prefer: '' } });
        const curData = await curRes.json();
        const current = Number(curData?.[0]?.balance || 0);
        await sb(env, `wallets?user_id=eq.${userId}`, {
          method: 'PATCH',
          body: JSON.stringify({ balance: current + Number(amount) }),
        });
      }
    }

    // Log transaction for both approve and reject
    {
      let method = bodyMethod;
      if (!method) {
        const tRes  = await sb(env, `topup_requests?id=eq.${id}&select=method`, { method: 'GET', headers: { Prefer: '' } });
        const tData = await tRes.json();
        method = tData[0]?.method;
      }
      const METHOD_LABEL = { gcash:'GCash', maya:'Maya', maribank:'Maribank', wise:'Wise', binance:'Binance' };
      const label = METHOD_LABEL[method] || method || 'payment';
      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id:     userId,
          type:        action === 'approve' ? 'credit' : 'debit',
          amount:      action === 'approve' ? Number(amount) : 0,
          description: action === 'approve'
            ? `Top-up via ${label}`
            : `Top-up rejected via ${label}`,
          reference:   id,
          status:      action === 'approve' ? 'completed' : 'rejected',
        }),
      });
    }

    const fmt = n => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
    const isBinanceMethod = bodyMethod === 'binance';
    if (action === 'approve') {
      await notify(env, userId, '✅ Funds added', `${fmt(amount)} has been added to your ZenLootX wallet.`);
    } else {
      const rejectMsg = isBinanceMethod
        ? `Your Binance (USDT) top-up request was not approved. Please contact support if you believe this is an error.`
        : `Your top-up request of ${fmt(amount)} was not approved.`;
      await notify(env, userId, 'Top-up rejected', rejectMsg);
    }

    await logAdminAction(env, admin.id, action === 'approve' ? 'topup_approve' : 'topup_reject', id, 'topup_request', { userId, amount: Number(amount) });
    return Response.json({ success: true, status: newStatus });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
