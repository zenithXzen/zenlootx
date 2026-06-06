import { sendPushToUser } from '../push-helper.js';

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();

    await sendPushToUser(user.id, env, {
      title: 'ZenLootX — Test notification',
      body:  'Push notifications are working correctly.',
      url:   '/notifications',
    });

    return Response.json({ sent: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
