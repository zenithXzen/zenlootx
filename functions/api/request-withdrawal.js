async function getUser(token, env) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  return res.json();
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

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const user  = await getUser(token, env);
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, method, details } = await request.json();
    if (!amount || amount < 100)            return Response.json({ error: 'Minimum withdrawal is ₱100.' }, { status: 400 });
    if (!method || !details)                return Response.json({ error: 'Missing method or details.' }, { status: 400 });

    // Read current balance and frozen status
    const walletRes  = await sb(env, `wallets?user_id=eq.${user.id}&select=balance,frozen`, { method: 'GET', headers: { Prefer: '' } });
    const walletData = await walletRes.json();
    const balance    = Number(walletData?.[0]?.balance || 0);
    const frozen     = walletData?.[0]?.frozen === true;

    if (user.app_metadata?.is_frozen) {
      return Response.json({ error: 'Your account is currently restricted. Withdrawals are disabled.' }, { status: 403 });
    }

    if (frozen) {
      return Response.json({ error: 'Your wallet is frozen due to an open dispute. Withdrawals are disabled until the dispute is resolved.' }, { status: 403 });
    }

    // Calculate how much is held (earned within last 72 hours — not yet withdrawable)
    const nowIso = new Date().toISOString();
    const heldRes  = await sb(env, `transactions?user_id=eq.${user.id}&hold_until=gt.${encodeURIComponent(nowIso)}&type=eq.credit&status=eq.completed&select=amount`, { method: 'GET', headers: { Prefer: '' } });
    const heldData = await heldRes.json().catch(() => []);
    const heldAmount  = Array.isArray(heldData) ? heldData.reduce((s, t) => s + Number(t.amount), 0) : 0;
    const available   = balance - heldAmount;

    if (available < amount) {
      if (heldAmount > 0) {
        return Response.json({
          error: `₱${heldAmount.toFixed(2)} of your balance is held for 72 hours after recent sales. Available to withdraw: ₱${Math.max(0, available).toFixed(2)}.`,
        }, { status: 422 });
      }
      return Response.json({ error: `Insufficient balance. Available: ₱${balance.toFixed(2)}.` }, { status: 422 });
    }

    // Freeze the amount immediately by deducting from balance
    const patchRes = await sb(env, `wallets?user_id=eq.${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ balance: balance - amount }),
    });
    if (!patchRes.ok) {
      return Response.json({ error: 'Failed to freeze balance. Please try again.' }, { status: 500 });
    }

    // Insert the withdrawal request — use return=representation to get back the ID
    const insertRes = await sb(env, 'withdrawal_requests', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: user.id,
        amount,
        method,
        details,
        status: 'pending',
      }),
    });
    if (!insertRes.ok) {
      // Rollback the balance deduction
      await sb(env, `wallets?user_id=eq.${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ balance }),
      });
      return Response.json({ error: 'Failed to submit request. Please try again.' }, { status: 500 });
    }

    const insertData   = await insertRes.json();
    const withdrawalId = Array.isArray(insertData) ? insertData[0]?.id : insertData?.id;

    // Log a pending transaction so it appears in wallet history immediately
    const METHOD_LABEL = { gcash:'GCash', maya:'Maya', bank:'Bank Transfer', wise:'Wise', binance:'Binance' };
    await sb(env, 'transactions', {
      method: 'POST',
      body: JSON.stringify({
        user_id:     user.id,
        type:        'debit',
        amount,
        description: `Withdrawal via ${METHOD_LABEL[method] || method} — awaiting approval`,
        reference:   withdrawalId,
        status:      'pending',
      }),
    });

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
