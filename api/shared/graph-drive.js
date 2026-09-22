'use strict';

const https = require('https');

function text(value) {
  return String(value == null ? '' : value).trim();
}

function readiness() {
  const tenantId = text(process.env.EXPORTHUB_GRAPH_TENANT_ID);
  const clientId = text(process.env.EXPORTHUB_GRAPH_CLIENT_ID);
  const clientSecret = text(process.env.EXPORTHUB_GRAPH_CLIENT_SECRET);
  const user = text(process.env.EXPORTHUB_POD_DRIVE_USER);
  const folder = text(process.env.EXPORTHUB_POD_FOLDER);
  const missing = [];
  if (!tenantId) missing.push('EXPORTHUB_GRAPH_TENANT_ID');
  if (!clientId) missing.push('EXPORTHUB_GRAPH_CLIENT_ID');
  if (!clientSecret) missing.push('EXPORTHUB_GRAPH_CLIENT_SECRET');
  if (!user) missing.push('EXPORTHUB_POD_DRIVE_USER');
  if (!folder) missing.push('EXPORTHUB_POD_FOLDER');
  return { configured: missing.length === 0, missing, user, folder };
}

function config() {
  const status = readiness();
  const tenantId = text(process.env.EXPORTHUB_GRAPH_TENANT_ID);
  const clientId = text(process.env.EXPORTHUB_GRAPH_CLIENT_ID);
  const clientSecret = text(process.env.EXPORTHUB_GRAPH_CLIENT_SECRET);
  if (!status.configured) {
    const error = new Error('Microsoft Graph ist für die POD-Sicherung noch nicht konfiguriert.');
    error.code = 'GRAPH_NOT_CONFIGURED';
    error.statusCode = 503;
    error.missing = status.missing.slice();
    throw error;
  }
  return { tenantId, clientId, clientSecret, user: status.user, folder: status.folder };
}

function request(method, url, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = https.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      method,
      headers: headers || {},
      timeout: timeoutMs || 20000
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const raw = buffer.toString('utf8');
        let parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch (_) {}
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve({ status: response.statusCode, headers: response.headers, buffer, body: parsed });
          return;
        }
        const message = parsed && parsed.error && parsed.error.message || parsed && parsed.message || raw || `HTTP ${response.statusCode}`;
        const error = new Error(message);
        error.statusCode = response.statusCode;
        error.code = parsed && parsed.error && parsed.error.code || parsed && parsed.code || 'GRAPH_REQUEST_FAILED';
        error.responseHeaders = response.headers || {};
        reject(error);
      });
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('Microsoft Graph Zeitüberschreitung.'), { code: 'GRAPH_TIMEOUT', statusCode: 504 })));
    req.on('error', error => {
      if (!error.statusCode) error.statusCode = 502;
      if (!error.code) error.code = 'GRAPH_NETWORK_ERROR';
      reject(error);
    });
    if (body) req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function transient(error) {
  const status = Number(error && error.statusCode || 0);
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || error && (error.code === 'GRAPH_TIMEOUT' || error.code === 'GRAPH_NETWORK_ERROR' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT');
}
function retryDelay(error, attempt) {
  const h = error && error.responseHeaders || {};
  const retryAfter = Number(h['retry-after'] || 0);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(5000, retryAfter * 1000);
  return Math.min(2500, 350 * Math.pow(2, Math.max(0, attempt - 1)));
}

let tokenCache = null;
let targetCache = null;
async function accessToken(force) {
  const cfg = config();
  if (!force && tokenCache && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.token;
  const form = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  }).toString();
  const result = await request('POST', `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(form),
    'Accept': 'application/json'
  }, Buffer.from(form, 'utf8'), 8000);
  const token = text(result.body && result.body.access_token);
  if (!token) throw Object.assign(new Error('Microsoft Graph hat kein Zugriffstoken geliefert.'), { code: 'GRAPH_TOKEN_MISSING', statusCode: 502 });
  tokenCache = { token, expiresAt: Date.now() + Math.max(300, Number(result.body && result.body.expires_in || 3600)) * 1000 };
  return token;
}

function safeFileName(value) {
  const name = text(value).replace(/[\/*<>?:|#%\x00-\x1F]/g, '_').replace(/\s+/g, ' ').replace(/[. ]+$/g, '').slice(0, 180);
  return name || 'POD.pdf';
}

function normalizeFolder(value) {
  const parts = text(value).replace(/\\/g, '/').split('/').map(part => part.trim()).filter(Boolean);
  if (parts.length && parts[0].toLowerCase() === 'documents') parts.shift();
  return parts.join('/');
}

function rawFolder(value) {
  return text(value).replace(/\\\\/g, '/').split('/').map(part => part.trim()).filter(Boolean).join('/');
}

function candidateFolders(value) {
  const raw = rawFolder(value);
  const normalized = normalizeFolder(value);
  const candidates = [];
  if (normalized) candidates.push(normalized);
  if (raw && raw.toLowerCase() !== normalized.toLowerCase()) candidates.push(raw);
  if (raw && !raw.toLowerCase().startsWith('documents/')) candidates.push('Documents/' + raw);
  return Array.from(new Set(candidates.filter(Boolean)));
}

function encodedPath(value) {
  return rawFolder(value).split('/').map(part => encodeURIComponent(part)).filter(Boolean).join('/');
}

function isNotFound(error) {
  return Number(error && error.statusCode || 0) === 404 || /^(ResourceNotFound|Request_ResourceNotFound|itemNotFound)$/i.test(text(error && error.code));
}

function targetError(code, message, cause) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = Number(cause && cause.statusCode || 502);
  if (error.statusCode < 400) error.statusCode = 502;
  return error;
}

function targetKey(cfg) {
  return text(cfg.user).toLowerCase() + '\\n' + rawFolder(cfg.folder).toLowerCase();
}

async function graphGet(token, path) {
  return request(
    'GET',
    `https://graph.microsoft.com/v1.0${path}`,
    { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    null,
    8000
  );
}

function personalSiteDescriptor(user) {
  const value = text(user).toLowerCase();
  const match = /^([^@]+)@([^@]+)$/.exec(value);
  if (!match) return null;
  const tenant = match[2].split('.')[0].replace(/[^a-z0-9-]/g, '');
  const account = (match[1] + '_' + match[2])
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!tenant || !account) return null;
  return { host: tenant + '-my.sharepoint.com', sitePath: 'personal/' + account };
}

async function personalSiteDrive(token, user) {
  const descriptor = personalSiteDescriptor(user);
  if (!descriptor) return null;
  const encodedSitePath = descriptor.sitePath.split('/').map(part => encodeURIComponent(part)).join('/');
  try {
    const site = await graphGet(token, `/sites/${encodeURIComponent(descriptor.host)}:/${encodedSitePath}?$select=id`);
    const siteId = text(site.body && site.body.id);
    if (!siteId) return null;
    const drive = await graphGet(token, `/sites/${encodeURIComponent(siteId)}/drive?$select=id,driveType,name`);
    return drive.body && text(drive.body.id) ? drive.body : null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function listUserDrives(token, user) {
  let result = null;
  try {
    result = await graphGet(token, `/users/${encodeURIComponent(user)}/drives?$select=id,driveType,name`);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  const drives = Array.isArray(result && result.body && result.body.value)
    ? result.body.value.filter(item => text(item && item.id))
    : [];
  if (drives.length) return drives;

  const personalDrive = await personalSiteDrive(token, user);
  if (personalDrive) return [personalDrive];

  throw targetError('GRAPH_DRIVE_NOT_FOUND', 'Das konfigurierte Microsoft-365-Zielkonto und seine persönliche SharePoint-Site wurden nicht gefunden.', { statusCode: 404 });
}

async function findFolder(token, driveId, folder) {
  const path = encodedPath(folder);
  if (!path) return null;
  try {
    const result = await graphGet(token, `/drives/${encodeURIComponent(driveId)}/root:/${path}?$select=id,name,folder,parentReference`);
    const item = result.body || {};
    const folderId = text(item.id);
    if (!folderId || !item.folder) return null;
    return { folderId, folder };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function resolveTarget(token, cfg, force) {
  const key = targetKey(cfg);
  if (!force && targetCache && targetCache.key === key && targetCache.expiresAt > Date.now()) return targetCache.value;

  const folders = candidateFolders(cfg.folder);
  if (!folders.length) throw targetError('GRAPH_FOLDER_INVALID', 'Der konfigurierte Microsoft-365-Zielordner ist ungültig.', { statusCode: 500 });

  const drives = await listUserDrives(token, cfg.user);
  const matches = [];

  for (const drive of drives) {
    const driveId = text(drive && drive.id);
    if (!driveId) continue;
    for (const folder of folders) {
      const found = await findFolder(token, driveId, folder);
      if (!found) continue;
      matches.push({ driveId, folderId: found.folderId, folder: found.folder });
      break;
    }
  }

  const unique = Array.from(new Map(matches.map(item => [item.driveId + ':' + item.folderId, item])).values());
  if (!unique.length) throw targetError('GRAPH_FOLDER_NOT_FOUND', 'Der konfigurierte Microsoft-365-Zielordner wurde in keinem erreichbaren Laufwerk gefunden.', { statusCode: 404 });
  if (unique.length > 1) throw targetError('GRAPH_TARGET_AMBIGUOUS', 'Der konfigurierte Microsoft-365-Zielordner ist nicht eindeutig.', { statusCode: 409 });

  targetCache = { key, value: unique[0], expiresAt: Date.now() + 10 * 60 * 1000 };
  return unique[0];
}

async function uploadPdf(buffer, fileName) {
  const cfg = config();
  const name = safeFileName(fileName);
  let forceToken = false;
  let forceTarget = false;
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const token = await accessToken(forceToken);
      const target = await resolveTarget(token, cfg, forceTarget);
      const result = await request('PUT', `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(target.driveId)}/items/${encodeURIComponent(target.folderId)}:/${encodeURIComponent(name)}:/content`, {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/pdf',
        'Content-Length': buffer.length,
        'Accept': 'application/json'
      }, buffer, 8000);
      const item = result.body || {};
      return {
        id: text(item.id),
        name: text(item.name) || name,
        size: Number(item.size || buffer.length),
        webUrl: text(item.webUrl),
        eTag: text(item.eTag),
        user: cfg.user,
        folder: target.folder,
        attempts: attempt
      };
    } catch (error) {
      lastError = error;
      if (error && error.statusCode === 401 && !forceToken) {
        tokenCache = null;
        targetCache = null;
        forceToken = true;
        forceTarget = true;
        continue;
      }
      if (isNotFound(error) && attempt < 3 && !/^GRAPH_(DRIVE|FOLDER)_NOT_FOUND$/.test(text(error.code))) {
        targetCache = null;
        forceTarget = true;
        forceToken = false;
        continue;
      }
      if (attempt < 3 && transient(error)) {
        await sleep(retryDelay(error, attempt));
        forceToken = false;
        forceTarget = false;
        continue;
      }
      throw error;
    }
  }
  throw lastError || Object.assign(new Error('Microsoft-365-POD-Sicherung ist fehlgeschlagen.'), { code: 'GRAPH_UPLOAD_FAILED', statusCode: 502 });
}

module.exports = { readiness, config, uploadPdf, safeFileName, normalizeFolder };
