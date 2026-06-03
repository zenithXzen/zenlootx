export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { username } = await request.json();
    if (!username) return Response.json({ email: null });

    let page = 1;
    while (true) {
      const res = await fetch(
        `${env.SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`,
        {
          headers: {
            Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            apikey: env.SUPABASE_SERVICE_KEY,
          },
        }
      );
      const data = await res.json();
      if (!data.users || data.users.length === 0) break;

      for (const user of data.users) {
        const meta = user.user_metadata || {};
        if (meta.username && meta.username.toLowerCase() === username.toLowerCase()) {
          return Response.json({ email: user.email });
        }
      }

      if (data.users.length < 1000) break;
      page++;
    }

    return Response.json({ email: null });

  } catch {
    return Response.json({ email: null });
  }
}
