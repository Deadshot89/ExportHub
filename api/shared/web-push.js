'use strict';

// Web Push without a third-party dependency: VAPID (RFC 8292) and payload encryption
// "aes128gcm" (RFC 8291 / RFC 8188) with node:crypto only. The server sends reminders to
// the browser's push service, so a phone gets them with the browser closed and no
// ExportHUB login. Only the device that subscribed can decrypt the payload.

const crypto = require('crypto');
const https = require('https');

const RECORD_SIZE = 4096;
const MAX_PAYLOAD_BYTES = 3800;
// Push services of the browsers in use. A subscription endpoint is user input; the server
// must not POST to arbitrary hosts (SSRF), so only these hosts are accepted.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/
];

function text(v) { return String(v == null ? '' : v).trim(); }
function b64url(buf) { return Buffer.from(buf).toString('base64url'); }
function fromB64url(value) { return Buffer.from(text(value).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'), 'base64url'); }
function error(code, message, status = 400) { const e = new Error(message); e.code = code; e.status = status; e.statusCode = status; return e; }

function allowedEndpoint(endpoint) {
  let u; try { u = new URL(text(endpoint)); } catch (_) { return false; }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return false;
  const host = u.hostname.toLowerCase();
  return PUSH_HOSTS.some((re) => re.test(host));
}

function normalizeSubscription(input) {
  const s = input && typeof input === 'object' ? input : {};
  const endpoint = text(s.endpoint), keys = s.keys && typeof s.keys === 'object' ? s.keys : {};
  if (!allowedEndpoint(endpoint)) throw error('WEB_PUSH_ENDPOINT_INVALID', 'Unbekannter Push-Dienst.', 400);
  const p256dh = fromB64url(keys.p256dh), auth = fromB64url(keys.auth);
  if (p256dh.length !== 65 || p256dh[0] !== 4) throw error('WEB_PUSH_KEY_INVALID', 'Ungültiger Geräteschlüssel.', 400);
  if (auth.length < 16) throw error('WEB_PUSH_KEY_INVALID', 'Ungültiger Geräteschlüssel.', 400);
  return { endpoint, keys: { p256dh: b64url(p256dh), auth: b64url(auth) } };
}

// VAPID keys as JWK (private) plus the raw uncompressed public key the browser needs
// for pushManager.subscribe({applicationServerKey}).
function generateVapidKeys() {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return vapidFromJwk(privateKey.export({ format: 'jwk' }));
}
function vapidFromJwk(jwk) {
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y || !jwk.d) throw error('WEB_PUSH_VAPID_INVALID', 'VAPID-Schlüssel ist ungültig.', 500);
  const publicKey = b64url(Buffer.concat([Buffer.from([4]), fromB64url(jwk.x), fromB64url(jwk.y)]));
  return { publicKey, jwk: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d } };
}
// Environment override: EXPORTHUB_WEB_PUSH_VAPID_PUBLIC_KEY (raw, base64url) and
// EXPORTHUB_WEB_PUSH_VAPID_PRIVATE_KEY (32-byte scalar "d", base64url) as produced by web-push tools.
function vapidFromEnv(env = process.env) {
  const pub = fromB64url(env.EXPORTHUB_WEB_PUSH_VAPID_PUBLIC_KEY), d = text(env.EXPORTHUB_WEB_PUSH_VAPID_PRIVATE_KEY);
  if (!d || pub.length !== 65 || pub[0] !== 4) return null;
  return vapidFromJwk({ kty: 'EC', crv: 'P-256', x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33, 65)), d: b64url(fromB64url(d)) });
}

function vapidAuthorization(endpoint, vapid, subject, nowMs = Date.now()) {
  const audience = new URL(endpoint).origin;
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64url(JSON.stringify({ aud: audience, exp: Math.floor(nowMs / 1000) + 12 * 3600, sub: text(subject) || 'https://www.exporthub360.de' }));
  const key = crypto.createPrivateKey({ key: vapid.jwk, format: 'jwk' });
  const signature = crypto.sign('sha256', Buffer.from(header + '.' + claims), { key, dsaEncoding: 'ieee-p1363' });
  return 'vapid t=' + header + '.' + claims + '.' + b64url(signature) + ', k=' + vapid.publicKey;
}

function hmac(key, data) { return crypto.createHmac('sha256', key).update(data).digest(); }

// RFC 8291 section 3.4 / RFC 8188: a single record with the 0x02 padding delimiter.
function encryptPayload(subscription, payload, options = {}) {
  const uaPublic = fromB64url(subscription.keys.p256dh), authSecret = fromB64url(subscription.keys.auth);
  const plain = Buffer.isBuffer(payload) ? payload : Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload), 'utf8');
  if (plain.length > MAX_PAYLOAD_BYTES) throw error('WEB_PUSH_PAYLOAD_TOO_LARGE', 'Push-Inhalt ist zu groß.', 413);
  const ecdh = crypto.createECDH('prime256v1');
  if (options.privateKey) ecdh.setPrivateKey(options.privateKey); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const ecdhSecret = ecdh.computeSecret(uaPublic);
  const salt = options.salt || crypto.randomBytes(16);
  const prkKey = hmac(authSecret, ecdhSecret);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), uaPublic, asPublic]);
  const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'utf8')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'utf8')).subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(Buffer.concat([plain, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0); header.writeUInt32BE(RECORD_SIZE, 16); header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, encrypted]);
}

function defaultTransport(endpoint, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(endpoint, { method: 'POST', headers, timeout: 10000 }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(Buffer.from(c)));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8').slice(0, 500) }));
    });
    req.on('timeout', () => req.destroy(error('WEB_PUSH_TIMEOUT', 'Push-Dienst antwortet nicht.', 504)));
    req.on('error', reject);
    req.end(body);
  });
}

// Result: ok (delivered to the push service), gone (subscription expired or revoked: delete it),
// otherwise a transient failure that the next run retries.
async function sendNotification(subscription, payload, options = {}) {
  const sub = normalizeSubscription(subscription);
  const body = encryptPayload(sub, payload);
  const headers = {
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    'Content-Length': String(body.length),
    TTL: String(Math.max(60, Math.min(4 * 24 * 3600, Number(options.ttl) || 12 * 3600))),
    Urgency: ['very-low', 'low', 'normal', 'high'].includes(options.urgency) ? options.urgency : 'normal',
    Authorization: vapidAuthorization(sub.endpoint, options.vapid, options.subject)
  };
  const topic = text(options.topic).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  if (topic) headers.Topic = topic;
  const transport = options.transport || defaultTransport;
  try {
    const res = await transport(sub.endpoint, headers, body);
    const status = Number(res && res.status) || 0;
    return { ok: status >= 200 && status < 300, gone: status === 404 || status === 410, status, detail: text(res && res.body).slice(0, 200) };
  } catch (e) {
    return { ok: false, gone: false, status: 0, detail: text(e && (e.code || e.message)).slice(0, 200) };
  }
}

module.exports = { MAX_PAYLOAD_BYTES, allowedEndpoint, normalizeSubscription, generateVapidKeys, vapidFromJwk, vapidFromEnv, vapidAuthorization, encryptPayload, sendNotification, b64url, fromB64url };
