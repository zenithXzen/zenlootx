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

let activeFilter = 'all';
let activeSort   = 'newest';

// ── Build page shell ──
document.title = `${LABEL} Listings — ZenLootX`;
document.body.innerHTML = `
  <nav>
    <div class="container">
      <div class="nav-inner">
        <a href="/" class="logo">Zen<span class="green">Loot</span>X</a>
        <ul class="nav-links">
          <li><a href="/">Home</a></li>
          <li><a href="/#how">How it works</a></li>
          <li><a href="/#sell">Sell</a></li>
        </ul>
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

  <div class="toolbar">
    <div class="container">
      <div class="toolbar-inner">
        <div class="filters">
          <span class="filter-label">Type:</span>
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="account">Account</button>
          <button class="filter-btn" data-filter="items">Items</button>
          <button class="filter-btn" data-filter="topup">Top-up</button>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="result-count" id="resultCount"></span>
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
  if (!session) return;
  const user     = session.user;
  const username = user.user_metadata?.username || user.email.split('@')[0];
  const initial  = username.charAt(0).toUpperCase();
  const avatar   = user.user_metadata?.avatar_url;

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
        <a href="/account" class="dropdown-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>
          My account
        </a>
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

// ── Fetch & render listings ──
async function fetchListings() {
  let query = sb
    .from('listings')
    .select('id, title, price, currency, type, images, created_at, seller_id')
    .eq('game', GAME)
    .eq('status', 'active');

  if (activeFilter !== 'all') query = query.eq('type', activeFilter);

  if (activeSort === 'newest')     query = query.order('created_at', { ascending: false });
  if (activeSort === 'price_asc')  query = query.order('price', { ascending: true });
  if (activeSort === 'price_desc') query = query.order('price', { ascending: false });

  const { data, error } = await query;
  return error ? [] : (data || []);
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

  const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: listing.currency || 'USD', minimumFractionDigits: 0 }).format(listing.price);

  return `
    <div class="listing-card">
      <a href="/listings/detail?id=${listing.id}">
        <div class="card-img">${img}</div>
        <div class="card-body">
          <div class="card-tags">
            <span class="game-tag ${TAGCLS}" style="margin-bottom:0;">${LABEL}</span>
            ${typePill(listing.type)}
          </div>
          <div class="card-title">${listing.title}</div>
          <div class="card-footer">
            <div class="card-price">${price}</div>
            <div class="card-seller">
              <div class="seller-av">?</div>
              <div class="seller-name">Seller</div>
            </div>
          </div>
        </div>
      </a>
    </div>
  `;
}

async function render() {
  const listings = await fetchListings();
  const grid     = document.getElementById('listingsGrid');
  const count    = document.getElementById('resultCount');

  count.textContent = listings.length > 0 ? `${listings.length} listing${listings.length === 1 ? '' : 's'}` : '';

  if (listings.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">${ICON}</div>
        <h2>No listings yet</h2>
        <p>Be the first to list a ${LABEL} account or item. Sellers get paid once the buyer confirms.</p>
        <div class="empty-actions">
          <a href="/register" class="btn btn-primary">Start selling</a>
          <a href="/" class="btn btn-secondary">Back to home</a>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = listings.map(renderCard).join('');
}

// ── Filter + Sort events ──
document.addEventListener('click', e => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  render();
});

document.addEventListener('change', e => {
  if (e.target.id === 'sortSelect') {
    activeSort = e.target.value;
    render();
  }
});

// ── Init ──
initNav();
render();
