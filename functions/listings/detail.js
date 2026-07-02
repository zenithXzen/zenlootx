// Injects listing-specific Open Graph / Twitter meta into detail.html so
// shared links unfurl with the listing's title, price, and image.
// The page body stays fully client-rendered; this only rewrites <head>.

const SITE = 'https://zenlootexchange.com';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GAME_FALLBACK_IMG = {
  genshin:  `${SITE}/wallpaper/AETHER%20AND%20LUMINE.jpg`,
  mlbb:     `${SITE}/wallpaper/ML.jpg`,
  valorant: `${SITE}/wallpaper/VAL.jpg`,
};

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function onRequestGet({ request, env, next }) {
  const asset = await next(); // detail.html from the static pipeline (keeps _headers intact)

  const id = new URL(request.url).searchParams.get('id');

  let meta = {
    title: 'Listing — ZenLootX',
    desc:  'Escrow-protected marketplace for game accounts, items, and top-ups.',
    image: `${SITE}/wallpaper/zx-icon-square.png`,
    url:   `${SITE}/listings/detail`,
  };

  if (id && UUID_RE.test(id)) {
    meta.url = `${SITE}/listings/detail?id=${id}`;
    try {
      const res = await fetch(
        `${env.SUPABASE_URL}/rest/v1/listings?id=eq.${id}&status=eq.active&select=title,price,currency,game,images,description&limit=1`,
        {
          headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
          signal: AbortSignal.timeout(2000),
        }
      );
      const rows = res.ok ? await res.json() : [];
      const l = rows[0];
      if (l) {
        const price = new Intl.NumberFormat('en-PH', { style: 'currency', currency: l.currency || 'PHP' }).format(l.price || 0);
        meta.title = `${l.title} — ZenLootX`;
        meta.desc = l.description
          ? (l.description.length > 150 ? l.description.slice(0, 147) + '…' : l.description)
          : `Buy ${l.title} for ${price} on ZenLootX — escrow-protected marketplace.`;
        meta.image = (Array.isArray(l.images) && l.images[0]) || GAME_FALLBACK_IMG[l.game] || meta.image;
      }
    } catch {} // any failure → generic meta, never block the page
  }

  const block = `
  <link rel="canonical" href="${esc(meta.url)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ZenLootX">
  <meta property="og:url" content="${esc(meta.url)}">
  <meta property="og:title" content="${esc(meta.title)}">
  <meta property="og:description" content="${esc(meta.desc)}">
  <meta property="og:image" content="${esc(meta.image)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(meta.title)}">
  <meta name="twitter:description" content="${esc(meta.desc)}">
  <meta name="twitter:image" content="${esc(meta.image)}">
`;

  return new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(meta.title); } })
    .on('head', { element(el) { el.append(block, { html: true }); } })
    .transform(asset);
}
