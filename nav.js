// Shared navigation dropdown — single source of truth for all pages.
// Requires: `sb` (Supabase client) defined globally on the page before calling initNav.
// Usage: await initNav(user)

async function initNav(user) {
  const username = user.user_metadata?.username || user.email.split('@')[0];
  const initial  = username.charAt(0).toUpperCase();
  const avatar   = user.user_metadata?.avatar_url;

  const { data: _sa } = await sb.from('seller_applications').select('status').eq('user_id', user.id).eq('status','approved').maybeSingle();
  const isSeller = !!_sa;

  const el = document.getElementById('navActions');
  if (!el) return;

  el.innerHTML = `
    <div class="user-menu" id="userMenu">
      <button class="user-btn" id="userBtn" style="display:flex;align-items:center;gap:8px;background:var(--bg-elevated);border:1px solid var(--border-hi);border-radius:8px;padding:8px 14px;cursor:pointer;font-family:'Geist',sans-serif;font-size:14px;font-weight:500;color:var(--text);transition:border-color 0.18s;">
        <div class="user-avatar" style="width:26px;height:26px;border-radius:50%;background:var(--accent-glow);border:1.5px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--accent);flex-shrink:0;overflow:hidden;">${avatar ? `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : initial}</div>
        ${username}
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
      </button>
      <div class="user-dropdown" id="userDropdown" style="display:none;position:absolute;top:calc(100% + 8px);right:0;background:var(--bg-surface);border:1px solid var(--border);border-radius:10px;min-width:210px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4);z-index:200;">
        <div style="padding:12px 16px;font-size:12px;color:var(--text-faint);border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.email}</div>

        <a href="/profile" style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:14px;color:var(--text-dim);cursor:pointer;transition:background 0.16s,color 0.16s;text-decoration:none;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>
          View Profile
        </a>
        <a href="/account" style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:14px;color:var(--text-dim);cursor:pointer;transition:background 0.16s,color 0.16s;text-decoration:none;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
          My account
        </a>

        <div style="height:1px;background:var(--border);margin:4px 0;"></div>

        <a href="/orders" style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:14px;color:var(--text-dim);cursor:pointer;transition:background 0.16s,color 0.16s;text-decoration:none;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"/></svg>
          Orders
        </a>
        <a href="/messages" style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:14px;color:var(--text-dim);cursor:pointer;transition:background 0.16s,color 0.16s;text-decoration:none;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"/></svg>
          Messages
        </a>
        <a href="/notifications" style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:14px;color:var(--text-dim);cursor:pointer;transition:background 0.16s,color 0.16s;text-decoration:none;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/></svg>
          Notifications
        </a>
        <a href="/wallet" style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:14px;color:var(--text-dim);cursor:pointer;transition:background 0.16s,color 0.16s;text-decoration:none;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"/></svg>
          Wallet
        </a>

        <div style="height:1px;background:var(--border);margin:4px 0;"></div>

        <a href="/listings/genshin" style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:14px;color:var(--text-dim);cursor:pointer;transition:background 0.16s,color 0.16s;text-decoration:none;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/></svg>
          View listings
        </a>
        ${(isSeller || user.app_metadata?.is_admin) ? `
        <a href="/create-listing" style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:14px;color:var(--text-dim);cursor:pointer;transition:background 0.16s,color 0.16s;text-decoration:none;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L9.568 3Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z"/></svg>
          List an item
        </a>` : `
        <a href="/sell" style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:14px;color:var(--text-dim);cursor:pointer;transition:background 0.16s,color 0.16s;text-decoration:none;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"/></svg>
          Become a seller
        </a>`}
        ${user.app_metadata?.is_admin ? `
        <div style="height:1px;background:var(--border);margin:4px 0;"></div>
        <a href="/admin" style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:14px;color:#F87171;cursor:pointer;transition:background 0.16s;text-decoration:none;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"/></svg>
          Admin Dashboard
        </a>` : ''}

        <div style="height:1px;background:var(--border);margin:4px 0;"></div>
        <button id="navLogoutBtn" style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:14px;color:#EF4444;cursor:pointer;transition:background 0.16s;background:none;border:none;font-family:'Geist',sans-serif;width:100%;text-align:left;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25"/></svg>
          Sign out
        </button>
      </div>
    </div>`;

  // Hover styles via JS (since inline styles can't handle :hover)
  el.querySelectorAll('a[href], button#navLogoutBtn').forEach(item => {
    item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-elevated)'; item.style.color = item.style.color || 'var(--text)'; });
    item.addEventListener('mouseleave', () => { item.style.background = ''; });
  });

  // Toggle open/close
  const userBtn      = document.getElementById('userBtn');
  const userDropdown = document.getElementById('userDropdown');
  const userMenu     = document.getElementById('userMenu');

  if (userMenu) userMenu.style.position = 'relative';

  userBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = userDropdown.style.display === 'block';
    userDropdown.style.display = open ? 'none' : 'block';
  });
  document.addEventListener('click', e => {
    if (userMenu && !userMenu.contains(e.target)) userDropdown.style.display = 'none';
  });

  document.getElementById('navLogoutBtn').addEventListener('click', async () => {
    localStorage.removeItem('zlx_session_row');
    await sb.auth.signOut();
    window.location.href = '/login';
  });
}
