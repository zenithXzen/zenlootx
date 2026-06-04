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

    const formData = await request.formData();
    const file     = formData.get('file');
    const docType  = formData.get('type'); // front | back | verification

    if (!file || !docType) return Response.json({ error: 'Missing file or type' }, { status: 400 });
    if (!['front', 'back', 'verification'].includes(docType)) {
      return Response.json({ error: 'Invalid document type' }, { status: 400 });
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      return Response.json({ error: 'Invalid file type. Use JPG, PNG, WebP, or PDF.' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'File must be under 10 MB.' }, { status: 400 });
    }

    const ext  = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1];
    const path = `${user.id}/${docType}.${ext}`;

    const uploadRes = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/id_documents/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey:        env.SUPABASE_SERVICE_KEY,
          'Content-Type': file.type,
          'x-upsert':    'true',
        },
        body: file.stream(),
        duplex: 'half',
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      return Response.json({ error: err.message || 'Upload failed' }, { status: 400 });
    }

    return Response.json({ path });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
