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

function encodedPath(value) {
  return text(value).split('/').map(part => encodeURIComponent(text(part))).filter(Boolean).join('/');
}

function graphTargetError(code, message, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode || 502;
  return error;
}

function candidateFolders(folder) {
  const normalized = text(folder).replace(/^\/+|\/+$/g, '');
  const out = [];
  if (normalized) out.push(normalized);
  const lower = normalized.toLowerCase();
  if (normalized && lower !== 'documents' && !lower.startsWith('documents/')) out.push('Documents/' + normalized);
  return Array.from(new Set(out));
}

const targetCache = new Map();

function targetCacheKey(cfg) {
  return cfg.user.toLowerCase() + '\\n' + cfg.folder;
}

function targetCacheDelete(cfg) {
  targetCache.delete(targetCacheKey(cfg));
}

async function graphGet(token, path) {
  return request('GET', `https://graph.microsoft.com/v1.0${path}`, {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  }, null, 8000);
}

async function listUserDrives(token, user) {
  const result = await graphGet(token, `/users/${encodeURIComponent(user)}/drives?$select=id,driveType,name`);
  const drives = Array.isArray(result.body && result.body.value) ? result.body.value.filter(item => text(item && item.id)) : [];
  if (!drives.length) {
    throw graphTargetError('GRAPH_DRIVE_NOT_FOUND', 'Das konfigurierte Microsoft-365-Zielkonto hat kein für ExportHUB erreichbares Laufwerk.', 404);
  }
  return drives;
}

async function findFolder(token, driveId, folder) {
  const path = encodedPath(folder);
  if (!path) return null;
  try {
    const result = await graphGet(token, `/drives/${encodeURIComponent(driveId)}/root:/${path}?$select=id,name,folder`);
    const item = result.body || {};
    if (!text(item.id) || !item.folder) return null;
    return { id: text(item.id) };
  } catch (error) {
    if (error && error.statusCode === 404 && /^(?:ResourceNotFound|itemNotFound)$/i.test(text(error.code))) return null;
    throw error;
  }
}

async function resolveUploadTarget(token, cfg) {
  const key = targetCacheKey(cfg);
  const cached = targetCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.target;

  const drives = await listUserDrives(token, cfg.user);
  const folders = candidateFolders(cfg.folder);
  const matches = [];

  for (const drive of drives) {
    const driveId = text(drive && drive.id);
    if (!driveId) continue;
    for (const folder of folders) {
      const item = await findFolder(token, driveId, folder);
      if (item) matches.push({ driveId, folderItemId: item.id });
    }
  }

  const unique = Array.from(new Map(matches.map(item => [item.driveId + ':' + item.folderItemId, item])).values());
  if (!unique.length) {
    throw graphTargetError('GRAPH_FOLDER_NOT_FOUND', 'Der konfigurierte Microsoft-365-POD-Zielordner wurde nicht gefunden.', 404);
  }
  if (unique.length > 1) {
    throw graphTargetError('GRAPH_TARGET_AMBIGUOUS', 'Der konfigurierte Microsoft-365-POD-Zielordner ist nicht eindeutig.', 409);
  }

  targetCache.set(key, { expiresAt: Date.now() + 10 * 60 * 1000, target: unique[0] });
  return unique[0];
}

async function uploadPdf(buffer, fileName) {
  const cfg = config();
  const name = safeFileName(fileName);
  let forceToken = false;
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const token = await accessToken(forceToken);
      const target = await resolveUploadTarget(token, cfg);
      const result = await request('PUT', `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(target.driveId)}/items/${encodeURIComponent(target.folderItemId)}:/${encodeURIComponent(name)}:/content`, {
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
        folder: cfg.folder,
        attempts: attempt
      };
    } catch (error) {
      lastError = error;
      if (error && error.statusCode === 401 && !forceToken) {
        tokenCache = null;
        targetCacheDelete(cfg);
        forceToken = true;
        continue;
      }
      if (error && error.statusCode === 404 && /^(?:ResourceNotFound|itemNotFound)$/i.test(text(error.code)) && attempt < 3) {
        targetCacheDelete(cfg);
        forceToken = false;
        continue;
      }
      if (attempt < 3 && transient(error)) {
        await sleep(retryDelay(error, attempt));
        forceToken = false;
        continue;
      }
      throw error;
    }
  }
  throw lastError || Object.assign(new Error('Microsoft-365-POD-Sicherung ist fehlgeschlagen.'), { code: 'GRAPH_UPLOAD_FAILED', statusCode: 502 });
}

module.exports = { readiness, config, uploadPdf, safeFileName };
