const SUPABASE_URL  = 'https://msumlsqfergennhzxqon.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zdW1sc3FmZXJnZW5uaHp4cW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NTMwMzQsImV4cCI6MjA5NjAyOTAzNH0.Zz-YIzgk_QN0p0F9Sjbi8kPHUuuGylP6K7LIDbhhe-Q';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Read config from the app div
const app    = document.getElementById('app');
const GAME   = app.dataset.game;
const LABEL  = app.dataset.label;
const DESC   = app.dataset.desc;
const BG     = app.dataset.bg;
const BGPOS  = app.dataset.bgPos;
const TAGCLS = app.dataset.tagClass;
const ICON   = app.dataset.icon;

let activeFilter    = 'all';
let activeSort      = 'newest';
let minPrice        = '';
let maxPrice        = '';
let searchQuery     = '';
let attrFilters     = {};
let minFiveStars    = '';
let allListings     = null;
let displayCurrency = 'PHP';
let exchangeRates   = null;
const PAGE_SIZE     = 12;
let visibleCount    = PAGE_SIZE;

// Game-specific attribute filter definitions
// type:'min_number' = numeric >= filter; type:'select' (default) = exact match
const ATTR_FILTER_DEFS = {
  genshin: [
    { key:'server',          label:'Server',       options:['Asia','America','Europe','TW/HK/MO'] },
    { key:'five_star_count', label:'Min 5★ chars', type:'min_number', options:['5','10','20','30','50'] },
  ],
  mlbb: [
    { key:'season_rank',      label:'Rank',       options:['Warrior','Elite','Master','Grandmaster','Epic','Legend','Mythic','Mythical Glory','Mythical Immortal'] },
    { key:'server',           label:'Server',     options:['Southeast Asia','North America','Europe','Middle East','South Asia'] },
    { key:'collection_level', label:'Collection', options:['Renowned Collector I','Renowned Collector II','Renowned Collector III','Renowned Collector IV','Renowned Collector V','Exalted Collector I','Exalted Collector II','Exalted Collector III','Exalted Collector IV','Exalted Collector V','Mega Collector','World Collector'] },
  ],
  valorant: [
    { key:'rank',   label:'Rank',   options:['Unranked','Iron','Bronze','Silver','Gold','Platinum','Diamond','Ascendant','Immortal','Radiant'] },
    { key:'region', label:'Region', options:['NA','EU','APAC','KR','BR','LATAM','TR'] },
  ],
};

// ── Build page shell ──
document.title = `${LABEL} Listings — ZenLootX`;
document.body.innerHTML = `
  <nav>
    <div class="container">
      <div class="nav-inner">
        <a href="/" class="logo" style="display:flex;align-items:center;gap:8px;"><img src="/wallpaper/zx.png" alt="ZenLootX" style="height:32px;width:auto;"><span>Zen<span class="green">Loot</span>X</span></a>
        <div class="nav-actions" id="navActions">
          <a href="/login"    class="btn btn-secondary">Sign in</a>
          <a href="/register" class="btn btn-primary">Get started</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="game-banner" style="background-image:url('${BG}');background-position:${BGPOS};">
    <div class="container">
      <div class="banner-content">
        <a href="/" class="back-link">← Back to home</a>
        <div class="game-tag ${TAGCLS}">${LABEL}</div>
        <div class="banner-title">${LABEL}</div>
        <div class="banner-desc">${DESC}</div>
      </div>
    </div>
  </div>

  <div class="game-switcher">
    <div class="container">
      <div class="game-switcher-inner">
        <span class="game-sw-label">Games</span>
        <a href="/listings/genshin" class="game-sw-btn ${GAME === 'genshin' ? 'active' : ''}">
          <span class="game-sw-icon">✦</span> Genshin Impact
        </a>
        <a href="/listings/mlbb" class="game-sw-btn ${GAME === 'mlbb' ? 'active' : ''}">
          <span class="game-sw-icon">⚔</span> Mobile Legends
        </a>
        <a href="/listings/valorant" class="game-sw-btn ${GAME === 'valorant' ? 'active' : ''}">
          <span class="game-sw-icon">◈</span> Valorant
        </a>
      </div>
    </div>
  </div>

  <div class="toolbar">
    <div class="container">
      <!-- Search bar -->
      <div style="padding:12px 0 0;display:flex;align-items:center;gap:8px;">
        <div style="position:relative;flex:1;max-width:480px;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="15" height="15" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#6B776F;pointer-events:none;"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
          <input type="text" id="searchInput" placeholder="Search listings by title…" style="width:100%;background:#1A211C;border:1px solid #232B26;border-radius:8px;padding:9px 36px 9px 36px;font-family:'Geist',sans-serif;font-size:14px;color:#E8EDE9;outline:none;transition:border-color 0.18s;" onfocus="this.style.borderColor='#19C37D'" onblur="this.style.borderColor='#232B26'">
          <button id="clearSearch" style="display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#6B776F;font-size:16px;line-height:1;padding:2px 4px;">✕</button>
        </div>
        <span id="searchCount" style="font-size:13px;color:#6B776F;white-space:nowrap;"></span>
      </div>

      <div class="toolbar-inner" style="padding-top:10px;">
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
          <div class="filters">
            <span class="filter-label">Type:</span>
            <button class="filter-btn active" data-filter="all">All</button>
            <button class="filter-btn" data-filter="account">Account</button>
            ${GAME !== 'genshin' ? '<button class="filter-btn" data-filter="items">Items</button>' : ''}
            <button class="filter-btn" data-filter="topup">Top-up</button>
          </div>
          <!-- Game-specific attribute filters (single panel) -->
          ${(ATTR_FILTER_DEFS[GAME] || []).length ? `
          <div style="position:relative;" id="filterDropdown">
            <button id="filterToggleBtn" onclick="toggleFilterPanel(event)" style="display:flex;align-items:center;gap:8px;background:#1A211C;border:1px solid #232B26;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;color:#9BA8A0;transition:border-color 0.18s,color 0.18s;white-space:nowrap;font-family:inherit;">
              &#9881; Filters
              <span id="filterBadge" style="display:none;background:#19C37D;color:#0A0E0C;border-radius:999px;padding:1px 7px;font-size:11px;font-weight:700;line-height:1.4;">0</span>
            </button>
            <div id="filterPanel" style="display:none;position:absolute;top:calc(100% + 8px);left:0;background:#121814;border:1px solid #33403A;border-radius:12px;padding:20px;z-index:50;min-width:240px;box-shadow:0 8px 32px rgba(0,0,0,0.55);">
              ${(ATTR_FILTER_DEFS[GAME] || []).map(f => `
              <div style="margin-bottom:14px;">
                <div style="font-size:11px;font-weight:600;color:#6B776F;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em;">${f.label}</div>
                <select class="sort-select attr-filter-select" data-attr="${f.key}" data-filtertype="${f.type || 'select'}" style="width:100%;">
                  <option value="">Any</option>
                  ${f.options.map(o => `<option value="${o}">${f.type === 'min_number' ? o + '+' : o}</option>`).join('')}
                </select>
              </div>`).join('')}
              <button onclick="clearAttrFilters()" id="clearAttrBtn" style="display:none;width:100%;padding:8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#EF4444;font-family:inherit;">Clear filters</button>
            </div>
          </div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end;">
          <div class="price-range">
            <span class="filter-label">Price:</span>
            <input type="number" class="price-input" id="minPrice" placeholder="Min" min="0">
            <span class="price-sep">—</span>
            <input type="number" class="price-input" id="maxPrice" placeholder="Max" min="0">
            <button class="clear-price" id="clearPrice" style="display:none;">✕</button>
          </div>
          <select class="sort-select" id="currencySelect" title="Display currency">
            <option value="PHP">PHP</option>
            <option value="USD">USD</option>
            <option value="SGD">SGD</option>
            <option value="MYR">MYR</option>
            <option value="IDR">IDR</option>
            <option value="THB">THB</option>
            <option value="JPY">JPY</option>
            <option value="KRW">KRW</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
          <select class="sort-select" id="sortSelect">
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>
    </div>
  </div>

  <main>
    <div class="container">
      <div class="listings-grid" id="listingsGrid">
        ${[...Array(6)].map(() => `
          <div class="listing-card" style="pointer-events:none;">
            <div class="card-img skeleton" style="height:160px;"></div>
            <div class="card-body" style="gap:10px;display:flex;flex-direction:column;">
              <div class="skeleton" style="height:20px;width:60%;border-radius:6px;"></div>
              <div class="skeleton" style="height:14px;width:90%;border-radius:6px;"></div>
              <div class="skeleton" style="height:14px;width:70%;border-radius:6px;"></div>
              <div class="skeleton" style="height:24px;width:40%;border-radius:6px;margin-top:8px;"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  </main>

  <footer>
    <div class="container">
      <div class="footer-inner">
        <p>© 2026 ZenLootX</p>
        <div style="display:flex;gap:20px;">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
        </div>
      </div>
    </div>
  </footer>
`;

// ── Auth-aware nav ──
async function initNav() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname); return; }
  const user     = session.user;
  const username = user.user_metadata?.username || user.email.split('@')[0];
  const initial  = username.charAt(0).toUpperCase();
  const avatar   = user.user_metadata?.avatar_url;

  const isSeller = user.app_metadata?.is_seller === true;

  document.getElementById('navActions').innerHTML = `
    <div class="user-menu" id="userMenu">
      <button class="user-btn" id="userBtn">
        <div class="user-avatar">${avatar ? `<img src="${avatar}">` : initial}</div>
        ${username}
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      <div class="user-dropdown" id="userDropdown">
        <div class="dropdown-email">${user.email}</div>
        <a href="/profile" class="dropdown-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>
          View Profile
        </a>
        <a href="/account" class="dropdown-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
          My account
        </a>
        <div class="dropdown-divider"></div>
        <a href="/orders" class="dropdown-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"/></svg>
          Orders
        </a>
        <a href="/messages" class="dropdown-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"/></svg>
          Messages
        </a>
        <a href="/notifications" class="dropdown-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/></svg>
          Notifications
        </a>
        <a href="/wallet" class="dropdown-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"/></svg>
          Wallet
        </a>
        <div class="dropdown-divider"></div>
        ${(isSeller || user.app_metadata?.is_admin) ? `
        <a href="/seller-dashboard" class="dropdown-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/></svg>
          Seller Dashboard
        </a>
        <a href="/create-listing" class="dropdown-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L9.568 3Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z"/></svg>
          List an item
        </a>` : `
        <a href="/sell" class="dropdown-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"/></svg>
          Become a seller
        </a>`}
        ${user.app_metadata?.is_admin ? `
        <div class="dropdown-divider"></div>
        <a href="/admin" class="dropdown-item" style="color:#F87171;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"/></svg>
          Admin Dashboard
        </a>` : ''}
        <div class="dropdown-divider"></div>
        <button class="dropdown-item danger" id="navLogout">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25"/></svg>
          Sign out
        </button>
      </div>
    </div>
  `;
  document.getElementById('userBtn').addEventListener('click', () => document.getElementById('userDropdown').classList.toggle('open'));
  document.addEventListener('click', e => {
    const m = document.getElementById('userMenu');
    if (m && !m.contains(e.target)) document.getElementById('userDropdown').classList.remove('open');
  });
  document.getElementById('navLogout').addEventListener('click', async () => {
    localStorage.removeItem('zlx_session_row');
    await sb.auth.signOut();
    window.location.href = '/login';
  });
}

// ── Exchange rates ──
async function fetchExchangeRates() {
  try {
    const res  = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data.result === 'success') exchangeRates = data.rates;
  } catch {}
}

function convertPrice(amount, fromCurrency) {
  if (!exchangeRates) return { value: amount, currency: fromCurrency };
  const rateFrom = exchangeRates[fromCurrency] || exchangeRates['USD'] || 1;
  const rateTo   = exchangeRates[displayCurrency] || 1;
  return { value: amount * (rateTo / rateFrom), currency: displayCurrency };
}

function formatPrice(amount, fromCurrency) {
  const { value, currency } = convertPrice(amount, fromCurrency);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === 'JPY' || currency === 'KRW' || currency === 'IDR' ? 0 : 2,
  }).format(value);
  return currency !== fromCurrency ? `≈ ${formatted}` : formatted;
}

// ── Fetch & render listings ──
async function fetchAllListings() {
  const { data, error } = await sb
    .from('listings')
    .select('id, title, price, currency, type, images, created_at, seller_id, attributes')
    .eq('game', GAME)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error || !data?.length) return error ? [] : [];

  // Batch fetch all unique seller profiles in one query
  const sellerIds = [...new Set(data.map(l => l.seller_id))];
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, username, avatar_url, avg_rating, review_count')
    .in('id', sellerIds);

  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.id] = p; });

  return data.map(l => ({ ...l, seller: profileMap[l.seller_id] || null }));
}

function applyFilters(listings) {
  let result = [...listings];

  if (activeFilter !== 'all') result = result.filter(l => l.type === activeFilter);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(l => l.title.toLowerCase().includes(q));
  }

  // Attribute filters — exact match (select type)
  Object.entries(attrFilters).forEach(([key, val]) => {
    if (!val) return;
    result = result.filter(l => {
      const attr = l.attributes?.[key];
      return attr && String(attr).toLowerCase() === val.toLowerCase();
    });
  });

  // Min 5-star count filter (Genshin, numeric >=)
  if (minFiveStars !== '') {
    result = result.filter(l => Number(l.attributes?.five_star_count || 0) >= Number(minFiveStars));
  }

  if (minPrice !== '') result = result.filter(l => Number(l.price) >= parseFloat(minPrice));
  if (maxPrice !== '') result = result.filter(l => Number(l.price) <= parseFloat(maxPrice));

  if (activeSort === 'price_asc')  result.sort((a, b) => a.price - b.price);
  if (activeSort === 'price_desc') result.sort((a, b) => b.price - a.price);

  return result;
}

function typeLabel(t) {
  return { account: 'Account', items: 'Items', topup: 'Top-up' }[t] || t;
}

function typePill(t) {
  const cls = { account: 'pill-account', items: 'pill-items', topup: 'pill-topup' }[t] || '';
  return `<span class="pill ${cls}">${typeLabel(t)}</span>`;
}

function renderCard(listing) {
  const img   = Array.isArray(listing.images) && listing.images[0]
    ? `<img src="${listing.images[0]}" alt="${listing.title}" loading="lazy">`
    : `<span class="fallback">${ICON}</span>`;

  const price = formatPrice(listing.price, listing.currency || 'USD');

  return `
    <div class="listing-card">
      <a href="/listings/detail?id=${listing.id}">
        <div class="card-img">${img}</div>
        <div class="card-body">
          <div class="card-tags">
            ${typePill(listing.type)}
          </div>
          <div class="card-title">${listing.title}</div>
          <div class="card-footer">
            <div class="card-price">${price}</div>
            <div class="card-seller">
              <div class="seller-av">${listing.seller?.avatar_url ? `<img src="${listing.seller.avatar_url}" alt="${listing.seller.username}">` : `<span>${(listing.seller?.username || 'S').charAt(0).toUpperCase()}</span>`}</div>
              <div style="min-width:0;">
                <div style="font-size:13px;font-weight:600;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${listing.seller?.username || 'Seller'}</div>
                <div style="line-height:1.3;margin-top:2px;">
                  ${listing.seller?.avg_rating > 0
                    ? `<span style="color:#F5B947;font-weight:700;font-size:14px;">★ ${listing.seller.avg_rating}</span><span style="color:var(--text-faint);font-size:11px;"> (${listing.seller.review_count})</span>`
                    : `<span style="color:#F5B947;font-size:14px;letter-spacing:1px;">☆☆☆☆☆</span>`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </a>
    </div>
  `;
}

async function render() {
  const grid  = document.getElementById('listingsGrid');

  // Fetch once from DB, then filter client-side
  if (allListings === null) {
    allListings = await fetchAllListings();
  }

  const listings = applyFilters(allListings);

  // Show/hide clear button
  const clearBtn = document.getElementById('clearPrice');
  if (clearBtn) clearBtn.style.display = (minPrice !== '' || maxPrice !== '') ? 'inline' : 'none';


  // Update search result count
  const countEl = document.getElementById('searchCount');
  if (countEl) {
    const total = (allListings || []).length;
    countEl.textContent = searchQuery || Object.values(attrFilters).some(v => v)
      ? `${listings.length} of ${total} listing${total !== 1 ? 's' : ''}`
      : '';
  }

  if (listings.length === 0) {
    const hasAnyFilter = minPrice !== '' || maxPrice !== '' || searchQuery || Object.values(attrFilters).some(v => v);
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">${ICON}</div>
        <h2>${searchQuery ? `No results for "${searchQuery}"` : hasAnyFilter ? 'No listings match your filters' : 'No listings yet'}</h2>
        <p>${hasAnyFilter ? 'Try adjusting your search or filters.' : `Be the first to list a ${LABEL} account or item. Sellers get paid once the buyer confirms.`}</p>
        <div class="empty-actions">
          ${hasAnyFilter ? `<button class="btn btn-secondary" onclick="clearAllFilters()">Clear all filters</button>` : `<a href="/register" class="btn btn-primary">Start selling</a>`}
          <a href="/" class="btn btn-secondary">Back to home</a>
        </div>
      </div>
    `;
    return;
  }

  const page = listings.slice(0, visibleCount);
  const hasMore = listings.length > visibleCount;

  grid.innerHTML = page.map(renderCard).join('') + (hasMore ? `
    <div style="grid-column:1/-1;text-align:center;padding:8px 0 4px;">
      <button class="btn btn-secondary" id="loadMoreBtn" onclick="loadMore()" style="min-width:160px;">
        Load more <span style="color:var(--text-faint);font-weight:400;">(${listings.length - visibleCount} remaining)</span>
      </button>
    </div>` : '');
}

function loadMore() {
  visibleCount += PAGE_SIZE;
  render();
  // Scroll to where new cards start
  const btn = document.getElementById('loadMoreBtn');
  if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetPagination() { visibleCount = PAGE_SIZE; }

// ── Filter + Sort + Price events ──
document.addEventListener('click', e => {
  // Close filter panel when clicking outside
  if (!e.target.closest('#filterDropdown')) {
    const panel = document.getElementById('filterPanel');
    if (panel) panel.style.display = 'none';
  }
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  resetPagination(); render();
});

document.addEventListener('change', e => {
  if (e.target.id === 'sortSelect')    { activeSort = e.target.value; resetPagination(); render(); }
  if (e.target.id === 'currencySelect') { displayCurrency = e.target.value; render(); }
  if (e.target.classList.contains('attr-filter-select')) {
    if (e.target.dataset.filtertype === 'min_number') {
      minFiveStars = e.target.value;
    } else {
      attrFilters[e.target.dataset.attr] = e.target.value;
    }
    updateFilterBadge();
    resetPagination(); render();
  }
});

let searchTimer = null;
document.addEventListener('input', e => {
  if (e.target.id === 'searchInput') {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = e.target.value.trim();
      const clearBtn = document.getElementById('clearSearch');
      if (clearBtn) clearBtn.style.display = searchQuery ? 'block' : 'none';
      resetPagination(); render();
    }, 250);
  }
});

document.addEventListener('click', e => {
  if (e.target.id === 'clearSearch') {
    searchQuery = '';
    const inp = document.getElementById('searchInput');
    if (inp) inp.value = '';
    e.target.style.display = 'none';
    render();
  }
});

let priceTimer = null;
document.addEventListener('input', e => {
  if (e.target.id === 'minPrice' || e.target.id === 'maxPrice') {
    clearTimeout(priceTimer);
    priceTimer = setTimeout(() => {
      minPrice = document.getElementById('minPrice').value;
      maxPrice = document.getElementById('maxPrice').value;
      render();
    }, 400);
  }
});

document.addEventListener('click', e => {
  if (e.target.id === 'clearPrice') clearPriceFilter();
});

function clearPriceFilter() {
  minPrice = ''; maxPrice = '';
  const mn = document.getElementById('minPrice');
  const mx = document.getElementById('maxPrice');
  if (mn) mn.value = '';
  if (mx) mx.value = '';
  render();
}

function toggleFilterPanel(e) {
  if (e) e.stopPropagation();
  const panel = document.getElementById('filterPanel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function clearAttrFilters() {
  attrFilters = {};
  minFiveStars = '';
  document.querySelectorAll('.attr-filter-select').forEach(s => s.value = '');
  updateFilterBadge();
  resetPagination(); render();
}

function updateFilterBadge() {
  const count = Object.values(attrFilters).filter(v => v).length + (minFiveStars ? 1 : 0);
  const badge    = document.getElementById('filterBadge');
  const btn      = document.getElementById('filterToggleBtn');
  const clearBtn = document.getElementById('clearAttrBtn');
  if (badge)    { badge.textContent = count; badge.style.display = count ? 'inline-flex' : 'none'; }
  if (btn)      { btn.style.borderColor = count ? '#19C37D' : '#232B26'; btn.style.color = count ? '#19C37D' : '#9BA8A0'; }
  if (clearBtn) { clearBtn.style.display = count ? 'block' : 'none'; }
}

function clearAllFilters() {
  searchQuery = ''; attrFilters = {}; minFiveStars = ''; minPrice = ''; maxPrice = '';
  const inp = document.getElementById('searchInput');
  if (inp) inp.value = '';
  const clr = document.getElementById('clearSearch');
  if (clr) clr.style.display = 'none';
  document.querySelectorAll('.attr-filter-select').forEach(s => s.value = '');
  updateFilterBadge();
  const mn = document.getElementById('minPrice'); if (mn) mn.value = '';
  const mx = document.getElementById('maxPrice'); if (mx) mx.value = '';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
  activeFilter = 'all';
  render();
}

// ── Realtime: remove sold/deleted listings instantly ──
function subscribeToListings() {
  sb.channel(`listings-game-${GAME}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'listings',
      filter: `game=eq.${GAME}`,
    }, async payload => {
      if (allListings === null) return; // still initial loading
      const { eventType, new: updated, old: removed } = payload;

      if (eventType === 'INSERT' && updated?.status === 'active') {
        const { data: profile } = await sb.from('profiles').select('id, username, avatar_url').eq('id', updated.seller_id).maybeSingle();
        allListings = [{ ...updated, seller: profile || null }, ...allListings];
        render();
      } else if (eventType === 'UPDATE') {
        if (updated?.status !== 'active') {
          // Sold or removed — drop from grid
          allListings = allListings.filter(l => l.id !== updated.id);
          render();
        } else {
          allListings = allListings.map(l => l.id === updated.id ? { ...l, ...updated } : l);
          render();
        }
      } else if (eventType === 'DELETE') {
        allListings = allListings.filter(l => l.id !== removed?.id);
        render();
      }
    })
    .subscribe();
}

// ── Init ──
initNav();
fetchExchangeRates().then(() => { render(); subscribeToListings(); });
