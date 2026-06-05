export async function onRequest({ request, env, next }) {
  // Pass through if maintenance mode is off
  if (env.MAINTENANCE_MODE !== 'true') return next();

  const url = new URL(request.url);

  // Always allow static assets so the maintenance page renders correctly
  if (/\.(png|jpg|jpeg|webp|gif|ico|svg|css|js|woff|woff2|ttf)$/.test(url.pathname)) {
    return next();
  }

  // Admin bypass: visiting /?admin=on sets a cookie that skips maintenance
  if (url.searchParams.get('admin') === 'on') {
    const res = await next();
    const headers = new Headers(res.headers);
    headers.set('Set-Cookie', 'zlx_admin_bypass=1; Path=/; Max-Age=86400; SameSite=Strict');
    return new Response(res.body, { status: res.status, headers });
  }

  // Allow admin bypass via cookie
  const cookies = request.headers.get('Cookie') || '';
  if (cookies.includes('zlx_admin_bypass=1')) return next();

  // Serve maintenance page for everyone else
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="/wallpaper/zx.png" type="image/png">
  <title>ZenLootX — Maintenance</title>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:#0A0E0C;color:#E8EDE9;font-family:'Geist',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;-webkit-font-smoothing:antialiased}
    .logo{font-size:24px;font-weight:700;letter-spacing:-0.02em;margin-bottom:40px}
    .logo span{color:#19C37D}
    .icon{width:64px;height:64px;border-radius:16px;background:rgba(25,195,125,0.1);border:1px solid rgba(25,195,125,0.2);display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 24px}
    h1{font-size:26px;font-weight:700;letter-spacing:-0.02em;margin-bottom:12px}
    p{font-size:15px;color:#9BA8A0;max-width:400px;line-height:1.7;margin-bottom:8px}
    .badge{display:inline-flex;align-items:center;gap:6px;background:rgba(245,185,71,0.1);border:1px solid rgba(245,185,71,0.25);color:#F5B947;font-size:12px;font-weight:600;padding:5px 14px;border-radius:999px;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:32px}
    .dot{width:6px;height:6px;border-radius:50%;background:#F5B947;animation:pulse 1.6s ease infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
    .footer{position:fixed;bottom:24px;font-size:12px;color:#6B776F}
  </style>
</head>
<body>
  <div class="logo">Zen<span>Loot</span>X</div>
  <div class="icon">🔧</div>
  <div class="badge"><span class="dot"></span>Maintenance in progress</div>
  <h1>We'll be back soon</h1>
  <p>ZenLootX is currently undergoing scheduled maintenance. The site will be back up shortly.</p>
  <p>We apologize for the inconvenience.</p>
  <div class="footer">ZENLOOTX ONLINE SHOP · DTI Reg. No. 8247950</div>
</body>
</html>`, {
    status: 503,
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Retry-After': '3600',
    },
  });
}
