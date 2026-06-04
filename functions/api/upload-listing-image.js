async function verifyUser(token, env) {
  try {
    const res  = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const user  = await verifyUser(token, env);
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isSeller = user.app_metadata?.is_seller === true || user.app_metadata?.is_admin === true;
    if (!isSeller) return Response.json({ error: 'Seller account required' }, { status: 403 });

    const formData = await request.formData();
    const file     = formData.get('file');
    const path     = formData.get('path');

    if (!file || !path) return Response.json({ error: 'Missing file or path' }, { status: 400 });

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return Response.json({ error: 'Invalid file type. Use JPG, PNG, or WebP.' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: 'Image must be under 5 MB.' }, { status: 400 });
    }

    // Enforce path is scoped to this user
    if (!path.startsWith(user.id + '/')) {
      return Response.json({ error: 'Invalid path' }, { status: 400 });
    }

    const uploadRes = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/listing-images/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey:        env.SUPABASE_SERVICE_KEY,
          'Content-Type': file.type,
          'x-upsert':    'false',
        },
        body: file.stream(),
        duplex: 'half',
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      return Response.json({ error: err.message || 'Upload failed' }, { status: 400 });
    }

    const url = `${env.SUPABASE_URL}/storage/v1/object/public/listing-images/${path}`;
    return Response.json({ url });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
