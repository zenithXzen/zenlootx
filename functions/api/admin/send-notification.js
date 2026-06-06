// ── Encoding helpers ──────────────────────────────────────────────────────────
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

// ── VAPID JWT (ECDSA P-256) ───────────────────────────────────────────────────
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

// ── RFC 8291 Web Push Payload Encryption ─────────────────────────────────────
async function encryptPayload(sub, message) {
  const enc  = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const uaPub   = b64uDecode(sub.keys.p256dh);
  const authSec = b64uDecode(sub.keys.auth);

  const uaPubKey = await crypto.subtle.importKey(
    'raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const asKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', asKeyPair.publicKey));

  const ecdhBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaPubKey }, asKeyPair.privateKey, 256
  );

  // IKM per RFC 8291 §3.3
  const keyInfo = concat(enc.encode('WebPush: info\x00'), uaPub, asPub);
  const ecdhKey = await crypto.subtle.importKey('raw', new Uint8Array(ecdhBits), 'HKDF', false, ['deriveBits']);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSec, info: keyInfo }, ecdhKey, 256
  ));

  // CEK and Nonce per RFC 8188
  const cekKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const cek = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: aes128gcm\x00') }, cekKey, 128
  ));
  const nonceKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: nonce\x00') }, nonceKey, 96
  ));

  // Pad plaintext with 0x02 delimiter (single record)
  const plain  = enc.encode(message);
  const padded = new Uint8Array(plain.length + 1);
  padded.set(plain);
  padded[plain.length] = 0x02;

  const aesKey  = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher  = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));

  // RFC 8188 content encoding header
  const header = new Uint8Array(16 + 4 + 1 + asPub.length);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = asPub.length;
  header.set(asPub, 21);

  return concat(header, cipher);
}

// ── Send one push notification ────────────────────────────────────────────────
async function sendPush(sub, notification, env) {
  try {
    const audience = new URL(sub.endpoint).origin;
    const subject  = `mailto:${env.VAPID_SUBJECT || 'admin@zenlootexchange.com'}`;
    const jwt      = await vapidJWT(audience, subject, env.VAPID_PRIVATE_KEY);
    const body     = await encryptPayload(sub, JSON.stringify(notification));

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        TTL: '86400',
        Urgency: 'normal',
      },
      body,
    });
    return res.status;
  } catch { return 0; }
}

// ── Admin check ───────────────────────────────────────────────────────────────
async function verifyAdmin(token, env) {
  try {
    const res  = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.app_metadata?.is_admin === true ? user : null;
  } catch { return null; }
}

async function logAdminAction(env, adminId, action, targetId, targetType, details = {}) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/admin_logs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ admin_id: adminId, action, target_id: targetId ? String(targetId) : null, target_type: targetType, details }),
  }).catch(() => {});
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const admin = await verifyAdmin(token, env);
    if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { title, message, type = 'announcement', link = '/notifications', userId = null } = await request.json();
    if (!title || !message) return Response.json({ error: 'Missing title or message' }, { status: 400 });

    // Insert into notifications table (userId null = broadcast visible to everyone)
    await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ user_id: userId, title, message, type, link }),
    });

    // Fetch push subscriptions
    let subsUrl = `${env.SUPABASE_URL}/rest/v1/push_subscriptions?select=subscription`;
    if (userId) subsUrl += `&user_id=eq.${userId}`;

    const subsRes = await fetch(subsUrl, {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
      },
    });
    const subs = (await subsRes.json()) || [];

    // Send push to each subscriber (skip if VAPID keys not configured)
    let sent = 0;
    if (env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY) {
      const results = await Promise.allSettled(
        subs.map(s => sendPush(s.subscription, { title, body: message, url: link }, env))
      );
      sent = results.filter(r => r.status === 'fulfilled' && r.value >= 200 && r.value < 300).length;
    }

    await logAdminAction(env, admin.id, 'send_notification', userId || null, userId ? 'user' : 'broadcast', { title });
    return Response.json({ success: true, dbInserted: true, pushSent: sent, totalSubs: subs.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
