// Shared helpers for functions/api/admin/*.js — avoids the same admin-check /
// audit-log / wallet-mutation logic being copy-pasted across every endpoint.

export async function verifyAdmin(token, env) {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.app_metadata?.is_admin === true ? user : null;
  } catch { return null; }
}

export async function logAdminAction(env, adminId, action, targetId, targetType, details = {}) {
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

export async function notify(env, userId, title, message, link) {
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

export function sb(env, path, opts = {}) {
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

// Atomically adjusts a wallet's spendable balance via the increment_balance RPC,
// falling back to read-then-write only if the RPC itself is unavailable.
export async function incrementBalance(env, userId, delta) {
  const rpcRes = await sb(env, 'rpc/increment_balance', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: userId, p_amount: delta }),
  });
  if (rpcRes.ok) return;
  const curRes  = await sb(env, `wallets?user_id=eq.${userId}&select=balance`, { method: 'GET', headers: { Prefer: '' } });
  const curData = await curRes.json();
  const current = Number(curData?.[0]?.balance || 0);
  await sb(env, `wallets?user_id=eq.${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ balance: current + delta }),
  });
}
