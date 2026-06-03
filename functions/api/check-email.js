export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return Response.json({ exists: false });
    }

    const res = await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users?filter=email.eq.${encodeURIComponent(email)}&page=1&per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          apikey: env.SUPABASE_SERVICE_KEY,
        },
      }
    );

    const data = await res.json();
    const exists = Array.isArray(data.users) && data.users.some(u => u.email === email);

    return Response.json({ exists });

  } catch {
    return Response.json({ exists: false });
  }
}
