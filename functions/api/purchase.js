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

    const hdr = {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };

    // Get listing
    const lRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&status=eq.active&select=*`, { headers: hdr });
    const lData = await lRes.json();
    const listing = lData[0];
    if (!listing) return Response.json({ error: 'Listing not found or no longer available.' }, { status: 404 });
    if (listing.seller_id === user.id) return Response.json({ error: 'You cannot buy your own listing.' }, { status: 400 });

    const price = Number(listing.price);

    // Check buyer wallet balance
    const wRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/wallets?user_id=eq.${user.id}&select=balance`, { headers: hdr });
    const wData = await wRes.json();
    const balance = Number(wData[0]?.balance || 0);
    if (balance < price) {
      return Response.json({
        error: `Insufficient balance. You have ₱${balance.toFixed(2)} but this listing costs ₱${price.toFixed(2)}.`,
        needTopUp: true,
        shortfall: price - balance,
      }, { status: 422 });
    }

    // Deduct balance from buyer
    await fetch(`${env.SUPABASE_URL}/rest/v1/wallets?user_id=eq.${user.id}`, {
      method: 'PATCH', headers: hdr,
      body: JSON.stringify({ balance: balance - price }),
    });

    // Create order
    const oRes  = await fetch(`${env.SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: { ...hdr, Prefer: 'return=representation' },
      body: JSON.stringify({
        buyer_id:      user.id,
        seller_id:     listing.seller_id,
        listing_id:    listingId,
        amount:        price,
        currency:      listing.currency || 'PHP',
        escrow_status: 'holding',
      }),
    });
    if (!oRes.ok) {
      // Order creation failed — refund the buyer's balance
      await fetch(`${env.SUPABASE_URL}/rest/v1/wallets?user_id=eq.${user.id}`, {
        method: 'PATCH', headers: hdr,
        body: JSON.stringify({ balance: balance }),
      });
      const oErr = await oRes.json();
      return Response.json({ error: `Order creation failed: ${oErr?.message || oErr?.details || oRes.status}. Your balance has been refunded.` }, { status: 500 });
    }
    const oData = await oRes.json();
    const order = Array.isArray(oData) ? oData[0] : oData;
    if (!order?.id) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/wallets?user_id=eq.${user.id}`, {
        method: 'PATCH', headers: hdr,
        body: JSON.stringify({ balance: balance }),
      });
      return Response.json({ error: 'Order could not be saved. Please contact support.' }, { status: 500 });
    }

    // Mark listing as sold
    await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
      method: 'PATCH', headers: hdr,
      body: JSON.stringify({ status: 'sold' }),
    });

    // Log escrow transaction for buyer
    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id:     user.id,
          type:        'escrow',
          amount:      price,
          description: `Purchase held in escrow: ${listing.title}`,
          reference:   order?.id || null,
          status:      'pending',
        }),
      });
    } catch {}

    // Create conversation (if one doesn't already exist for this order pair)
    let conversationId = null;
    try {
      const cRes  = await fetch(
        `${env.SUPABASE_URL}/rest/v1/conversations?buyer_id=eq.${user.id}&seller_id=eq.${listing.seller_id}&listing_id=eq.${listingId}&limit=1`,
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
            seller_id:  listing.seller_id,
            order_id:   order?.id || null,
            listing_id: listingId,
          }),
        });
        const ncData = await ncRes.json();
        conversationId = (Array.isArray(ncData) ? ncData[0] : ncData)?.id || null;
      }
    } catch {}

    // Send automated welcome message in the conversation
    if (conversationId) {
      try {
        await fetch(`${env.SUPABASE_URL}/rest/v1/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({
            conversation_id: conversationId,
            sender_id:       user.id,
            content:         `__system__ 🎉 Thank you for doing business on ZenLootX. The seller will deliver your account details shortly. Feel free to ask any questions here — we're happy to help make this a smooth experience for both of you.`,
          }),
        });
      } catch {}
    }

    // Notify seller
    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST', headers: hdr,
        body: JSON.stringify({
          user_id: listing.seller_id,
          title:   '🎉 Your listing was purchased!',
          message: `"${listing.title}" was bought for ₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}. Deliver the account details to complete the order.`,
          type:    'listing',
          link:    '/orders',
        }),
      });
    } catch {}

    return Response.json({
      success:        true,
      orderId:        order?.id,
      conversationId,
      sellerId:       listing.seller_id,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
