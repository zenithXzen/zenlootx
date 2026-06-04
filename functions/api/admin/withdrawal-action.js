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

// GET ?list=1  →  return all withdrawal_requests
export async function onRequestGet({ request, env }) {
  try {
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const isAdmin = await verifyAdmin(token, env);
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const res  = await sb(env, 'withdrawal_requests?order=created_at.desc', { method: 'GET', headers: { Prefer: '' } });
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

    const { id, userId, amount, action } = await request.json();
    if (!id || !userId || !['approve', 'reject'].includes(action)) {
      return Response.json({ error: 'Missing or invalid fields' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Balance was already frozen (deducted) when the request was submitted.
    // On approve: nothing to do to balance (it's already deducted).
    // On reject: refund the frozen amount back to the user.
    if (action === 'reject') {
      const walletRes  = await sb(env, `wallets?user_id=eq.${userId}&select=balance`, { method: 'GET', headers: { Prefer: '' } });
      const walletData = await walletRes.json();
      const balance    = Number(walletData?.[0]?.balance || 0);
      await sb(env, `wallets?user_id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ balance: balance + Number(amount) }),
      });
    }

    // Mark the request
    const patchRes = await sb(env, `withdrawal_requests?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus, reviewed_at: new Date().toISOString() }),
    });
    if (!patchRes.ok) return Response.json({ error: await patchRes.text() }, { status: patchRes.status });

    // Log transaction on approve
    if (action === 'approve') {
      let method = null;
      try {
        const wReqRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/withdrawal_requests?id=eq.${id}&select=method`, {
          headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY },
        });
        const wReqData = await wReqRes.json();
        method = wReqData[0]?.method;
      } catch {}
      const METHOD_LABEL = { gcash:'GCash', maya:'Maya', bank:'Bank Transfer', wise:'Wise', binance:'Binance' };
      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id:     userId,
          type:        'debit',
          amount:      Number(amount),
          description: `Withdrawal via ${METHOD_LABEL[method] || method || 'payout'}`,
          reference:   id,
          status:      'completed',
        }),
      });
    }

    const fmt = n => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
    if (action === 'approve') {
      await notify(env, userId, '💸 Withdrawal approved', `Your withdrawal of ${fmt(amount)} has been processed and sent to your account.`);
    } else {
      await notify(env, userId, 'Withdrawal rejected', `Your withdrawal of ${fmt(amount)} was not approved. Your balance has been refunded.`);
    }

    return Response.json({ success: true, status: newStatus });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
