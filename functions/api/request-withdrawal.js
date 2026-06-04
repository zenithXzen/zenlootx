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

    if (frozen) {
      return Response.json({ error: 'Your wallet is frozen due to an open dispute. Withdrawals are disabled until the dispute is resolved.' }, { status: 403 });
    }

    if (balance < amount) {
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

    // Insert the withdrawal request
    const insertRes = await sb(env, 'withdrawal_requests', {
      method: 'POST',
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

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
