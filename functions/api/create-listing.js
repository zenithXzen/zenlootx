async function verifyUser(token, env) {
  try {
    const res  = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function sb(env, path, opts = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      Authorization:  `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey:         env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer:         'return=representation',
      ...(opts.headers || {}),
    },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const user  = await verifyUser(token, env);
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isSeller = user.app_metadata?.is_seller === true || user.app_metadata?.is_admin === true;
    if (!isSeller) return Response.json({ error: 'Seller account required' }, { status: 403 });

    if (user.app_metadata?.is_frozen) {
      return Response.json({ error: 'Your account is restricted. You cannot create listings.' }, { status: 403 });
    }

    const { game, title, type, price, currency, description, images, attributes } = await request.json();

    if (!game || !title?.trim() || !type || !price || !Array.isArray(images) || !images.length) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (Number(price) <= 0) {
      return Response.json({ error: 'Price must be greater than zero' }, { status: 400 });
    }

    // Insert listing
    const lRes  = await sb(env, 'listings', {
      method: 'POST',
      body: JSON.stringify({
        seller_id:   user.id,
        game,
        title:       title.trim(),
        type,
        price:       Number(price),
        currency:    currency || 'PHP',
        description: description?.trim() || null,
        images,
        status:      'active',
        attributes:  attributes || {},
      }),
    });

    if (!lRes.ok) {
      const err = await lRes.json().catch(() => ({}));
      return Response.json({ error: err.message || 'Failed to create listing' }, { status: 400 });
    }

    const lData   = await lRes.json();
    const listing = Array.isArray(lData) ? lData[0] : lData;
    if (!listing?.id) return Response.json({ error: 'Failed to create listing' }, { status: 500 });

    // Notify seller
    await sb(env, 'notifications', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: user.id,
        title:   '🏷️ Listing published',
        message: `Your listing "${title.trim()}" is now live and visible to buyers.`,
        type:    'listing',
        link:    `/listings/detail?id=${listing.id}`,
        read:    false,
      }),
    });

    return Response.json({ id: listing.id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
