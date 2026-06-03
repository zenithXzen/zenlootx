export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { username, userId } = await request.json();

    if (!username || username.length < 3) {
      return Response.json({ available: false, error: 'Username must be at least 3 characters.' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return Response.json({ available: false, error: 'Only letters, numbers, and underscores allowed.' });
    }

    // Fetch all users and check metadata for matching username
    let page = 1;
    let found = false;

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
        if (user.id === userId) continue; // skip self
        const meta = user.user_metadata || user.raw_user_meta_data || {};
        const storedUsername = meta.username || '';
        if (storedUsername.toLowerCase() === username.toLowerCase()) {
          found = true;
          break;
        }
      }
      if (found || data.users.length < 1000) break;
      page++;
    }

    return Response.json({ available: !found });

  } catch {
    return Response.json({ available: false, error: 'Server error.' });
  }
}
