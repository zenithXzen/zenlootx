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

// Set by navigateToGame() on the page we're leaving, read here before the body
// is rebuilt below so the loading curtain can be present on the very first paint.
const navDir = sessionStorage.getItem('zl_nav_dir');

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
  ${navDir ? `<div id="zlCurtain" style="transform:translateX(0)"></div>` : ''}
  <nav>
    <div class="container">
      <div class="nav-inner">
        <a href="/" class="logo" style="display:flex;align-items:center;gap:8px;"><img src="/wallpaper/wow-logo-transparent.png" alt="ZenLootX" style="height:48px;width:auto;"></a>
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

// ── Game-category page transitions (swipe + tab click, via a full-screen loading curtain) ──
// A real cross-document navigation always has an unload→load gap that CSS can't slide past.
// Instead the curtain covers the screen *before* navigating, so that gap happens underneath
// it, then wipes away once the destination page's shell has been built.
const GAME_ORDER  = ['genshin', 'mlbb', 'valorant'];
const GAME_ROUTES = { genshin: '/listings/genshin', mlbb: '/listings/mlbb', valorant: '/listings/valorant' };
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const CURTAIN_COVER_MS = 220;

function navigateToGame(targetGame) {
  if (targetGame === GAME || !GAME_ROUTES[targetGame]) return;
  const direction = GAME_ORDER.indexOf(targetGame) > GAME_ORDER.indexOf(GAME) ? 'next' : 'prev';
  const url = GAME_ROUTES[targetGame];
  if (prefersReducedMotion) { window.location.href = url; return; }
  sessionStorage.setItem('zl_nav_dir', direction);
  const curtain = document.createElement('div');
  curtain.id = 'zlCurtain';
  curtain.className = direction === 'next' ? 'cover-next' : 'cover-prev';
  document.body.appendChild(curtain);
  setTimeout(() => { window.location.href = url; }, CURTAIN_COVER_MS);
}

// If we just arrived via a tracked transition, the curtain is already covering the
// screen (built into the body template above) — hold one frame, then wipe it away.
(function revealEntrance() {
  if (!navDir) return;
  sessionStorage.removeItem('zl_nav_dir');
  const curtain = document.getElementById('zlCurtain');
  if (!curtain) return;
  if (prefersReducedMotion) { curtain.remove(); return; }
  requestAnimationFrame(() => {
    curtain.classList.add(navDir === 'next' ? 'reveal-next' : 'reveal-prev');
    setTimeout(() => curtain.remove(), 300);
  });
})();

// Tab clicks reuse the same slide instead of an abrupt reload
document.querySelectorAll('.game-sw-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    const targetGame = (btn.getAttribute('href') || '').split('/').pop();
    if (!GAME_ROUTES[targetGame] || targetGame === GAME) return;
    e.preventDefault();
    navigateToGame(targetGame);
  });
});

// Swipe gesture over the listings area switches game category
(function initSwipe() {
  const swipeZone = document.querySelector('main');
  if (!swipeZone) return;
  let startX = 0, startY = 0, tracking = false;

  swipeZone.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  swipeZone.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const SWIPE_THRESHOLD = 60;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const currentIdx = GAME_ORDER.indexOf(GAME);
    const targetIdx  = dx < 0 ? currentIdx + 1 : currentIdx - 1;
    if (targetIdx < 0 || targetIdx >= GAME_ORDER.length) return;
    navigateToGame(GAME_ORDER[targetIdx]);
  }, { passive: true });
})();

// Onboarding: /listings/<game>?filters=1 opens the filter panel on arrival
if (new URLSearchParams(window.location.search).get('filters') === '1') {
  const panel = document.getElementById('filterPanel');
  if (panel) panel.style.display = 'block';
}

// ── Auth-aware nav (delegates to the shared nav.js initNav once session is confirmed) ──
async function initNavGate() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname); return; }
  await initNav(session.user);
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
                  ${listing.seller?.avg_rating > 0 && listing.seller?.review_count > 0
                    ? `<span style="color:#F5B947;font-weight:700;font-size:14px;">★ ${listing.seller.avg_rating}</span><span style="color:var(--text-faint);font-size:11px;"> (${listing.seller.review_count})</span>`
                    : ``}
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
initNavGate();
fetchExchangeRates().then(() => { render(); subscribeToListings(); });
