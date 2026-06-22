// Diagnostic test — sends push and returns actual FCM status code
function b64u(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function u8(str) {
  const p = '='.repeat((4 - (str.length % 4)) % 4);
  return Uint8Array.from(atob((str + p).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
async function signVapid(endpoint, privB64, pubB64, subject) {
  const aud = new URL(endpoint).origin;
  const encode = obj => b64u(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = `${encode({ typ: 'JWT', alg: 'ES256' })}.${encode({ aud, exp: Math.floor(Date.now() / 1000) + 43200, sub: subject })}`;
  const pub = u8(pubB64);
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33)), d: privB64, key_ops: ['sign'], ext: true,
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64u(sig)}`;
}
async function hkdfX(salt, ikm) {
  const k = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, ikm));
}
async function hkdfE(prk, info, len) {
  const k = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, new Uint8Array([...info, 1]))).slice(0, len);
}
async function encrypt(keys, plaintext) {
  const { p256dh, auth } = keys;
  const ephKP = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const recv = await crypto.subtle.importKey('raw', u8(p256dh), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: recv }, ephKP.privateKey, 256);
  const localPub = new Uint8Array(await crypto.subtle.exportKey('raw', ephKP.publicKey));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfX(u8(auth), shared);
  const ikm = await hkdfE(prk, new Uint8Array([...new TextEncoder().encode('WebPush: info\x00'), ...u8(p256dh), ...localPub]), 32);
  const prk2 = await hkdfX(salt, ikm);
  const cek = await hkdfE(prk2, new TextEncoder().encode('Content-Encoding: aes128gcm\x00'), 16);
  const nonce = await hkdfE(prk2, new TextEncoder().encode('Content-Encoding: nonce\x00'), 12);
  const padded = new Uint8Array([...new TextEncoder().encode(plaintext), 2]);
  const cekKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, cekKey, padded));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096, false);
  return new Uint8Array([...salt, ...rs, localPub.length, ...localPub, ...ct]);
}

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userRes.json();

    const VAPID_PRIVATE = env.VAPID_PRIVATE_KEY;
    const VAPID_PUBLIC  = env.VAPID_PUBLIC_KEY;
    if (!VAPID_PRIVATE || !VAPID_PUBLIC) return Response.json({ error: 'VAPID keys missing from Cloudflare env' }, { status: 500 });
    if (!env.VAPID_SUBJECT) return Response.json({ error: 'VAPID_SUBJECT missing from Cloudflare env' }, { status: 500 });

    const subRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${user.id}&select=subscription`,
      { headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY } }
    );
    const rows = await subRes.json().catch(() => []);
    if (!Array.isArray(rows) || !rows.length) {
      return Response.json({ error: 'No subscription in database. Allow notifications first.' }, { status: 404 });
    }

    const results = [];
    const payload = JSON.stringify({ title: 'ZenLootX — Test', body: 'Push notifications working!', url: '/notifications' });

    for (const row of rows) {
      const sub = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
      if (!sub?.endpoint) { results.push({ error: 'no endpoint in subscription object' }); continue; }

      let fcmStatus = null, fcmBody = null, err = null;
      try {
        const jwt = await signVapid(sub.endpoint, VAPID_PRIVATE, VAPID_PUBLIC, env.VAPID_SUBJECT);
        let body = null, extraHeaders = {};
        if (sub.keys?.p256dh && sub.keys?.auth) {
          body = await encrypt(sub.keys, payload);
          extraHeaders = { 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm' };
        }
        const fcm = await fetch(sub.endpoint, {
          method: 'POST',
          headers: { Authorization: `vapid t=${jwt},k=${VAPID_PUBLIC}`, TTL: '86400', ...extraHeaders },
          body,
        });
        fcmStatus = fcm.status;
        fcmBody   = (await fcm.text()).slice(0, 300);
      } catch (e) { err = e.message; }

      results.push({ endpoint: sub.endpoint.slice(0, 55) + '...', hasKeys: !!(sub.keys?.p256dh), fcmStatus, fcmBody, err });
    }

    return Response.json({ subscriptions_found: rows.length, results });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
