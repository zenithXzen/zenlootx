// Called automatically by a Supabase DB trigger whenever orders.escrow_status = 'released'.
// Congratulates the seller and tells them funds are available to withdraw.

import { sendPushToUser } from '../push-helper.js';

// ── Main handler ──────────────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  try {
    // Verify the shared secret Supabase sends with every trigger call
    const hookSecret = request.headers.get('x-hook-secret');
    if (!hookSecret || hookSecret !== env.HOOK_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, sellerId, listingId, amount, currency } = await request.json();
    if (!orderId || !sellerId) return Response.json({ error: 'Missing fields' }, { status: 400 });

    // Fetch listing title for a personalised message
    let listingTitle = 'Your listing';
    try {
      const r = await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=title`, {
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY },
      });
      const rows = await r.json();
      if (rows[0]?.title) listingTitle = `"${rows[0].title}"`;
    } catch {}

    const formatted = amount
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0 }).format(amount)
      : '';

    const title   = '🎉 Your listing sold!';
    const message = `Congratulations! ${listingTitle} was sold${formatted ? ` for ${formatted}` : ''}. Your funds are now available to withdraw.`;

    // Insert in-app notification
    await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ user_id: sellerId, title, message, type: 'listing', link: '/wallet' }),
    });

    // Send device push if seller has a subscription
    await sendPushToUser(sellerId, env, { title, body: message, url: '/wallet' });

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
