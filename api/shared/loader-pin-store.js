'use strict';

const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = process.env.EXPORTHUB_STORAGE_CONTAINER || 'exporthub-data';
const BLOB_NAME = process.env.EXPORTHUB_LOADER_PIN_BLOB || 'server/loader-pins.json';
const RECORD_CONTAINER = process.env.EXPORTHUB_PICKUP_CONTAINER || 'exporthub-pickup';
const TEAM_BLOB = process.env.EXPORTHUB_STORAGE_BLOB || 'team-state.json';
const MAX_RETRIES = 6;

function text(v) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(); }
function now() { return new Date().toISOString(); }
function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
function conn() { return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || ''; }
function error(code, message, status) { const e = new Error(message); e.code = code; e.status = status || 400; return e; }
function pinSecret() { return process.env.EXPORTHUB_LOADER_PIN_SECRET || process.env.EXPORTHUB_PICKUP_SECRET || process.env.EXPORTHUB_AUTH_SIGNING_SECRET || conn(); }
function encryptionKey() { const s = pinSecret(); if (!s) throw error('PIN_SECRET_MISSING', 'Für die Verlader-PINs ist kein serverseitiges Geheimnis konfiguriert.', 503); return crypto.createHash('sha256').update('exporthub-loader-pin-encryption-v1:' + s).digest(); }
function hashKey() { const s = pinSecret(); if (!s) throw error('PIN_SECRET_MISSING', 'Für die Verlader-PINs ist kein serverseitiges Geheimnis konfiguriert.', 503); return crypto.createHash('sha256').update('exporthub-loader-pin-hash-v1:' + s).digest(); }
function pinHash(pin) { return crypto.createHmac('sha256', hashKey()).update(String(pin || '')).digest('hex'); }
function safeEq(a, b) { try { const aa = Buffer.from(String(a || ''), 'hex'), bb = Buffer.from(String(b || ''), 'hex'); return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb); } catch (_) { return false; } }
function validPin(pin) { return /^\d{4}$/.test(String(pin || '')); }
function slug(v) { return text(v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42) || 'verlader'; }
function encryptPin(pin) { const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv), enc = Buffer.concat([cipher.update(String(pin), 'utf8'), cipher.final()]), tag = cipher.getAuthTag(); return ['v1', iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.'); }
function decryptPin(value) { const parts = String(value || '').split('.'); if (parts.length !== 4 || parts[0] !== 'v1') throw error('PIN_DECRYPT_FAILED', 'Eine gespeicherte Verlader-PIN konnte nicht gelesen werden.', 500); const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(parts[1], 'base64')); decipher.setAuthTag(Buffer.from(parts[2], 'base64')); return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8'); }

function envDefaults() {
  const raw = text(process.env.EXPORTHUB_LOADER_PINS);
  const rows = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const pin = text(item && item.pin), name = text(item && item.name);
          if (validPin(pin) && name) rows.push({ pin, name, active: item.active !== false });
        }
      } else if (parsed && typeof parsed === 'object') {
        for (const [pin, name] of Object.entries(parsed)) if (validPin(pin) && text(name)) rows.push({ pin, name: text(name), active: true });
      }
    } catch (_) {}
  }
  if (rows.length) return rows;
  return [
    { pin: '4466', name: 'Daniel Ollmann', active: true },
    { pin: '2050', name: 'Tobias', active: true },
    { pin: '2258', name: 'Amer', active: true },
    { pin: '7530', name: 'Franjo', active: true }
  ];
}

function makeRecord(item, index) {
  const pin = text(item.pin), name = text(item.name), stamp = now();
  return {
    id: item.id || (slug(name) + '-' + String(index + 1)),
    name,
    pinHash: pinHash(pin),
    pinEncrypted: encryptPin(pin),
    active: item.active !== false,
    createdAt: item.createdAt || stamp,
    updatedAt: stamp
  };
}

async function clients() {
  const cs = conn();
  if (!cs) throw error('STORAGE_NOT_CONFIGURED', 'Azure-Speicher ist nicht konfiguriert.', 503);
  const service = BlobServiceClient.fromConnectionString(cs);
  const config = service.getContainerClient(CONTAINER);
  const records = service.getContainerClient(RECORD_CONTAINER);
  await Promise.all([config.createIfNotExists(), records.createIfNotExists()]);
  return { service, config, records };
}
async function readBuffer(blob) { const r = await blob.download(0), chunks = []; for await (const c of r.readableStreamBody) chunks.push(Buffer.from(c)); return { buffer: Buffer.concat(chunks), etag: r.etag || null }; }
async function readJson(blob, fallback) { try { const r = await readBuffer(blob); return { value: r.buffer.length ? JSON.parse(r.buffer.toString('utf8')) : clone(fallback), etag: r.etag }; } catch (e) { if (e && e.statusCode === 404) return { value: clone(fallback), etag: null }; throw e; } }
async function writeJson(blob, value, etag) { const raw = JSON.stringify(value); const conditions = etag ? { ifMatch: etag } : { ifNoneMatch: '*' }; return blob.upload(raw, Buffer.byteLength(raw), { blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8', blobCacheControl: 'no-store' }, conditions }); }
async function configBlob() { const c = await clients(); return { clients: c, blob: c.config.getBlockBlobClient(BLOB_NAME) }; }

function normalizeDoc(doc) {
  const source = doc && typeof doc === 'object' ? doc : {};
  source.schemaVersion = 1;
  source.updatedAt = source.updatedAt || now();
  source.pins = Array.isArray(source.pins) ? source.pins : [];
  let changed = false;
  source.pins = source.pins.map(function (r, i) {
    const x = Object.assign({}, r || {});
    if (!x.id) { x.id = slug(x.name || 'verlader') + '-' + (i + 1); changed = true; }
    x.name = text(x.name);
    x.active = x.active !== false;
    if (validPin(x.pin) && !x.pinEncrypted) { x.pinHash = pinHash(x.pin); x.pinEncrypted = encryptPin(x.pin); delete x.pin; changed = true; }
    return x;
  }).filter(x => x.name && x.pinEncrypted && x.pinHash);
  return { doc: source, changed };
}

async function ensure() {
  const got = await configBlob();
  const current = await readJson(got.blob, null);
  if (!current.value) {
    const doc = { schemaVersion: 1, updatedAt: now(), pins: envDefaults().map(makeRecord) };
    try { await writeJson(got.blob, doc, null); return doc; } catch (e) { if (!(e && e.statusCode === 412)) throw e; }
    return (await readJson(got.blob, { schemaVersion: 1, pins: [] })).value;
  }
  const normalized = normalizeDoc(current.value);
  if (normalized.changed) {
    normalized.doc.updatedAt = now();
    try { await writeJson(got.blob, normalized.doc, current.etag); } catch (_) {}
  }
  return normalized.doc;
}

function reveal(r) { let pin = ''; try { pin = decryptPin(r.pinEncrypted); } catch (_) {} return { id: text(r.id), name: text(r.name), pin, active: r.active !== false, createdAt: r.createdAt || null, updatedAt: r.updatedAt || null }; }
async function list() { const doc = await ensure(); return doc.pins.map(reveal); }

async function mutate(fn) {
  const got = await configBlob();
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const current = await readJson(got.blob, null);
    let doc = current.value;
    if (!doc) doc = { schemaVersion: 1, updatedAt: now(), pins: envDefaults().map(makeRecord) };
    doc = normalizeDoc(doc).doc;
    const next = await fn(clone(doc));
    next.schemaVersion = 1; next.updatedAt = now();
    try { await writeJson(got.blob, next, current.etag); return next; } catch (e) { if (e && e.statusCode === 412 && attempt < MAX_RETRIES - 1) continue; throw e; }
  }
  throw error('PIN_CONFLICT', 'Die Verlader-PINs konnten wegen eines gleichzeitigen Zugriffs nicht gespeichert werden.', 409);
}

async function create(input) {
  const name = text(input && input.name), pin = text(input && input.pin);
  if (!name) throw error('NAME_REQUIRED', 'Bitte einen Verlader-Namen eingeben.', 400);
  if (!validPin(pin)) throw error('INVALID_PIN', 'Die Verlader-PIN muss genau vier Ziffern enthalten.', 400);
  const doc = await mutate(function (d) {
    if (d.pins.some(x => safeEq(x.pinHash, pinHash(pin)))) throw error('PIN_EXISTS', 'Diese Verlader-PIN ist bereits vergeben.', 409);
    const id = slug(name) + '-' + crypto.randomBytes(4).toString('hex');
    d.pins.push(makeRecord({ id, name, pin, active: input.active !== false }, d.pins.length));
    return d;
  });
  return doc.pins.map(reveal);
}

async function update(input) {
  const id = text(input && input.id), name = text(input && input.name), pin = text(input && input.pin);
  if (!id) throw error('ID_REQUIRED', 'Verlader-ID fehlt.', 400);
  if (!name) throw error('NAME_REQUIRED', 'Bitte einen Verlader-Namen eingeben.', 400);
  if (!validPin(pin)) throw error('INVALID_PIN', 'Die Verlader-PIN muss genau vier Ziffern enthalten.', 400);
  const digest = pinHash(pin);
  const doc = await mutate(function (d) {
    const row = d.pins.find(x => text(x.id) === id);
    if (!row) throw error('NOT_FOUND', 'Verlader-PIN wurde nicht gefunden.', 404);
    if (d.pins.some(x => text(x.id) !== id && safeEq(x.pinHash, digest))) throw error('PIN_EXISTS', 'Diese Verlader-PIN ist bereits vergeben.', 409);
    row.name = name; row.pinHash = digest; row.pinEncrypted = encryptPin(pin); row.active = input.active !== false; row.updatedAt = now();
    return d;
  });
  return doc.pins.map(reveal);
}

async function toggle(input) {
  const id = text(input && input.id), active = input && input.active === true;
  const doc = await mutate(function (d) { const row = d.pins.find(x => text(x.id) === id); if (!row) throw error('NOT_FOUND', 'Verlader-PIN wurde nicht gefunden.', 404); row.active = active; row.updatedAt = now(); return d; });
  return doc.pins.map(reveal);
}

async function remove(input) {
  const id = text(input && input.id);
  const doc = await mutate(function (d) { const before = d.pins.length; d.pins = d.pins.filter(x => text(x.id) !== id); if (before === d.pins.length) throw error('NOT_FOUND', 'Verlader-PIN wurde nicht gefunden.', 404); return d; });
  return doc.pins.map(reveal);
}

async function findByPin(pin) {
  pin = text(pin);
  if (!validPin(pin)) return null;
  const doc = await ensure(), digest = pinHash(pin);
  const row = doc.pins.find(x => x.active !== false && safeEq(x.pinHash, digest));
  return row ? { id: text(row.id), name: text(row.name), active: true } : null;
}

function bridgePin() {
  const direct = text(process.env.EXPORTHUB_LOADER_BRIDGE_PIN || process.env.EXPORTHUB_PICKUP_PIN);
  if (validPin(direct)) return direct;
  const raw = text(process.env.EXPORTHUB_LOADER_PINS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) { const item = parsed.find(x => validPin(text(x && x.pin)) && x.active !== false); if (item) return text(item.pin); }
      else if (parsed && typeof parsed === 'object') { const pin = Object.keys(parsed).find(validPin); if (pin) return pin; }
    } catch (_) {}
  }
  return '4466';
}

async function patchPickupIdentity(token, loader) {
  token = text(token).toLowerCase();
  if (!token || !loader) return false;
  const c = await clients();
  const candidates = ['records/' + token + '.json', token + '.json'];
  let record = null, recordBlob = null, etag = null;
  for (const name of candidates) {
    const b = c.records.getBlockBlobClient(name), r = await readJson(b, null);
    if (r.value) { record = r.value; recordBlob = b; etag = r.etag; break; }
  }
  if (!record || !recordBlob) return false;
  record.loaderName = loader.name; record.loadedBy = loader.name; record.loader = loader.name; record.verlader = loader.name; record.loaderId = loader.id; record.updatedAt = now();
  try { await writeJson(recordBlob, record, etag); } catch (_) { return false; }
  try {
    const teamBlob = c.config.getBlockBlobClient(TEAM_BLOB), teamRead = await readJson(teamBlob, null), doc = teamRead.value;
    if (doc && doc.state && Array.isArray(doc.state.shipments)) {
      const sid = text(record.shipmentId), ref = text(record.reference).toUpperCase();
      const sh = doc.state.shipments.find(x => (sid && text(x.id || x.shipmentId) === sid) || (ref && text(x.ref || x.reference || x.shipmentRef).toUpperCase() === ref));
      if (sh) {
        sh.loaderName = loader.name; sh.loadedBy = loader.name; sh.loader = loader.name; sh.verlader = loader.name; sh.loaderId = loader.id; sh._syncUpdatedAt = now(); sh._syncDeviceId = 'loader-pin-admin';
        doc.revision = Number(doc.revision || 0) + 1; doc.updatedAt = now();
        await writeJson(teamBlob, doc, teamRead.etag);
      }
    }
  } catch (_) {}
  return true;
}

module.exports = { list, create, update, toggle, remove, findByPin, bridgePin, patchPickupIdentity, text, validPin, error };
