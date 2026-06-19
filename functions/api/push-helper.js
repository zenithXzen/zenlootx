// Web Push sender — VAPID JWT signing + aes128gcm payload encryption
// Uses only Web Crypto API (no npm). Works in Cloudflare Workers/Pages Functions.

function b64u(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function u8(str) {
  const p = '='.repeat((4 - (str.length % 4)) % 4);
  return Uint8Array.from(atob((str + p).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

async function hkdfExtract(salt, ikm) {
  const k = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, ikm));
}

async function hkdfExpand(prk, info, len) {
  const k = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', k, new Uint8Array([...info, 1]))
  ).slice(0, len);
}

async function signVapidJwt(endpoint, subject, privB64, pubB64) {
  const aud = new URL(endpoint).origin;
  const encode = obj => b64u(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = `${encode({ typ: 'JWT', alg: 'ES256' })}.${encode({
    aud, exp: Math.floor(Date.now() / 1000) + 43200, sub: subject,
  })}`;
  const pub = u8(pubB64);
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256',
    x: b64u(pub.slice(1, 33)),
    y: b64u(pub.slice(33)),
    d: privB64,
    key_ops: ['sign'], ext: true,
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${b64u(sig)}`;
}

async function encryptPayload(keys, plaintext) {
  const { p256dh, auth } = keys;

  // 1. Ephemeral ECDH key pair
  const ephKP = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const receiverKey = await crypto.subtle.importKey('raw', u8(p256dh), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, ephKP.privateKey, 256);
  const localPub = new Uint8Array(await crypto.subtle.exportKey('raw', ephKP.publicKey));
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 2. RFC 8291 key derivation
  // PRK = HKDF-Extract(salt=auth_secret, ikm=ecdh_secret)
  const prk = await hkdfExtract(u8(auth), sharedSecret);

  // IKM = HKDF-Expand(prk, "WebPush: info\0" || receiver_pub || sender_pub, 32)
  const keyInfo = new Uint8Array([
    ...new TextEncoder().encode('WebPush: info\x00'),
    ...u8(p256dh), ...localPub,
  ]);
  const ikm = await hkdfExpand(prk, keyInfo, 32);

  // PRK2 = HKDF-Extract(salt=content_salt, ikm=ikm)
  const prk2 = await hkdfExtract(salt, ikm);

  // CEK = HKDF-Expand(prk2, "Content-Encoding: aes128gcm\0", 16)
  const cek = await hkdfExpand(prk2, new TextEncoder().encode('Content-Encoding: aes128gcm\x00'), 16);

  // Nonce = HKDF-Expand(prk2, "Content-Encoding: nonce\0", 12)
  const nonce = await hkdfExpand(prk2, new TextEncoder().encode('Content-Encoding: nonce\x00'), 12);

  // 3. AES-128-GCM encrypt (plaintext + 0x02 delimiter = last-record marker)
  const padded = new Uint8Array([...new TextEncoder().encode(plaintext), 2]);
  const cekKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, cekKey, padded)
  );

  // 4. Final body: salt(16) || rs(4 BE) || idlen(1) || sender_pub(65) || ciphertext
  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, 4096, false);
  return new Uint8Array([...salt, ...rsBytes, localPub.length, ...localPub, ...ciphertext]);
}

// ─── Shared sender ────────────────────────────────────────────────────────────

async function sendToSubscriptionRows(rows, env, { title, body, url = '/notifications' }) {
  const VAPID_PRIVATE = env.VAPID_PRIVATE_KEY;
  const VAPID_PUBLIC  = env.VAPID_PUBLIC_KEY;
  if (!VAPID_PRIVATE || !VAPID_PUBLIC) return 0;
  if (!Array.isArray(rows) || !rows.length) return 0;

  const payload = JSON.stringify({ title, body, url });
  const subject = 'mailto:roxaszenkie18@gmail.com';
  let sent = 0;

  for (const row of rows) {
    const sub = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
    if (!sub?.endpoint) continue;
    try {
      const jwt = await signVapidJwt(sub.endpoint, subject, VAPID_PRIVATE, VAPID_PUBLIC);
      let pushBody = null;
      let extraHeaders = {};
      if (sub.keys?.p256dh && sub.keys?.auth) {
        pushBody = await encryptPayload(sub.keys, payload);
        extraHeaders = { 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm' };
      }
      const res = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `vapid t=${jwt},k=${VAPID_PUBLIC}`,
          TTL: '86400',
          ...extraHeaders,
        },
        body: pushBody,
      });
      if (res.status >= 200 && res.status < 300) sent++;
    } catch {}
  }
  return sent;
}

// ─── Public exports ───────────────────────────────────────────────────────────

export async function sendPushToUser(userId, env, notification) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}&select=subscription`,
    { headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY } }
  );
  const rows = await res.json().catch(() => []);
  await sendToSubscriptionRows(rows, env, notification);
}

// userId omitted/null → broadcast to every subscriber. Returns { sent, total }.
export async function sendPushToUsers(userId, env, notification) {
  let url = `${env.SUPABASE_URL}/rest/v1/push_subscriptions?select=subscription`;
  if (userId) url += `&user_id=eq.${userId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY },
  });
  const rows = await res.json().catch(() => []);
  const sent = await sendToSubscriptionRows(rows, env, notification);
  return { sent, total: Array.isArray(rows) ? rows.length : 0 };
}
