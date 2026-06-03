function isAdmin(payload) {
  return payload?.app_metadata?.is_admin === true;
}

function decodeToken(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch { return null; }
}

export async function onRequestPost({ request, env }) {
  try {
    const token   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const payload = decodeToken(token);
    if (!payload || !isAdmin(payload)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { path } = await request.json();
    if (!path) return Response.json({ error: 'Missing path' }, { status: 400 });

    const res = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/sign/id_documents/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: 3600 }),
      }
    );

    const data = await res.json();
    if (!res.ok) return Response.json({ error: data }, { status: res.status });

    const signedUrl = data.signedURL || data.signedUrl || '';
    return Response.json({ url: `${env.SUPABASE_URL}/storage/v1${signedUrl}` });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
