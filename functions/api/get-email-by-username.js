export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { username } = await request.json();
    if (!username) return Response.json({ email: null });

    // Call the Supabase SQL function directly
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_email_by_username`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uname: username }),
    });

    if (!res.ok) return Response.json({ email: null });

    const email = await res.json();
    return Response.json({ email: email || null });

  } catch {
    return Response.json({ email: null });
  }
}
