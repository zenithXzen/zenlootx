// Called automatically by a Supabase DB trigger whenever orders.escrow_status = 'released'.
// Congratulates the seller and tells them funds are available to withdraw.

// ── Push helpers (duplicated from send-notification.js — CF Functions can't share modules) ──
function b64uEncode(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function b64uDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}
function concat(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}
async function vapidJWT(audience, subject, privateKeyB64u) {
  const key = await crypto.subtle.importKey(
    'pkcs8', b64uDecode(privateKeyB64u),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const hdr = b64uEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const pld = b64uEncode(enc.encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject })));
  const data = `${hdr}.${pld}`;
  const sig  = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(data)));
  return `${data}.${b64uEncode(sig)}`;
}
async function encryptPayload(sub, message) {
  const enc = new TextEncoder(), salt = crypto.getRandomValues(new Uint8Array(16));
  const uaPub = b64uDecode(sub.keys.p256dh), authSec = b64uDecode(sub.keys.auth);
  const uaPubKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const asKP = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', asKP.publicKey));
  const ecdhBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPubKey }, asKP.privateKey, 256);
  const ecdhKey = await crypto.subtle.importKey('raw', new Uint8Array(ecdhBits), 'HKDF', false, ['deriveBits']);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSec, info: concat(enc.encode('WebPush: info\x00'), uaPub, asPub) }, ecdhKey, 256
  ));
  const cekKey   = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const cek      = new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: aes128gcm\x00') }, cekKey, 128));
  const nonceKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const nonce    = new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: nonce\x00') }, nonceKey, 96));
  const plain = enc.encode(message), padded = new Uint8Array(plain.length + 1);
  padded.set(plain); padded[plain.length] = 0x02;
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));
  const header = new Uint8Array(16 + 4 + 1 + asPub.length);
  header.set(salt); new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = asPub.length; header.set(asPub, 21);
  return concat(header, cipher);
}
async function sendPush(sub, notification, env) {
  try {
    const jwt  = await vapidJWT(new URL(sub.endpoint).origin, `mailto:${env.VAPID_SUBJECT || 'admin@zenlootexchange.com'}`, env.VAPID_PRIVATE_KEY);
    const body = await encryptPayload(sub, JSON.stringify(notification));
    await fetch(sub.endpoint, {
      method: 'POST',
      headers: { Authorization: `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY}`, 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm', TTL: '86400' },
      body,
    });
  } catch {}
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  try {
    // Verify the shared secret Supabase sends with every trigger call
    const hookSecret = request.headers.get('x-hook-secret');
    if (!hookSecret || hookSecret !== env.HOOK_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, sellerId, listingId, amount, currency } = await request.json();
    if (!orderId || !sellerId) return Response.json({ error: 'Missing fields' }, { status: 400 });

    // Fetch listing title for a personalised message
    let listingTitle = 'Your listing';
    try {
      const r = await fetch(`${env.SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=title`, {
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY },
      });
      const rows = await r.json();
      if (rows[0]?.title) listingTitle = `"${rows[0].title}"`;
    } catch {}

    const formatted = amount
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0 }).format(amount)
      : '';

    const title   = '🎉 Your listing sold!';
    const message = `Congratulations! ${listingTitle} was sold${formatted ? ` for ${formatted}` : ''}. Your funds are now available to withdraw.`;

    // Insert in-app notification
    await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ user_id: sellerId, title, message, type: 'listing', link: '/wallet' }),
    });

    // Send device push if seller has a subscription
    if (env.VAPID_PRIVATE_KEY) {
      const subsRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${sellerId}&select=subscription`,
        { headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY } }
      );
      const subs = await subsRes.json();
      await Promise.allSettled(subs.map(s => sendPush(s.subscription, { title, body: message, url: '/wallet' }, env)));
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
