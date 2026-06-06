// Shared navigation dropdown — single source of truth for all pages.
// Requires: `sb` (Supabase client) defined globally on the page before calling initNav.
// Usage: await initNav(user)

// ─── Toast ────────────────────────────────────────────────────────
function toast(message, type = 'error') {
  let container = document.getElementById('zlx-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'zlx-toast-container';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }
  if (!document.getElementById('zlx-toast-style')) {
    const s = document.createElement('style');
    s.id = 'zlx-toast-style';
    s.textContent = '@keyframes zlx-in{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}@keyframes zlx-out{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(14px)}}@keyframes zlx-overlay-in{from{opacity:0}to{opacity:1}}@keyframes zlx-modal-in{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}';
    document.head.appendChild(s);
  }
  const cfg = {
    error:   { border:'#EF4444', icon:'✕', iconBg:'rgba(239,68,68,0.12)', iconColor:'#F87171' },
    success: { border:'#19C37D', icon:'✓', iconBg:'rgba(25,195,125,0.12)', iconColor:'#19C37D' },
    info:    { border:'#9BA8A0', icon:'i', iconBg:'rgba(107,119,111,0.15)', iconColor:'#9BA8A0' },
  }[type] || { border:'#EF4444', icon:'✕', iconBg:'rgba(239,68,68,0.12)', iconColor:'#F87171' };

  const el = document.createElement('div');
  el.style.cssText = `display:flex;align-items:flex-start;gap:10px;padding:13px 16px;background:#1A211C;border:1px solid #232B26;border-left:3px solid ${cfg.border};border-radius:10px;max-width:320px;min-width:220px;box-shadow:0 4px 24px rgba(0,0,0,0.5);pointer-events:all;cursor:pointer;animation:zlx-in 0.22s ease;`;
  el.innerHTML = `<span style="width:18px;height:18px;border-radius:50%;background:${cfg.iconBg};border:1px solid ${cfg.border}33;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${cfg.iconColor};flex-shrink:0;margin-top:1px;">${cfg.icon}</span><span style="font-size:13px;color:#E8EDE9;line-height:1.5;flex:1;">${message}</span>`;
  container.appendChild(el);
  const dismiss = () => { el.style.animation = 'zlx-out 0.2s ease forwards'; setTimeout(() => el.remove(), 200); };
  setTimeout(dismiss, 4500);
  el.addEventListener('click', dismiss);
}

// ─── Confirm dialog ───────────────────────────────────────────────
function zConfirm(message, { title = 'Are you sure?', confirmText = 'Confirm', confirmDanger = false } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:9998;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(4px);animation:zlx-overlay-in 0.18s ease;';
    const confirmBg = confirmDanger ? '#EF4444' : '#19C37D';
    const confirmColor = confirmDanger ? '#fff' : '#0A0E0C';
    overlay.innerHTML = `<div style="background:#121814;border:1px solid #232B26;border-radius:12px;padding:28px;max-width:400px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,0.6);animation:zlx-modal-in 0.2s ease;"><h3 style="font-size:16px;font-weight:700;color:#E8EDE9;margin-bottom:10px;letter-spacing:-0.01em;">${title}</h3><p style="font-size:14px;color:#9BA8A0;line-height:1.6;margin-bottom:24px;">${message}</p><div style="display:flex;gap:10px;justify-content:flex-end;"><button id="zlx-c-cancel" style="padding:9px 18px;border-radius:8px;border:1px solid #33403A;background:transparent;color:#E8EDE9;font-family:'Geist',sans-serif;font-size:14px;font-weight:600;cursor:pointer;">Cancel</button><button id="zlx-c-ok" style="padding:9px 18px;border-radius:8px;border:none;background:${confirmBg};color:${confirmColor};font-family:'Geist',sans-serif;font-size:14px;font-weight:600;cursor:pointer;">${confirmText}</button></div></div>`;
    document.body.appendChild(overlay);
    const close = v => { overlay.remove(); resolve(v); };
    overlay.querySelector('#zlx-c-cancel').addEventListener('click', () => close(false));
    overlay.querySelector('#zlx-c-ok').addEventListener('click', () => close(true));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
  });
}

// ─── Prompt dialog ────────────────────────────────────────────────
function zPrompt(message, { title = '', placeholder = '', optional = false } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:9998;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(4px);animation:zlx-overlay-in 0.18s ease;';
    overlay.innerHTML = `<div style="background:#121814;border:1px solid #232B26;border-radius:12px;padding:28px;max-width:400px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,0.6);animation:zlx-modal-in 0.2s ease;">${title ? `<h3 style="font-size:16px;font-weight:700;color:#E8EDE9;margin-bottom:10px;letter-spacing:-0.01em;">${title}</h3>` : ''}<p style="font-size:14px;color:#9BA8A0;line-height:1.6;margin-bottom:16px;">${message}</p><input id="zlx-p-input" type="text" placeholder="${placeholder}" style="width:100%;background:#1A211C;border:1px solid #33403A;border-radius:8px;padding:10px 14px;font-family:'Geist',sans-serif;font-size:14px;color:#E8EDE9;outline:none;box-sizing:border-box;margin-bottom:20px;"><div style="display:flex;gap:10px;justify-content:flex-end;"><button id="zlx-p-cancel" style="padding:9px 18px;border-radius:8px;border:1px solid #33403A;background:transparent;color:#E8EDE9;font-family:'Geist',sans-serif;font-size:14px;font-weight:600;cursor:pointer;">Cancel</button><button id="zlx-p-ok" style="padding:9px 18px;border-radius:8px;border:none;background:#EF4444;color:#fff;font-family:'Geist',sans-serif;font-size:14px;font-weight:600;cursor:pointer;">Confirm</button></div></div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#zlx-p-input');
    input.focus();
    const close = v => { overlay.remove(); resolve(v); };
    overlay.querySelector('#zlx-p-cancel').addEventListener('click', () => close(null));
    overlay.querySelector('#zlx-p-ok').addEventListener('click', () => {
      const v = input.value.trim();
      if (!optional && !v) { input.style.borderColor = '#EF4444'; return; }
      close(v);
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') overlay.querySelector('#zlx-p-ok').click();
      if (e.key === 'Escape') close(null);
    });
  });
}

async function initNav(user) {
  const username = user.user_metadata?.username || user.email.split('@')[0];
  const initial  = username.charAt(0).toUpperCase();
  const avatar   = user.user_metadata?.avatar_url;

  const isSeller = user.app_metadata?.is_seller === true;

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
        <a href="/seller-dashboard" style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:14px;color:var(--text-dim);cursor:pointer;transition:background 0.16s,color 0.16s;text-decoration:none;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/></svg>
          Seller Dashboard
        </a>
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

  // Show frozen banner if account is restricted
  if (user.app_metadata?.is_frozen) {
    // Check frozen_until from profiles to show expiry
    sb.from('profiles').select('frozen_until').eq('id', user.id).maybeSingle().then(({ data }) => {
      const until = data?.frozen_until
        ? ` until ${new Date(data.frozen_until).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })}`
        : '';
      const banner = document.createElement('div');
      banner.id = 'frozenBanner';
      banner.style.cssText = 'background:rgba(245,185,71,0.08);border-bottom:1px solid rgba(245,185,71,0.25);padding:10px 24px;font-size:13px;color:var(--warning);text-align:center;';
      banner.innerHTML = `🔒 Your account is restricted${until}. You can browse but cannot list, buy, withdraw, or send messages.`;
      const nav = document.querySelector('nav');
      if (nav) nav.insertAdjacentElement('afterend', banner);
    });
  }

  // Push notifications — register service worker and subscribe if not already subscribed
  initPushSubscription(user).catch(() => {});

  // Message badge — skip on the messages page (it manages its own badge)
  if (!window.location.pathname.startsWith('/messages')) {
    initMsgBadge(user.id);
  }

  // Notification badge — skip on the notifications page (it manages its own)
  if (!window.location.pathname.startsWith('/notifications')) {
    initNotifBadge(user.id);
  }

  // Heartbeat — keeps last_active_at fresh so others see "Online" / "Last seen"
  startHeartbeat();
}

function startHeartbeat() {
  async function ping() {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.access_token) return;
      await fetch('/api/heartbeat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch {}
  }
  ping(); // immediate on load
  setInterval(ping, 60000); // then every 60 seconds
}

// ─── Last active label helper (used by messages + public-profile) ──
function lastActiveLabel(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 3)  return '<span style="color:var(--success);font-weight:600;">● Online</span>';
  if (mins < 60) return `<span style="color:var(--text-faint);">Last seen ${mins}m ago</span>`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `<span style="color:var(--text-faint);">Last seen ${hrs}h ago</span>`;
  const days = Math.floor(hrs / 24);
  return `<span style="color:var(--text-faint);">Last seen ${days}d ago</span>`;
}

async function initMsgBadge(userId) {
  function myUnreadCount(c) {
    if (c.buyer_id === userId) return c.buyer_unread_count || 0;
    if (c.seller_id === userId) return c.seller_unread_count || 0;
    return 0;
  }
  function totalUnread(convs) {
    return convs.reduce((sum, c) => sum + myUnreadCount(c), 0);
  }
  function setBadge(count) {
    document.querySelectorAll('.nav-msg-badge').forEach(el => el.remove());
    if (count <= 0) return;
    document.querySelectorAll('a[href="/messages"]').forEach(link => {
      const badge = document.createElement('span');
      badge.className = 'nav-msg-badge';
      badge.textContent = count;
      badge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;border-radius:999px;background:var(--accent);color:var(--bg-base);font-size:10px;font-weight:700;padding:0 4px;margin-left:5px;line-height:1;';
      link.appendChild(badge);
    });
  }

  // Use the same API as messages.html — bypasses RLS correctly
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) return;

  let convs = [];
  try {
    const res  = await fetch('/api/my-conversations', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    convs = data.conversations || [];
  } catch {}

  setBadge(totalUnread(convs));

  // Clear badge immediately when user clicks the Messages link
  document.querySelectorAll('a[href="/messages"]').forEach(link => {
    link.addEventListener('click', () => {
      convs.forEach(c => { c.buyer_unread_count = 0; c.seller_unread_count = 0; });
      setBadge(0);
      fetch('/api/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({}),
      }).catch(() => {});
    });
  });

  // Real-time: watch conversations for unread count updates
  function onConvUpdate(payload) {
    const updated = payload.new;
    const idx = convs.findIndex(c => c.id === updated.id);
    if (idx >= 0) convs[idx] = { ...convs[idx], ...updated };
    else convs.push(updated);
    setBadge(totalUnread(convs));
  }

  sb.channel(`nav-msg-buyer-${userId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `buyer_id=eq.${userId}` }, onConvUpdate)
    .subscribe();

  sb.channel(`nav-msg-seller-${userId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `seller_id=eq.${userId}` }, onConvUpdate)
    .subscribe();
}

async function doSubscribe() {
  const VAPID_PUBLIC = 'BKUJriuZ7hXGLjRGvL0uvAkUlIwZJTvbZv4XFaDZGhn7kF09FLORhRgVag3kkdC3tFuSNJBjMOW6tQjYGK37g5o';
  const p = '='.repeat((4 - VAPID_PUBLIC.length % 4) % 4);
  const key = Uint8Array.from(atob((VAPID_PUBLIC + p).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
}

async function initPushSubscription(user) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;

  // Register sw early so .ready resolves fast when needed
  navigator.serviceWorker.register('/sw.js').catch(() => {});

  // Already granted — just make sure we're subscribed
  if (Notification.permission === 'granted') {
    doSubscribe().catch(() => {});
    return;
  }

  // Already denied — can't do anything programmatically
  if (Notification.permission === 'denied') return;

  // 'default' — show banner; only fire the actual prompt on user tap
  if (localStorage.getItem('zlx-push-dismissed')) return;
  if (document.getElementById('push-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'push-banner';
  banner.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9999;background:#1A211C;border:1px solid #33403A;border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:calc(100vw - 32px);width:max-content;';
  banner.innerHTML = `
    <span style="font-size:20px">🔔</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:600;color:#E8EDE9">Enable notifications</div>
      <div style="font-size:12px;color:#9BA8A0;margin-top:1px">Get notified about orders, payments & disputes</div>
    </div>
    <button id="push-allow" style="background:#19C37D;color:#0A0E0C;border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;">Allow</button>
    <button id="push-dismiss" style="background:none;border:none;cursor:pointer;color:#6B776F;padding:4px;font-size:18px;line-height:1;flex-shrink:0;">✕</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('push-dismiss').addEventListener('click', () => {
    localStorage.setItem('zlx-push-dismissed', '1');
    banner.remove();
  });
  document.getElementById('push-allow').addEventListener('click', async () => {
    banner.remove();
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') await doSubscribe();
    } catch {}
  });
}

async function initNotifBadge(userId) {
  function setBadge(count) {
    document.querySelectorAll('.nav-notif-badge').forEach(el => el.remove());
    if (count <= 0) return;
    document.querySelectorAll('a[href="/notifications"]').forEach(link => {
      const badge = document.createElement('span');
      badge.className = 'nav-notif-badge';
      badge.textContent = count;
      badge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;border-radius:999px;background:var(--accent);color:var(--bg-base);font-size:10px;font-weight:700;padding:0 4px;margin-left:5px;line-height:1;';
      link.appendChild(badge);
    });
  }

  async function fetchCount() {
    const { count } = await sb
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('read', false);
    return count || 0;
  }

  setBadge(await fetchCount());

  // Clear badge when user clicks Notifications link
  document.querySelectorAll('a[href="/notifications"]').forEach(link => {
    link.addEventListener('click', () => {
      setBadge(0);
      sb.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false).then(() => {});
    });
  });

  // Real-time: new notification inserted for this user
  sb.channel(`nav-notif-${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, async () => {
      setBadge(await fetchCount());
    })
    .subscribe((status) => {
      // Fallback poll every 30s if realtime isn't enabled on this table
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setInterval(async () => setBadge(await fetchCount()), 30000);
      }
    });
}
