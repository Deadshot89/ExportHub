'use strict';

const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');

let _container = null;

function conn() { return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || ''; }
function containerName() { return process.env.EXPORTHUB_STORAGE_CONTAINER || 'exporthub-data'; }
function recordsPrefix() { return (process.env.EXPORTHUB_RECORDS_PREFIX || 'records/') + ''; }
function signaturesPrefix() { return (process.env.EXPORTHUB_SIGNATURES_PREFIX || 'signatures/') + ''; }

async function containerClient() {
  if (_container) return _container;
  const connStr = conn();
  if (!connStr || connStr === 'UseDevelopmentStorage=true') {
    throw err('STORAGE_NOT_CONFIGURED', 'Storage-Verbindung ist nicht konfiguriert.', 500);
  }
  const svc = BlobServiceClient.fromConnectionString(connStr);
  _container = svc.getContainerClient(containerName());
  return _container;
}

function json(status, body, extraHeaders) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (extraHeaders) Object.assign(headers, extraHeaders);
  return { status: status, headers: headers, body: body };
}
function body(req) {
  let v = req && req.body;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { v = {}; } }
  if (!v || typeof v !== 'object') v = {};
  return v;
}
function err(code, message, status) {
  const e = new Error(String(message || code || 'Fehler'));
  e.code = String(code || 'SERVER_ERROR');
  e.status = Number(status || 500);
  return e;
}
function now() { return new Date().toISOString(); }
function q(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
function text(v) { return String(v == null ? '' : v); }
function lower(v) { return q(v).toLowerCase(); }
function clone(v) { return v ? JSON.parse(JSON.stringify(v)) : v; }
function nowMs() { return Date.now(); }

function hash(v) {
  return crypto.createHash('sha256').update(String(v == null ? '' : v)).digest('hex');
}
function safeEqualHex(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (x.length !== y.length) return false;
  const ab = Buffer.from(x, 'hex');
  const bb = Buffer.from(y, 'hex');
  if (ab.length !== bb.length || ab.length === 0) return x === y && x.length > 0;
  return crypto.timingSafeEqual(ab, bb);
}
function validToken(token) { return /^[a-z0-9]{6,32}$/.test(q(token)); }

function expired(r) {
  if (!r || !r.expiresAt) return false;
  return Date.now() > Date.parse(r.expiresAt);
}

function randomHex(n) { return crypto.randomBytes(Math.max(8, n || 16)).toString('hex'); }

function recordBlobName(token) { return recordsPrefix() + q(token).toLowerCase() + '.json'; }
function signatureBlobName(token) { return signaturesPrefix() + q(token).toLowerCase() + '-' + Date.now() + '.png'; }

async function recordBlob(records, token) {
  const c = records && typeof records.getBlobClient === 'function' ? records : await containerClient();
  return c.getBlobClient(recordBlobName(token));
}

async function getBlob(name) {
  const c = await containerClient();
  return c.getBlobClient(name);
}
async function getBlockBlob(name) {
  const c = await containerClient();
  return c.getBlockBlobClient(name);
}

async function readJson(blob, fallback) {
  try {
    const exists = await blob.exists();
    if (!exists) return { value: clone(fallback), etag: null };
    const download = await blob.download();
    const content = await streamToText(download.readableStreamBody);
    const value = content ? JSON.parse(content) : clone(fallback);
    return { value: value, etag: download.etag };
  } catch (e) {
    if (e && e.statusCode === 404) return { value: clone(fallback), etag: null };
    throw e;
  }
}

async function writeJson(blob, value, etag) {
  const body = JSON.stringify(value);
  const options = { blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' } };
  if (etag) options.conditions = { ifMatch: etag };
  else options.conditions = { ifNoneMatch: '*' };
  await blob.upload(body, Buffer.byteLength(body), options);
}

async function uploadBytes(name, bytes, contentType) {
  const blob = await getBlockBlob(name);
  await blob.upload(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes), Buffer.byteLength(bytes), {
    blobHTTPHeaders: { blobContentType: contentType || 'image/png' }
  });
  return blob;
}

async function downloadBytes(name) {
  const blob = await getBlob(name);
  const exists = await blob.exists();
  if (!exists) return null;
  const download = await blob.download();
  const buf = await streamToBuffer(download.readableStreamBody);
  return { bytes: buf, contentType: download.contentType || 'image/png', etag: download.etag };
}

async function streamToText(readable) {
  if (!readable) return '';
  const chunks = [];
  for await (const c of readable) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}
async function streamToBuffer(readable) {
  if (!readable) return Buffer.alloc(0);
  const chunks = [];
  for await (const c of readable) chunks.push(c);
  return Buffer.concat(chunks);
}

async function clients() {
  const c = await containerClient();
  return {
    container: c,
    records: c,
    recordBlob: function(records, token) {
      if (records && typeof records.getBlobClient === 'function') return records.getBlobClient(recordBlobName(token));
      return c.getBlobClient(recordBlobName(token));
    }
  };
}

async function globalPin() {
  // Return configured global PIN or hash of signing secret
  const secret = process.env.EXPORTHUB_AUTH_SIGNING_SECRET || process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || '';
  const pin = process.env.EXPORTHUB_PICKUP_PIN;
  if (pin) return q(pin);
  // Derive a stable 4-digit PIN from the signing secret
  const h = hash('pickup-pin:' + secret);
  return String(parseInt(h.slice(0, 8), 16) % 10000).padStart(4, '0');
}

async function mutateRecord(token, fn) {
  const c = await clients();
  const blob = c.recordBlob(c.records, token);
  const current = await readJson(blob, {});
  const rec = current.value || {};
  const updated = await fn(rec);
  if (updated) {
    await writeJson(blob, updated, current.etag);
  }
  return updated || rec;
}

function publicRecord(r) {
  if (!r) return {};
  const out = clone(r);
  delete out.uploadKeyHash;
  delete out.failedAttempts;
  delete out.lockedUntil;
  return out;
}

function emptyTeam() {
  return { schemaVersion: 3, revision: 0, updatedAt: null, state: { shipments: [], tasks: [], customers: [] }, users: [] };
}

async function createConfirmationPod(rec) {
  return {
    id: 'scan-confirmation-' + Date.now(),
    kind: 'scan-confirmation',
    name: 'QR-Abholung bestätigt',
    ref: q(rec.reference || rec.ref),
    customer: q(rec.customer || rec.customerName),
    confirmedAt: rec.confirmedAt || now(),
    palletOut: Math.max(0, Number(rec.palletOut || 0)),
    palletReturned: Math.max(0, Number(rec.palletReturned || 0)),
    signatureBlobName: rec.signatureBlobName || null
  };
}

async function updateTeam(rec, pods) {
  // Team state update is best-effort — failures must not block pickup confirmation
  try {
    const c = await clients();
    const blob = c.container.getBlobClient(process.env.EXPORTHUB_STORAGE_BLOB || 'team-state.json');
    const stored = await readJson(blob, emptyTeam());
    const doc = stored.value || emptyTeam();
    if (!doc.state) doc.state = { shipments: [], tasks: [], customers: [] };
    if (!Array.isArray(doc.state.shipments)) doc.state.shipments = [];
    // Find shipment by ref and attach POD info
    const ref = q(rec.reference || rec.ref);
    if (ref) {
      const sh = doc.state.shipments.find(function(s) {
        return q(s.reference || s.ref || s.shipmentRef) === ref;
      });
      if (sh) {
        sh.pickupConfirmed = true;
        sh.pickupConfirmedAt = rec.confirmedAt || now();
        sh.pickupDriverSignature = 'pod:' + (rec.signatureBlobName || '');
        sh.signatureDataUrl = 'pod:' + (rec.signatureBlobName || '');
        sh.podFiles = pods || [];
      }
    }
    doc.revision = Number(doc.revision || 0) + 1;
    doc.updatedAt = now();
    await writeJson(blob, doc, stored.etag);
  } catch (e) {
    // best-effort
  }
}

module.exports = {
  json: json,
  body: body,
  err: err,
  now: now,
  q: q,
  text: text,
  lower: lower,
  clone: clone,
  hash: hash,
  safeEqualHex: safeEqualHex,
  validToken: validToken,
  expired: expired,
  randomHex: randomHex,
  recordBlobName: recordBlobName,
  recordBlob: recordBlob,
  signatureBlobName: signatureBlobName,
  readJson: readJson,
  writeJson: writeJson,
  uploadBytes: uploadBytes,
  downloadBytes: downloadBytes,
  clients: clients,
  globalPin: globalPin,
  mutateRecord: mutateRecord,
  publicRecord: publicRecord,
  emptyTeam: emptyTeam,
  createConfirmationPod: createConfirmationPod,
  updateTeam: updateTeam,
  containerClient: containerClient
};
