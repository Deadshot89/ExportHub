#!/usr/bin/env node
/**
 * RC1601 / P0 #836 – public, read-only Azure Team-State diagnostic.
 *
 * Only GET /api/exporthub-state?mode=ping and ?mode=health are requested.
 * Both target URLs are fixed to the official Azure Static Web Apps host.
 * No cookies, tokens, request body, retries, writes, state data or customer
 * information are ever sent or logged.
 *
 * Important: health reads production Team-State and may be slow. This probe
 * cannot prove that an authenticated browser session starts successfully.
 */
import { pathToFileURL } from 'node:url';

export const PRODUCTION_BASE = 'https://wonderful-forest-0f315e310.7.azurestaticapps.net';
export const ALLOWED_MODES = Object.freeze(['ping', 'health']);

const BOOL_FIELDS = Object.freeze([
  'ok', 'routeReachable', 'storageChecked', 'storageConfigured',
  'storageReachable', 'authBlobReadable', 'teamStateReadable',
  'teamStateRecoveredFromHistory'
]);
const NUMBER_FIELDS = Object.freeze(['authReadMs', 'teamReadMs', 'totalMs', 'teamStateBytes']);
const MAX_RESPONSE_BYTES = 64 * 1024;
const SAFE_SECTIONS = new Set(['shipments','savedShipments','salesSharedShipments','sharedShipments','shipmentArchive','archivedShipments','archive','customers','abdRequests','tasks','users','customSops','isoSops','taskStatusLedger','deliveryFileDeletionLedger','palletAccount','ideas','settings','sopLearningProgress']);
const SAFE_FIELDS = new Set(['rows','colli','collis','packages','packagingRows','deliveryFiles','deliveryNotesFiles','podFiles','abdFiles','documents','generatedDocuments','files','attachments','mailHistory','pickupHistory','shipmentHistory','containerPhotos','subShipments','notes','customerAvis','items','status','processStatus','id','ref','reference','name','address','email']);
const validSizeRow = row => row && typeof row === 'object' && Number.isFinite(row.bytes) && row.bytes >= 0 && Number.isSafeInteger(row.items) && row.items >= 0;


export function safeSummary(body, mode) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const summary = { mode };
  // Fixed allowlist: never output container, blob path, storageSource, error text,
  // customer names, IDs, users, documents, URL or arbitrary payload fields.
  for (const key of BOOL_FIELDS) {
    if (typeof body[key] === 'boolean') summary[key] = body[key];
  }
  for (const key of NUMBER_FIELDS) {
    const value = body[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) summary[key] = value;
  }
  if (typeof body.environment === 'string' && ['production','testservice'].includes(body.environment)) {
    summary.environment = body.environment;
  }
  if (typeof body.version === 'string' && /^RC[0-9]{1,5}$/.test(body.version)) summary.version = body.version;
  const docs = body.stateDiagnostics;
  if (docs && typeof docs === 'object') {
    const count = docs.inlinePayloadCount;
    if (Number.isSafeInteger(count) && count >= 0) summary.inlinePayloadCount = count;
    if (Array.isArray(docs.sectionBytes)) {
      summary.sections = docs.sectionBytes.filter(row => validSizeRow(row) && SAFE_SECTIONS.has(row.key))
        .map(({key,bytes,items}) => ({key,bytes,items})).slice(0,16);
    }
  }
  const sizeFields = body.collectionFieldBytes;
  if (sizeFields && typeof sizeFields === 'object') {
    const visible = {};
    for (const collection of ['shipments','savedShipments','abdRequests']) {
      if (!Array.isArray(sizeFields[collection])) continue;
      visible[collection] = sizeFields[collection].filter(row => validSizeRow(row) && SAFE_FIELDS.has(row.key))
        .map(({key,bytes,items}) => ({key,bytes,items})).slice(0,14);
    }
    summary.collectionFields = visible;
  }
  return summary;
}

export async function probeMode(mode, {
  fetchImpl = fetch,
  timeoutMs = 30000,
  now = () => performance.now(),
  schedule = setTimeout,
  cancel = clearTimeout
} = {}) {
  if (!ALLOWED_MODES.includes(mode)) throw new TypeError('Only read-only ping and health modes are allowed');
  const started = now();
  const controller = new AbortController();
  let timedOut = false;
  const timer = schedule(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const target = new URL('/api/exporthub-state', PRODUCTION_BASE);
    target.searchParams.set('mode', mode);
    const response = await fetchImpl(target.toString(), {
      method: 'GET', headers: { Accept: 'application/json', 'Cache-Control': 'no-store' },
      cache: 'no-store', redirect: 'error', signal: controller.signal,
      credentials: 'omit'
    });
    const elapsedMs = Math.round(now() - started);
    const raw = await response.text();
    if (raw.length > MAX_RESPONSE_BYTES) return { mode, httpStatus: response.status, elapsedMs, errorCode: 'RESPONSE_TOO_LARGE' };
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) {
      return { mode, httpStatus: response.status, elapsedMs, errorCode: 'NON_JSON_RESPONSE' };
    }
    const metrics = safeSummary(parsed, mode);
    const good = response.status === 200 && metrics.ok === true && metrics.environment === 'production' &&
      (mode !== 'health' || (metrics.storageReachable === true && metrics.teamStateReadable === true));
    return {
      mode, httpStatus: response.status, elapsedMs, ...metrics,
      ok: good,
      ...(good ? {} : { errorCode: response.status === 200 ? 'UNHEALTHY_OR_WRONG_ENVIRONMENT' : 'HTTP_ERROR' })
    };
  } catch (_) {
    return { mode, elapsedMs: Math.round(now() - started), ok: false, errorCode: timedOut ? 'TIMEOUT' : 'NETWORK_OR_FETCH_ERROR' };
  } finally {
    cancel(timer);
  }
}
export async function runProbe({ probe = probeMode, write = console.log } = {}) {
  let ok = true;
  for (const mode of ALLOWED_MODES) {
    const result = await probe(mode);
    write(JSON.stringify(result));
    if (!result.ok) ok = false;
  }
  return ok ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProbe().then(code => { process.exitCode = code; }, () => { console.error('RC1601_PROBE_FAILURE'); process.exitCode = 1; });
}
