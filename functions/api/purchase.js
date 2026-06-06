import { sendPushToUser } from './push-helper.js';

export async function onRequestPost({ request, env }) {
  try {
    // Verify auth
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { listingId } = await request.json();
    if (!listingId) return Response.json({ error: 'Missing listingId' }, { status: 400 });

    if (user.app_metadata?.is_frozen) {
      return Response.json({ error: 'Your account is currently restricted. You cannot make purchases.' }, { status: 403 });
    }

    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };

    // Atomic purchase — acquires row locks on listing + wallet, deducts balance,
    // marks listing sold, and creates order all inside one DB transaction.
    // Prevents double-spend even when two requests arrive simultaneously.
    const rpcRes = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/purchase_listing`, {
      method: 'POST',
      headers: { ...hdr, Prefer: 'return=representation' },
      body: JSON.stringify({ p_buyer_id: user.id, p_listing_id: listingId }),
    });

    if (!rpcRes.ok) {
      const rpcErr = await rpcRes.json().catch(() => ({}));
      return Response.json({ error: rpcErr.message || 'Purchase failed. Please try again.' }, { status: 500 });
    }

    const rpcData = await rpcRes.json();

    if (rpcData.error) {
      return Response.json({
        error: rpcData.error,
        needTopUp: rpcData.needTopUp || false,
      }, { status: rpcData.needTopUp ? 422 : 400 });
    }

    const orderId  = rpcData.orderId;
    const sellerId = rpcData.sellerId;
    const price    = Number(rpcData.price);
    const title    = rpcData.title;

    // Update seller's escrow balance
    try {
      const swRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/wallets?user_id=eq.${sellerId}&select=escrow`, { headers: hdr });
      const swData = await swRes.json();
      if (swData[0]) {
        await fetch(`${env.SUPABASE_URL}/rest/v1/wallets?user_id=eq.${sellerId}`, {
          method: 'PATCH', headers: hdr,
          body: JSON.stringify({ escrow: Number(swData[0].escrow || 0) + price }),
        });
      } else {
        await fetch(`${env.SUPABASE_URL}/rest/v1/wallets`, {
          method: 'POST', headers: hdr,
          body: JSON.stringify({ user_id: sellerId, balance: 0, escrow: price, total_earned: 0 }),
        });
      }
      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers: hdr,
        body: JSON.stringify({
          user_id:     sellerId,
          type:        'escrow',
          amount:      price,
          description: `Sale in escrow: ${title}`,
          reference:   orderId || null,
          status:      'pending',
        }),
      });
    } catch {}

    // Log buyer transaction
    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers: hdr,
        body: JSON.stringify({
          user_id:     user.id,
          type:        'escrow',
          amount:      price,
          description: `Purchase held in escrow: ${title}`,
          reference:   orderId || null,
          status:      'pending',
        }),
      });
    } catch {}

    // Create or find conversation
    let conversationId = null;
    try {
      const cRes  = await fetch(
        `${env.SUPABASE_URL}/rest/v1/conversations?buyer_id=eq.${user.id}&seller_id=eq.${sellerId}&listing_id=eq.${listingId}&limit=1`,
        { headers: hdr }
      );
      const cData = await cRes.json();
      if (cData[0]) {
        conversationId = cData[0].id;
      } else {
        const ncRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/conversations`, {
          method: 'POST',
          headers: { ...hdr, Prefer: 'return=representation' },
          body: JSON.stringify({
            buyer_id:   user.id,
            seller_id:  sellerId,
            order_id:   orderId || null,
            listing_id: listingId,
          }),
        });
        const ncData = await ncRes.json();
        conversationId = (Array.isArray(ncData) ? ncData[0] : ncData)?.id || null;
      }
    } catch {}

    // Welcome message
    if (conversationId) {
      try {
        await fetch(`${env.SUPABASE_URL}/rest/v1/messages`, {
          method: 'POST',
          headers: hdr,
          body: JSON.stringify({
            conversation_id: conversationId,
            sender_id:       user.id,
            content:         `__system__ 🎉 Thank you for doing business on ZenLootX. The seller will deliver your account details shortly. Feel free to ask any questions here — we're happy to help make this a smooth experience for both of you.`,
          }),
        });
      } catch {}
    }

    // In-app notification to seller
    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST', headers: hdr,
        body: JSON.stringify({
          user_id: sellerId,
          title:   '🎉 Your listing was purchased!',
          message: `"${title}" was bought for ₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}. Deliver the account details to complete the order.`,
          type:    'listing',
          link:    '/orders',
        }),
      });
    } catch {}

    // Push notification to seller
    sendPushToUser(sellerId, env, {
      title: '🎉 Your listing was purchased!',
      body:  `"${title}" sold for ₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}. Deliver the account to complete the order.`,
      url:   '/orders',
    }).catch(() => {});

    // Email notification to seller
    try {
      const sellerAuthRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${sellerId}`, {
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY },
      });
      const sellerAuth  = await sellerAuthRes.json();
      const sellerEmail = sellerAuth?.email;
      const sellerName  = sellerAuth?.user_metadata?.username || 'Seller';
      const fmt         = n => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

      if (sellerEmail) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:    'ZenLootX <no-reply@zenlootexchange.com>',
            to:      [sellerEmail],
            subject: `🎉 Your listing was just purchased — ZenLootX`,
            html: `
              <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0A0E0C;color:#E8EDE9;padding:40px 32px;border-radius:12px;">
                <div style="font-size:24px;font-weight:700;margin-bottom:6px;">Zen<span style="color:#19C37D;">Loot</span>X</div>
                <hr style="border:none;border-top:1px solid #232B26;margin:20px 0;">
                <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">Your listing was just sold! 🎉</h2>
                <p style="font-size:15px;color:#9BA8A0;line-height:1.7;margin-bottom:20px;">
                  Hi <strong style="color:#E8EDE9;">${sellerName}</strong>, a buyer has just purchased your listing.
                </p>
                <div style="background:#121814;border:1px solid #232B26;border-radius:10px;padding:20px 22px;margin-bottom:24px;">
                  <div style="font-size:13px;color:#6B776F;margin-bottom:6px;">Listing sold</div>
                  <div style="font-size:17px;font-weight:700;color:#E8EDE9;margin-bottom:4px;">${title}</div>
                  <div style="font-size:22px;font-weight:700;color:#19C37D;">${fmt(price)}</div>
                </div>
                <p style="font-size:14px;color:#9BA8A0;line-height:1.7;margin-bottom:8px;">
                  The payment is held in escrow. Please deliver the account credentials to the buyer via Messages as soon as possible.
                </p>
                <a href="https://zenlootexchange.com/orders" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#19C37D;color:#0A0E0C;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px;">View Order →</a>
                <hr style="border:none;border-top:1px solid #232B26;margin:28px 0 16px;">
                <p style="font-size:12px;color:#6B776F;">© 2026 ZenLootX · zenlootexchange.com</p>
              </div>`,
          }),
        });
      }
    } catch {}

    return Response.json({
      success:        true,
      orderId,
      conversationId,
      sellerId,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
