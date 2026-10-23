'use strict';

// Push subscriptions per environment and the delivery ledger, in a separate small blob next to
// the team state. The team state itself is never written by Web Push (no save conflicts with
// the website). VAPID keys are created once on first use, so no secret has to be configured.

const crypto = require('crypto');
const webPush = require('./web-push');
const i18n = require('./web-push-i18n');

const SUBSCRIPTIONS_BLOB = process.env.EXPORTHUB_WEB_PUSH_BLOB || 'web-push/subscriptions.json';
const TEST_SUBSCRIPTIONS_BLOB = process.env.EXPORTHUB_TEST_WEB_PUSH_BLOB || 'testservice/web-push/subscriptions.json';
const VAPID_BLOB = process.env.EXPORTHUB_WEB_PUSH_VAPID_BLOB || 'web-push/vapid-keys.json';
const MAX_DEVICES_PER_USER = 10;
const MAX_SUBSCRIPTIONS = 2000;
const MAX_FAILURES = 20;
const LEDGER_DAYS = 14;
const MAX_RETRIES = 8;
const CATEGORIES = ['tasks', 'pack'];

function text(v) { return String(v == null ? '' : v).trim(); }
function lower(v) { return text(v).toLowerCase(); }
function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
function error(code, message, status = 400) { const e = new Error(message); e.code = code; e.status = status; e.statusCode = status; return e; }
function emptyDoc() { return { schemaVersion: 1, revision: 0, updatedAt: null, subscriptions: [], ledger: {} }; }
function subscriptionId(endpoint) { return 'wp-' + crypto.createHash('sha256').update(text(endpoint)).digest('hex').slice(0, 24); }
function blobName(environment) { return lower(environment) === 'testservice' ? TEST_SUBSCRIPTIONS_BLOB : SUBSCRIPTIONS_BLOB; }
function isConflict(e) { const s = Number(e && (e.statusCode || e.status)); return s === 409 || s === 412; }

function normalizeDoc(value) {
  const doc = value && typeof value === 'object' ? clone(value) : emptyDoc();
  if (!Array.isArray(doc.subscriptions)) doc.subscriptions = [];
  if (!doc.ledger || typeof doc.ledger !== 'object' || Array.isArray(doc.ledger)) doc.ledger = {};
  doc.schemaVersion = 1;
  doc.revision = Number(doc.revision || 0);
  return doc;
}
function categoriesOf(input, previous) {
  const base = previous && typeof previous === 'object' ? previous : {};
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const key of CATEGORIES) out[key] = src[key] !== undefined ? src[key] !== false : base[key] !== false;
  return out;
}
function deviceLabel(value) { return text(value).replace(/[\u0000-\u001f<>]/g, '').slice(0, 80); }

function upsertSubscription(doc, input, nowIso) {
  const sub = webPush.normalizeSubscription(input.subscription);
  const userId = text(input.user && input.user.id);
  if (!userId) throw error('WEB_PUSH_USER_REQUIRED', 'Benutzer fehlt.', 400);
  const id = subscriptionId(sub.endpoint);
  const index = doc.subscriptions.findIndex((s) => s && (s.id === id || s.endpoint === sub.endpoint));
  const previous = index >= 0 ? doc.subscriptions[index] : null;
  const record = {
    id,
    userId,
    username: lower(input.user.user || input.user.login || input.user.username || input.user.name),
    displayName: text(input.user.name || input.user.user || input.user.username).slice(0, 120),
    endpoint: sub.endpoint,
    keys: sub.keys,
    categories: categoriesOf(input.categories, previous && previous.categories),
    packAllowed: input.packAllowed === true,
    deviceLabel: deviceLabel(input.deviceLabel) || (previous && previous.deviceLabel) || '',
    language: i18n.normalize(input.language) || i18n.normalize(previous && previous.userId === userId && previous.language) || i18n.normalize(input.user && (input.user.language || input.user.uiLanguage)) || 'de',
    createdAt: previous && previous.userId === userId ? previous.createdAt : nowIso,
    updatedAt: nowIso,
    lastSuccessAt: previous && previous.userId === userId ? previous.lastSuccessAt || '' : '',
    lastErrorAt: '',
    failures: 0
  };
  if (index >= 0) doc.subscriptions[index] = record; else doc.subscriptions.push(record);
  // Oldest devices of the same user go first, then the oldest overall.
  const mine = doc.subscriptions.filter((s) => s.userId === userId).sort((a, b) => text(a.updatedAt).localeCompare(text(b.updatedAt)));
  const drop = new Set(mine.slice(0, Math.max(0, mine.length - MAX_DEVICES_PER_USER)).map((s) => s.id));
  doc.subscriptions = doc.subscriptions.filter((s) => !drop.has(s.id));
  if (doc.subscriptions.length > MAX_SUBSCRIPTIONS) {
    doc.subscriptions.sort((a, b) => text(a.updatedAt).localeCompare(text(b.updatedAt)));
    doc.subscriptions = doc.subscriptions.slice(doc.subscriptions.length - MAX_SUBSCRIPTIONS);
  }
  return record;
}
function findByEndpoint(doc, endpoint) {
  const id = subscriptionId(endpoint);
  return doc.subscriptions.find((s) => s && (s.id === id || s.endpoint === text(endpoint))) || null;
}
function removeByEndpoint(doc, endpoint) {
  const hit = findByEndpoint(doc, endpoint);
  if (!hit) return false;
  doc.subscriptions = doc.subscriptions.filter((s) => s !== hit);
  return true;
}
function removeIds(doc, ids) {
  const set = new Set(ids);
  const before = doc.subscriptions.length;
  doc.subscriptions = doc.subscriptions.filter((s) => !set.has(s.id));
  return before - doc.subscriptions.length;
}
function recordResults(doc, results, nowIso) {
  let removed = 0;
  for (const r of results) {
    const s = doc.subscriptions.find((x) => x.id === r.id);
    if (!s) continue;
    if (r.gone) { removeIds(doc, [s.id]); removed++; continue; }
    if (r.ok) { s.lastSuccessAt = nowIso; s.failures = 0; s.lastErrorAt = ''; continue; }
    s.failures = Number(s.failures || 0) + 1; s.lastErrorAt = nowIso; s.lastError = text(r.detail || r.status).slice(0, 120);
    if (s.failures >= MAX_FAILURES) { removeIds(doc, [s.id]); removed++; }
  }
  return removed;
}
function pruneLedger(doc, nowIso, days = LEDGER_DAYS) {
  const limit = new Date(Date.parse(nowIso) - days * 86400000).toISOString();
  let removed = 0;
  for (const [key, at] of Object.entries(doc.ledger)) if (!text(at) || text(at) < limit) { delete doc.ledger[key]; removed++; }
  return removed;
}
function publicSubscription(s) {
  return s ? { id: s.id, categories: clone(s.categories), deviceLabel: s.deviceLabel || '', language: s.language || 'de', createdAt: s.createdAt || '', lastSuccessAt: s.lastSuccessAt || '', packAllowed: s.packAllowed === true } : null;
}

// container: { getBlockBlobClient(name) } with download/upload like @azure/storage-blob.
function createStore(deps) {
  const containerOf = deps.container;
  const readJson = deps.readJson, uploadJson = deps.uploadJson;
  const nowIso = deps.now || (() => new Date().toISOString());
  async function read(environment) {
    const r = await readJson(containerOf().getBlockBlobClient(blobName(environment)), emptyDoc(), true);
    return normalizeDoc(r.value);
  }
  async function mutate(environment, fn) {
    const blob = containerOf().getBlockBlobClient(blobName(environment));
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const r = await readJson(blob, emptyDoc(), true);
      const doc = normalizeDoc(r.value);
      const result = await fn(doc);
      if (result && result.unchanged === true) return result;
      doc.revision += 1; doc.updatedAt = nowIso();
      try { await uploadJson(blob, doc, r.etag); return result; } catch (e) { if (isConflict(e) && attempt < MAX_RETRIES - 1) continue; throw e; }
    }
    throw error('WEB_PUSH_CONCURRENT_UPDATE', 'Gleichzeitige Änderung, bitte erneut versuchen.', 409);
  }
  let vapidCache = null;
  async function vapid() {
    if (vapidCache) return vapidCache;
    const fromEnv = webPush.vapidFromEnv();
    if (fromEnv) return (vapidCache = fromEnv);
    const blob = containerOf().getBlockBlobClient(VAPID_BLOB);
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await readJson(blob, null, false);
      if (r.value && r.value.jwk) return (vapidCache = webPush.vapidFromJwk(r.value.jwk));
      const created = webPush.generateVapidKeys();
      try { await uploadJson(blob, { schemaVersion: 1, createdAt: nowIso(), publicKey: created.publicKey, jwk: created.jwk }, null); return (vapidCache = created); } catch (e) { if (!isConflict(e)) throw e; }
    }
    throw error('WEB_PUSH_VAPID_UNAVAILABLE', 'Push-Schlüssel konnte nicht angelegt werden.', 503);
  }
  return { read, mutate, vapid };
}

module.exports = { CATEGORIES, MAX_DEVICES_PER_USER, emptyDoc, normalizeDoc, subscriptionId, blobName, upsertSubscription, findByEndpoint, removeByEndpoint, removeIds, recordResults, pruneLedger, publicSubscription, createStore };
