'use strict';

const crypto = require('crypto');
const { createBlobServiceClient } = require('./blob-rest');
const rc1014Seed = require('./rc1014-fixed-pickup-seed');

const CONTAINER = process.env.EXPORTHUB_STORAGE_CONTAINER || process.env.EXPORTHUB_CONTAINER || 'exporthub-data';
const FIX_PREFIX = String(process.env.EXPORTHUB_FIXED_PICKUPS_PREFIX || 'fixed-pickups').replace(/^\/+|\/+$/g, '');
const MAX_RETRIES = 4;
const TIME_KEYS = ['time','startTime','endTime','pickupStart','pickupEnd','timeWindow','plannedPickupStart','plannedPickupEnd'];

function text(v){ return String(v == null ? '' : v).trim(); }
function lower(v){ return text(v).toLowerCase(); }
function now(){ return new Date().toISOString(); }
function clone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }
function error(code, message, statusCode = 400){
  const e = new Error(message);
  e.code = code;
  e.status = statusCode;
  e.statusCode = statusCode;
  return e;
}
function normalizeEnvironment(value){
  const raw = lower(value);
  if (!raw || raw === 'production') return 'production';
  if (raw === 'testservice') return 'testservice';
  throw error('ENVIRONMENT_INVALID', 'Unbekannte ExportHUB-Datenumgebung.', 400);
}
function environmentEvidence(req){
  const h = req && req.headers || {};
  return [
    h.origin, h.Origin, h.referer, h.Referer,
    h['x-forwarded-host'], h['X-Forwarded-Host'],
    h['x-original-host'], h['X-Original-Host'],
    h['x-ms-original-url'], h['X-MS-Original-URL'],
    h.host, h.Host
  ].map(text).filter(Boolean).join(' ');
}
function resolveEnvironment(req, payload){
  const h = req && req.headers || {};
  const raw = lower(h['x-exporthub-environment'] || h['X-ExportHUB-Environment'] || (payload && payload.environment) || '');
  if (raw && raw !== 'production' && raw !== 'testservice') {
    throw error('ENVIRONMENT_INVALID', 'Unbekannte ExportHUB-Datenumgebung.', 400);
  }
  const evidence = environmentEvidence(req);
  const origin = lower(h.origin || h.Origin || h.referer || h.Referer || h['x-forwarded-host'] || h['X-Forwarded-Host'] || h.host || h.Host || '');
  const originTest = /-testservice\./i.test(origin);
  const originAzure = /\.azurestaticapps\.net(?:[:/]|$)/i.test(origin);
  const originProduction = originAzure && !originTest;
  if (originTest) {
    if (raw && raw !== 'testservice') throw error('ENVIRONMENT_MISMATCH', 'Ein Testservice-Aufruf darf keine Produktionsdaten anfordern.', 409);
    return 'testservice';
  }
  if (originProduction) {
    if (raw && raw !== 'production') throw error('ENVIRONMENT_MISMATCH', 'Die Produktionsseite darf keine Testservice-Daten anfordern.', 409);
    return 'production';
  }
  if (raw) return raw;
  return /-testservice\./i.test(evidence) ? 'testservice' : 'production';
}
function normalizeCompanyKey(value){
  const key = text(value).toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!key) throw error('COMPANY_REQUIRED', 'Firmenkontext fehlt.', 400);
  return key;
}
function tenantDigest(companyKey){
  const company = normalizeCompanyKey(companyKey);
  return crypto.createHash('sha256').update(company).digest('hex').slice(0, 24);
}
function blobName(environment, companyKey){
  const env = normalizeEnvironment(environment);
  const prefix = env === 'testservice' ? `testservice/${FIX_PREFIX}` : FIX_PREFIX;
  return `${prefix}/${tenantDigest(companyKey)}.json`;
}
function emptyDocument(environment, companyKey){
  return {
    schemaVersion: 1,
    seedVersion: 0,
    environment: normalizeEnvironment(environment),
    companyKey: normalizeCompanyKey(companyKey),
    revision: 0,
    updatedAt: null,
    items: []
  };
}
function connectionString(){
  return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING ||
    process.env.EXPORTHUB_STORAGE_CONNECTION ||
    process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING ||
    process.env.AzureWebJobsStorage || '';
}
function streamToBuffer(stream){
  return (async () => {
    const chunks = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  })();
}
async function readJson(blob, fallback){
  try {
    const res = await blob.download(0);
    const buffer = await streamToBuffer(res.readableStreamBody);
    const value = buffer.length ? JSON.parse(buffer.toString('utf8')) : clone(fallback);
    return { value, etag: res.etag || null };
  } catch (e) {
    if (e && Number(e.statusCode || e.status) === 404) return { value: clone(fallback), etag: null };
    throw e;
  }
}
async function writeJson(blob, value, etag){
  const raw = JSON.stringify(value);
  const conditions = etag ? { ifMatch: etag } : { ifNoneMatch: '*' };
  return blob.upload(raw, Buffer.byteLength(raw), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
    conditions
  });
}
function client(environment, companyKey){
  const cs = connectionString();
  if (!cs) throw error('STORAGE_NOT_CONFIGURED', 'ExportHUB-Speicher ist nicht konfiguriert.', 503);
  const service = createBlobServiceClient(cs);
  const container = service.getContainerClient(CONTAINER);
  return container.getBlockBlobClient(blobName(environment, companyKey));
}
function sanitizeLabel(value){
  const out = text(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, 180);
  if (!out) throw error('SITE_LABEL_REQUIRED', 'Standort/Kunde ist erforderlich.', 400);
  return out;
}
function sanitizeNote(value){
  return text(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, 500);
}
function validateWeekday(value){
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw error('WEEKDAY_INVALID', 'Wochentag muss Montag bis Freitag sein.', 400);
  return n;
}
function validateActive(value){
  if (typeof value !== 'boolean') throw error('ACTIVE_INVALID', 'Aktiv-Status muss wahr oder falsch sein.', 400);
  return value;
}
function validateInput(payload, options = {}){
  const source = payload && typeof payload === 'object' ? payload : {};
  const partial = options.partial === true;
  for (const key of TIME_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      throw error('TIME_FIELDS_NOT_ALLOWED', 'Fixe Abholungen enthalten keine Uhrzeit oder Zeitfenster.', 400);
    }
  }
  const out = {};
  if (!partial || Object.prototype.hasOwnProperty.call(source, 'siteLabel')) out.siteLabel = sanitizeLabel(source.siteLabel);
  if (!partial || Object.prototype.hasOwnProperty.call(source, 'weekday')) out.weekday = validateWeekday(source.weekday);
  if (!partial || Object.prototype.hasOwnProperty.call(source, 'note')) out.note = sanitizeNote(source.note);
  if (!partial) out.active = source.active === undefined ? true : validateActive(source.active);
  else if (Object.prototype.hasOwnProperty.call(source, 'active')) out.active = validateActive(source.active);
  if (partial && Object.keys(out).length === 0) throw error('EMPTY_PATCH', 'Keine änderbaren FIX-Felder übergeben.', 400);
  return out;
}
function publicItem(item){
  return {
    id: text(item && item.id),
    siteLabel: text(item && item.siteLabel),
    weekday: Number(item && item.weekday || 0),
    note: text(item && item.note),
    active: item && item.active !== false,
    createdAt: item && item.createdAt || null,
    updatedAt: item && item.updatedAt || null
  };
}
function normalizeDocument(doc, environment, companyKey){
  const base = emptyDocument(environment, companyKey);
  const source = doc && typeof doc === 'object' ? doc : {};
  base.seedVersion = Math.max(0, Number(source.seedVersion || 0) || 0);
  base.revision = Math.max(0, Number(source.revision || 0) || 0);
  base.updatedAt = source.updatedAt || null;
  base.items = Array.isArray(source.items) ? source.items.filter(Boolean).map(clone) : [];
  return base;
}
async function readDocument(environment, companyKey){
  const blob = client(environment, companyKey);
  const fallback = emptyDocument(environment, companyKey);
  const res = await readJson(blob, fallback);
  return { blob, document: normalizeDocument(res.value, environment, companyKey), etag: res.etag };
}
async function ensureRc1014Seed(environment, companyKey){
  const company = normalizeCompanyKey(companyKey);
  if (!rc1014Seed.isEssentraCompany(company)) return false;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const current = await readDocument(environment, company);
    if (Number(current.document.seedVersion || 0) >= rc1014Seed.SEED_VERSION) return false;
    const next = clone(current.document);
    const stamp = now();
    next.items = rc1014Seed.mergeMissing(next.items, company, stamp);
    next.seedVersion = rc1014Seed.SEED_VERSION;
    next.revision = Number(next.revision || 0) + 1;
    next.updatedAt = stamp;
    try {
      await writeJson(current.blob, next, current.etag);
      return true;
    } catch (e) {
      if (Number(e && (e.statusCode || e.status)) === 412 && attempt < MAX_RETRIES - 1) continue;
      throw e;
    }
  }
  throw error('SEED_CONCURRENT_UPDATE', 'Fixe Essentra-Abholungen konnten wegen paralleler Änderungen nicht initialisiert werden.', 409);
}
async function mutate(environment, companyKey, fn){
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const current = await readDocument(environment, companyKey);
    const next = clone(current.document);
    const result = await fn(next);
    next.revision = Number(next.revision || 0) + 1;
    next.updatedAt = now();
    try {
      await writeJson(current.blob, next, current.etag);
      return result;
    } catch (e) {
      if (Number(e && (e.statusCode || e.status)) === 412 && attempt < MAX_RETRIES - 1) continue;
      throw e;
    }
  }
  throw error('CONCURRENT_UPDATE', 'FIX-Abholungen konnten wegen paralleler Änderungen nicht gespeichert werden.', 409);
}
async function list(environment, companyKey, options = {}){
  await ensureRc1014Seed(environment, companyKey);
  const current = await readDocument(environment, companyKey);
  const includeInactive = options.includeInactive === true;
  return current.document.items
    .filter(item => includeInactive || item.active !== false)
    .sort((a,b) => Number(a.weekday || 0) - Number(b.weekday || 0) || text(a.siteLabel).localeCompare(text(b.siteLabel), 'de'))
    .map(publicItem);
}
async function create(environment, companyKey, payload, actor){
  const input = validateInput(payload, { partial: false });
  return mutate(environment, companyKey, async doc => {
    const stamp = now();
    const item = {
      id: `FIX-${crypto.randomBytes(12).toString('hex')}`,
      ...input,
      createdAt: stamp,
      createdBy: text(actor) || 'System',
      updatedAt: stamp,
      updatedBy: text(actor) || 'System'
    };
    doc.items.push(item);
    return publicItem(item);
  });
}
async function update(environment, companyKey, id, patch, actor){
  const key = text(id);
  if (!key) throw error('FIX_ID_REQUIRED', 'FIX-ID fehlt.', 400);
  const input = validateInput(patch, { partial: true });
  return mutate(environment, companyKey, async doc => {
    const item = doc.items.find(x => text(x && x.id) === key);
    if (!item) throw error('FIX_NOT_FOUND', 'Fixe Abholung wurde nicht gefunden.', 404);
    Object.assign(item, input);
    item.updatedAt = now();
    item.updatedBy = text(actor) || 'System';
    return publicItem(item);
  });
}

module.exports = {
  TIME_KEYS,
  normalizeEnvironment,
  resolveEnvironment,
  normalizeCompanyKey,
  tenantDigest,
  blobName,
  validateInput,
  publicItem,
  ensureRc1014Seed,
  list,
  create,
  update
};