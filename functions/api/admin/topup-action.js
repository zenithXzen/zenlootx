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
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const isAdmin = await verifyAdmin(token, env);
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

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
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const isAdmin = await verifyAdmin(token, env);
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

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
          type:        'credit',
          amount:      Number(amount),
          description: action === 'approve'
            ? `Top-up via ${label}`
            : `Top-up rejected via ${label}`,
          reference:   id,
          status:      action === 'approve' ? 'completed' : 'failed',
        }),
      });
    }

    const fmt = n => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
    if (action === 'approve') {
      await notify(env, userId, '✅ Funds added', `${fmt(amount)} has been added to your ZenLootX wallet.`);
    } else {
      await notify(env, userId, 'Top-up rejected', `Your top-up request of ${fmt(amount)} was not approved.`);
    }

    return Response.json({ success: true, status: newStatus });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
