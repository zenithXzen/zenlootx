import { verifyAdmin, logAdminAction } from './_shared.js';
import { sendPushToUsers } from '../push-helper.js';

// ── Main ──────────────────────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const admin = await verifyAdmin(token, env);
    if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { title, message, type = 'announcement', link = '/notifications', userId = null } = await request.json();
    if (!title || !message) return Response.json({ error: 'Missing title or message' }, { status: 400 });

    // Insert into notifications table (userId null = broadcast visible to everyone)
    await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ user_id: userId, title, message, type, link }),
    });

    // Send push to subscriber(s) — userId null = broadcast to everyone
    const { sent, total } = await sendPushToUsers(userId, env, { title, body: message, url: link });

    await logAdminAction(env, admin.id, 'send_notification', userId || null, userId ? 'user' : 'broadcast', { title });
    return Response.json({ success: true, dbInserted: true, pushSent: sent, totalSubs: total });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
