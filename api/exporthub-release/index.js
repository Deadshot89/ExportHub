'use strict';

const crypto = require('crypto');

const CONTAINER = 'exporthub-releases';
const MANIFEST_BLOB = 'manifest.json';
const MAX_HTML_BYTES = 12 * 1024 * 1024;
const STORAGE_VERSION = '2023-11-03';

function text(v) { return String(v == null ? '' : v).trim(); }
function lower(v) { return text(v).toLowerCase(); }
function nowIso() { return new Date().toISOString(); }
function json(status, body) {
  return { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}
function header(req, name) {
  const h = req && req.headers || {};
  const key = Object.keys(h).find(k => lower(k) === lower(name));
  return key ? text(h[key]) : '';
}
function parseBody(req) {
  if (req == null) return {};
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : text(req.body || req.rawBody);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}
function rawBody(req) {
  if (Buffer.isBuffer(req && req.rawBody)) return req.rawBody;
  if (Buffer.isBuffer(req && req.body)) return req.body;
  const v = req && (req.rawBody != null ? req.rawBody : req.body);
  return Buffer.from(String(v == null ? '' : v), 'utf8');
}
function safeVersion(v) {
  const m = text(v).toUpperCase().match(/^RC(\d{1,7})$/);
  return m ? 'RC' + m[1] : '';
}
function detectVersion(html) {
  const s = String(html || '');
  let m = s.match(/version\s*:\s*['"](RC\d+)['"]/i);
  if (!m) m = s.match(/data-exporthub-version\s*=\s*['"](RC\d+)['"]/i);
  if (!m) m = s.match(/Aktuelle Version\s+(RC\d+)/i);
  return safeVersion(m && m[1]);
}
function isGlobalAdmin(user) {
  if (!user) return false;
  const role = lower(user.role || user.rolle);
  const key = lower(user.user || user.login || user.username || user.name);
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return key === 'tobias' || user.globalAdmin === true || role === 'admin' || /global.?admin|administrator|vollzugriff/i.test(role) || permissions.indexOf('*') >= 0;
}
function tokenFromReq(req) {
  return text(header(req, 'x-exporthub-token') || header(req, 'x-exporthub-session') || header(req, 'authorization').replace(/^Bearer\s+/i, ''));
}
function requestOrigin(req) {
  const proto = text(header(req, 'x-forwarded-proto') || 'https').split(',')[0];
  const host = text(header(req, 'x-forwarded-host') || header(req, 'host')).split(',')[0];
  return host ? proto + '://' + host : '';
}
async function requireAdmin(req) {
  const token = tokenFromReq(req);
  if (!token) {
    const e = new Error('ExportHUB-Sitzung fehlt.'); e.code = 'AUTH_REQUIRED'; e.status = 401; throw e;
  }
  const origin = requestOrigin(req);
  if (!origin) {
    const e = new Error('Serveradresse für die Sitzungsprüfung fehlt.'); e.code = 'AUTH_ORIGIN_MISSING'; e.status = 500; throw e;
  }
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-ExportHUB-Token': token,
    'X-ExportHUB-Session': token,
    'Authorization': 'Bearer ' + token
  };
  const res = await fetch(origin + '/api/exporthub-auth', {
    method: 'POST', headers, cache: 'no-store',
    body: JSON.stringify({ action: 'session', sessionToken: token, authToken: token })
  });
  let body = {};
  try { body = await res.json(); } catch (_) { body = {}; }
  if (!res.ok || body.ok === false || !body.user) {
    const e = new Error(body.message || 'ExportHUB-Sitzung ist ungültig.'); e.code = body.code || 'SESSION_INVALID'; e.status = res.status || 401; throw e;
  }
  if (!isGlobalAdmin(body.user)) {
    const e = new Error('Nur globale Administratoren dürfen Testversionen und Releases verwalten.'); e.code = 'ADMIN_REQUIRED'; e.status = 403; throw e;
  }
  return body.user;
}

function parseConnectionString(value) {
  const out = {};
  text(value).split(';').forEach(part => {
    const i = part.indexOf('='); if (i <= 0) return;
    out[part.slice(0, i)] = part.slice(i + 1);
  });
  if (!out.AccountName || !out.AccountKey) throw Object.assign(new Error('EXPORTHUB_STORAGE_CONNECTION_STRING enthält keinen AccountName/AccountKey.'), { code: 'STORAGE_CONFIG_INVALID', status: 500 });
  let endpoint = text(out.BlobEndpoint);
  if (!endpoint) endpoint = (out.DefaultEndpointsProtocol || 'https') + '://' + out.AccountName + '.blob.' + (out.EndpointSuffix || 'core.windows.net');
  return { account: out.AccountName, key: out.AccountKey, endpoint: endpoint.replace(/\/$/, '') };
}
function storage() { return parseConnectionString(process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || ''); }
function encodeBlobPath(name) { return String(name || '').split('/').map(encodeURIComponent).join('/'); }
function canonicalizedHeaders(headers) {
  return Object.keys(headers).filter(k => lower(k).startsWith('x-ms-')).map(k => [lower(k), String(headers[k]).trim().replace(/\s+/g, ' ')]).sort((a,b) => a[0].localeCompare(b[0])).map(x => x[0] + ':' + x[1] + '\n').join('');
}
function canonicalizedResource(account, container, blob, query) {
  let r = '/' + account + '/' + container + (blob ? '/' + blob : '');
  const q = query || {};
  Object.keys(q).sort().forEach(k => { r += '\n' + lower(k) + ':' + text(q[k]); });
  return r;
}
function signStorage(method, contentLength, contentType, headers, container, blob, query) {
  const st = storage();
  const len = Number(contentLength || 0) === 0 ? '' : String(contentLength);
  const stringToSign = [
    method.toUpperCase(), '', '', len, '', contentType || '', '', '', '', '', '', '',
    canonicalizedHeaders(headers) + canonicalizedResource(st.account, container, blob, query)
  ].join('\n');
  const signature = crypto.createHmac('sha256', Buffer.from(st.key, 'base64')).update(stringToSign, 'utf8').digest('base64');
  return 'SharedKey ' + st.account + ':' + signature;
}
async function storageRequest(method, blob, options) {
  options = options || {};
  const st = storage();
  const body = options.body == null ? null : (Buffer.isBuffer(options.body) ? options.body : Buffer.from(String(options.body), 'utf8'));
  const query = options.query || {};
  const queryString = Object.keys(query).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(query[k])).join('&');
  const url = st.endpoint + '/' + CONTAINER + (blob ? '/' + encodeBlobPath(blob) : '') + (queryString ? '?' + queryString : '');
  const headers = Object.assign({}, options.headers || {});
  headers['x-ms-date'] = new Date().toUTCString();
  headers['x-ms-version'] = STORAGE_VERSION;
  if (options.blobType) headers['x-ms-blob-type'] = options.blobType;
  const contentType = headers['Content-Type'] || headers['content-type'] || '';
  if (body) headers['Content-Length'] = String(body.length);
  headers['Authorization'] = signStorage(method, body ? body.length : 0, contentType, headers, CONTAINER, blob, query);
  const res = await fetch(url, { method, headers, body });
  if (!res.ok && !(options.allow404 && res.status === 404) && !(options.allow409 && res.status === 409)) {
    const tx = await res.text().catch(() => '');
    const e = new Error('Azure Blob Storage HTTP ' + res.status + (tx ? ': ' + tx.slice(0, 240) : ''));
    e.code = 'STORAGE_HTTP_' + res.status; e.status = 500; throw e;
  }
  return res;
}
async function ensureContainer() {
  await storageRequest('PUT', '', { query: { restype: 'container' }, allow409: true });
}
async function readBlob(name, allowMissing) {
  const res = await storageRequest('GET', name, { allow404: !!allowMissing });
  if (res.status === 404) return null;
  return Buffer.from(await res.arrayBuffer());
}
async function writeBlob(name, body, contentType) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  await storageRequest('PUT', name, { body: buf, blobType: 'BlockBlob', headers: { 'Content-Type': contentType || 'application/octet-stream', 'Cache-Control': 'no-store' } });
}
function emptyManifest() {
  return { schema: 1, production: null, test: null, previousProduction: null, updatedAt: null, releases: [] };
}
async function loadManifest() {
  await ensureContainer();
  const buf = await readBlob(MANIFEST_BLOB, true);
  if (!buf) return emptyManifest();
  try {
    const m = JSON.parse(buf.toString('utf8'));
    m.releases = Array.isArray(m.releases) ? m.releases : [];
    return Object.assign(emptyManifest(), m);
  } catch (_) { return emptyManifest(); }
}
async function saveManifest(m) {
  m.updatedAt = nowIso();
  await writeBlob(MANIFEST_BLOB, JSON.stringify(m, null, 2), 'application/json; charset=utf-8');
}
function releaseByVersion(m, version) { return (m.releases || []).find(r => safeVersion(r.version) === safeVersion(version)); }
function publicManifest(m) {
  return {
    ok: true, schema: m.schema || 1, production: m.production || null, test: m.test || null,
    previousProduction: m.previousProduction || null, updatedAt: m.updatedAt || null,
    releases: (m.releases || []).map(r => ({
      version: r.version, uploadedAt: r.uploadedAt, uploadedBy: r.uploadedBy, size: r.size, sha256: r.sha256,
      testedAt: r.testedAt || null, testedBy: r.testedBy || null, promotedAt: r.promotedAt || null, promotedBy: r.promotedBy || null
    }))
  };
}
function userLabel(u) { return text(u && (u.name || u.user || u.login || u.username)) || 'Global Admin'; }
function errorResponse(e) {
  const status = Number(e && e.status || 500);
  return json(status, { ok: false, code: text(e && e.code) || 'RELEASE_ERROR', message: text(e && e.message) || 'Release-Fehler' });
}

module.exports = async function (context, req) {
  try {
    const action = lower(req.query && req.query.action || 'active');
    const channel = lower(req.query && req.query.channel || 'production');

    if (action === 'active') {
      const m = await loadManifest();
      const ver = safeVersion(channel === 'test' ? m.test : m.production);
      if (channel === 'test') await requireAdmin(req);
      if (!ver) return context.res = json(200, { ok: true, channel, version: null });
      const r = releaseByVersion(m, ver);
      return context.res = json(200, { ok: true, channel, version: ver, size: r && r.size || 0, sha256: r && r.sha256 || '', updatedAt: m.updatedAt });
    }

    if (action === 'html') {
      const m = await loadManifest();
      if (channel === 'test') await requireAdmin(req);
      const ver = safeVersion(channel === 'test' ? m.test : m.production);
      if (!ver) return context.res = json(404, { ok: false, code: 'NO_ACTIVE_RELEASE', message: 'Für ' + channel + ' ist noch keine RC aktiviert.' });
      const r = releaseByVersion(m, ver);
      if (!r || !r.blob) return context.res = json(404, { ok: false, code: 'RELEASE_NOT_FOUND', message: ver + ' wurde im Release-Speicher nicht gefunden.' });
      const buf = await readBlob(r.blob, false);
      return context.res = { status: 200, isRaw: true, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'X-ExportHUB-Release': ver, 'X-ExportHUB-Channel': channel }, body: buf };
    }

    const admin = await requireAdmin(req);
    const who = userLabel(admin);

    if (action === 'list') {
      const m = await loadManifest();
      return context.res = json(200, publicManifest(m));
    }

    if (action === 'upload') {
      const buf = rawBody(req);
      if (!buf.length) return context.res = json(400, { ok: false, code: 'EMPTY_UPLOAD', message: 'Die RC-HTML-Datei ist leer.' });
      if (buf.length > MAX_HTML_BYTES) return context.res = json(413, { ok: false, code: 'RELEASE_TOO_LARGE', message: 'Die RC-Datei ist größer als 12 MB.' });
      const html = buf.toString('utf8');
      if (!/<html[\s>]/i.test(html) || !/<script/i.test(html)) return context.res = json(400, { ok: false, code: 'INVALID_HTML', message: 'Die Datei ist kein gültiges ExportHUB-HTML-Dokument.' });
      const requested = safeVersion(req.query && req.query.version || header(req, 'x-exporthub-version'));
      const detected = detectVersion(html);
      const version = requested || detected;
      if (!version || (detected && version !== detected)) return context.res = json(400, { ok: false, code: 'VERSION_MISMATCH', message: 'RC-Version konnte nicht eindeutig geprüft werden.' });
      const m = await loadManifest();
      if (releaseByVersion(m, version)) return context.res = json(409, { ok: false, code: 'VERSION_EXISTS', message: version + ' existiert bereits. Jede RC bleibt unveränderlich; bitte eine neue RC-Nummer verwenden.' });
      const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
      const blob = 'releases/' + version + '.html';
      await writeBlob(blob, buf, 'text/html; charset=utf-8');
      m.releases.push({ version, blob, uploadedAt: nowIso(), uploadedBy: who, size: buf.length, sha256, testedAt: null, testedBy: null, promotedAt: null, promotedBy: null });
      m.test = version;
      await saveManifest(m);
      return context.res = json(201, { ok: true, version, test: m.test, size: buf.length, sha256 });
    }

    const body = parseBody(req);
    if (action === 'set-test') {
      const version = safeVersion(body.version);
      const m = await loadManifest();
      if (!releaseByVersion(m, version)) return context.res = json(404, { ok: false, code: 'RELEASE_NOT_FOUND', message: version + ' wurde nicht gefunden.' });
      m.test = version; await saveManifest(m);
      return context.res = json(200, { ok: true, test: version });
    }
    if (action === 'mark-tested') {
      const version = safeVersion(body.version);
      const m = await loadManifest(); const r = releaseByVersion(m, version);
      if (!r) return context.res = json(404, { ok: false, code: 'RELEASE_NOT_FOUND', message: version + ' wurde nicht gefunden.' });
      r.testedAt = nowIso(); r.testedBy = who; await saveManifest(m);
      return context.res = json(200, { ok: true, version, testedAt: r.testedAt });
    }
    if (action === 'promote') {
      const version = safeVersion(body.version);
      const m = await loadManifest(); const r = releaseByVersion(m, version);
      if (!r) return context.res = json(404, { ok: false, code: 'RELEASE_NOT_FOUND', message: version + ' wurde nicht gefunden.' });
      if (!r.testedAt) return context.res = json(409, { ok: false, code: 'TEST_REQUIRED', message: version + ' muss vor der Produktionsfreigabe als getestet markiert werden.' });
      if (safeVersion(m.production) !== version) m.previousProduction = safeVersion(m.production) || m.previousProduction || null;
      m.production = version; r.promotedAt = nowIso(); r.promotedBy = who; await saveManifest(m);
      return context.res = json(200, { ok: true, production: version, previousProduction: m.previousProduction });
    }
    if (action === 'rollback') {
      const m = await loadManifest(); const prev = safeVersion(m.previousProduction);
      if (!prev || !releaseByVersion(m, prev)) return context.res = json(409, { ok: false, code: 'NO_ROLLBACK', message: 'Es ist keine gültige vorherige Produktionsversion gespeichert.' });
      const current = safeVersion(m.production); m.production = prev; m.previousProduction = current || null; await saveManifest(m);
      return context.res = json(200, { ok: true, production: m.production, previousProduction: m.previousProduction });
    }

    return context.res = json(400, { ok: false, code: 'UNKNOWN_ACTION', message: 'Unbekannte Release-Aktion: ' + action });
  } catch (e) {
    context.log && context.log.error && context.log.error('exporthub-release', e);
    context.res = errorResponse(e);
  }
};
