// Performs the full username login server-side so the email is never sent to the browser.
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return Response.json({ error: 'Missing fields.' }, { status: 400 });
    }

    // Look up email by username server-side — never returned to client
    const rpcRes = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_email_by_username`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uname: username }),
    });

    if (!rpcRes.ok) return Response.json({ error: 'server_error' }, { status: 500 });

    const email = await rpcRes.json();
    if (!email) return Response.json({ error: 'not_found' }, { status: 404 });

    // Sign in server-side using the resolved email
    const signInRes = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!signInRes.ok) {
      return Response.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    const session = await signInRes.json();

    // Return only session tokens — email stays on the server
    return Response.json({
      access_token:  session.access_token,
      refresh_token: session.refresh_token,
      expires_at:    session.expires_at,
    });

  } catch {
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}
