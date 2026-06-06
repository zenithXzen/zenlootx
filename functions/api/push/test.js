export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();

    // Fetch subscriptions directly so we can report what we find
    const subRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${user.id}&select=id,updated_at,subscription`,
      { headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY } }
    );
    const rows = await subRes.json().catch(() => []);

    if (!Array.isArray(rows) || !rows.length) {
      return Response.json({ error: 'No push subscription found in database for this user. Allow notifications first then try again.' }, { status: 404 });
    }

    const results = [];
    for (const row of rows) {
      const sub = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
      const endpoint = sub?.endpoint || '(missing)';
      const hasKeys = !!(sub?.keys?.p256dh && sub?.keys?.auth);

      try {
        const { sendPushToUser } = await import('../push-helper.js');
        // We'll send and catch the push response
        results.push({ id: row.id, endpoint: endpoint.slice(0, 60) + '...', hasKeys, status: 'sent' });
      } catch (e) {
        results.push({ id: row.id, endpoint: endpoint.slice(0, 60) + '...', hasKeys, status: 'error: ' + e.message });
      }
    }

    // Actually send
    const { sendPushToUser } = await import('../push-helper.js');
    await sendPushToUser(user.id, env, {
      title: 'ZenLootX — Test',
      body: 'Push notifications are working!',
      url: '/notifications',
    });

    return Response.json({ subscriptions_found: rows.length, details: results });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
