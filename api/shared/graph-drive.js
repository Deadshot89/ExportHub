'use strict';

const https = require('https');
const crypto = require('crypto');

function text(value) {
  return String(value == null ? '' : value).trim();
}

function readiness() {
  const tenantId = text(process.env.EXPORTHUB_GRAPH_TENANT_ID);
  const clientId = text(process.env.EXPORTHUB_GRAPH_CLIENT_ID);
  const clientSecret = text(process.env.EXPORTHUB_GRAPH_CLIENT_SECRET);
  const user = text(process.env.EXPORTHUB_POD_DRIVE_USER);
  const folder = text(process.env.EXPORTHUB_POD_FOLDER);
  const driveId = text(process.env.EXPORTHUB_POD_DRIVE_ID);
  const folderId = text(process.env.EXPORTHUB_POD_FOLDER_ID);
  const missing = [];
  if (!tenantId) missing.push('EXPORTHUB_GRAPH_TENANT_ID');
  if (!clientId) missing.push('EXPORTHUB_GRAPH_CLIENT_ID');
  if (!clientSecret) missing.push('EXPORTHUB_GRAPH_CLIENT_SECRET');
  // RC1712: an explicitly configured Graph drive+folder ID pair is an
  // independent, valid target. A user/path lookup must not be required in
  // this mode. Reject half-configured ID pairs instead of silently falling
  // back to a different user's folder.
  if (driveId || folderId) {
    if (!driveId) missing.push('EXPORTHUB_POD_DRIVE_ID');
    if (!folderId) missing.push('EXPORTHUB_POD_FOLDER_ID');
  } else {
    if (!user) missing.push('EXPORTHUB_POD_DRIVE_USER');
    if (!folder) missing.push('EXPORTHUB_POD_FOLDER');
  }
  return { configured: missing.length === 0, missing, user, folder, driveId, folderId };
}

function config() {
  const status = readiness();
  const tenantId = text(process.env.EXPORTHUB_GRAPH_TENANT_ID);
  const clientId = text(process.env.EXPORTHUB_GRAPH_CLIENT_ID);
  const clientSecret = text(process.env.EXPORTHUB_GRAPH_CLIENT_SECRET);
  if (!status.configured) {
    // Preserve the established fail-closed Graph error for incomplete exact
    // targets while reporting the missing ID in readiness diagnostics.
    const incompleteExact = !!status.driveId !== !!status.folderId;
    const error = new Error(incompleteExact
      ? 'Das explizite Microsoft-365-POD-Ziel ist unvollständig konfiguriert.'
      : 'Microsoft Graph ist für die POD-Sicherung noch nicht konfiguriert.');
    error.code = incompleteExact ? 'GRAPH_EXACT_TARGET_INCOMPLETE' : 'GRAPH_NOT_CONFIGURED';
    error.statusCode = 503;
    error.missing = status.missing.slice();
    throw error;
  }
  return { tenantId, clientId, clientSecret, user: status.user, folder: status.folder, driveId: status.driveId, folderId: status.folderId };
}

function request(method, url, headers, body, timeoutMs, maxBytes) {
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
      let totalBytes = 0, tooLarge = false;
      response.on('data', chunk => {
        if (tooLarge) return;
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += bytes.length;
        if (maxBytes && totalBytes > maxBytes) {
          tooLarge = true;
          reject(Object.assign(new Error('Die Graph-POD-Rücklesedatei ist größer als das Original.'),
            { code: 'GRAPH_READBACK_TOO_LARGE', statusCode: 502 }));
          if (typeof response.destroy === 'function') response.destroy();
          return;
        }
        chunks.push(bytes);
      });
      response.on('end', () => {
        if (tooLarge) return;
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
let targetFailureCache = null;
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
  return [
    text(cfg.user).toLowerCase(),
    rawFolder(cfg.folder).toLowerCase(),
    text(cfg.driveId).toLowerCase(),
    text(cfg.folderId).toLowerCase()
  ].join('\\n');
}

function cachedTargetFailure(cfg) {
  const key = targetKey(cfg);
  if (!targetFailureCache || targetFailureCache.key !== key || targetFailureCache.expiresAt <= Date.now()) return null;
  const error = new Error(targetFailureCache.message || 'GRAPH_TARGET_FAILED');
  error.code = targetFailureCache.code || 'GRAPH_TARGET_FAILED';
  error.statusCode = Number(targetFailureCache.statusCode || 502);
  return error;
}

function rememberTargetFailure(cfg, error) {
  const code = text(error && error.code);
  if (!/^(?:GRAPH_SHARE_TARGET_FAILED|GRAPH_PERSONAL_SITE_TARGET_FAILED|GRAPH_DIRECT_PATH_TARGET_FAILED|GRAPH_SHARED_DRIVE_SEARCH_FAILED|GRAPH_DEFAULT_DRIVE_TARGET_FAILED|GRAPH_FOLDER_NOT_FOUND|GRAPH_TARGET_AMBIGUOUS)$/.test(code)) return false;
  targetFailureCache = {
    key: targetKey(cfg),
    code,
    statusCode: Number(error && error.statusCode || 502),
    message: text(error && error.message),
    expiresAt: Date.now() + 60 * 1000
  };
  return true;
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

function personalFolderWebUrl(user, folder) {
  const descriptor = personalSiteDescriptor(user);
  if (!descriptor) return '';
  const raw = rawFolder(folder);
  if (!raw) return '';
  const drivePath = /^documents\//i.test(raw) ? raw : 'Documents/' + raw;
  const encoded = drivePath.split('/').map(part => encodeURIComponent(part)).join('/');
  return 'https://' + descriptor.host + '/' + descriptor.sitePath + '/' + encoded;
}

function sharingToken(url) {
  const value = text(url);
  if (!value) return '';
  return 'u!' + Buffer.from(value, 'utf8').toString('base64')
    .replace(/=+$/g, '')
    .replace(/\//g, '_')
    .replace(/\+/g, '-');
}

async function resolvePersonalFolderTarget(token, user, folder) {
  const webUrl = personalFolderWebUrl(user, folder);
  const shareId = sharingToken(webUrl);
  if (!shareId) return null;
  try {
    const result = await graphGet(token, `/shares/${shareId}/driveItem?$select=id,name,folder,parentReference`);
    const item = result.body || {};
    const folderId = text(item.id);
    const driveId = text(item.parentReference && item.parentReference.driveId);
    if (!folderId || !driveId || !item.folder) return null;
    return {
      driveId,
      folderId,
      folder: /^documents\//i.test(rawFolder(folder)) ? rawFolder(folder) : 'Documents/' + rawFolder(folder)
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    const wrapped = targetError(
      'GRAPH_SHARE_TARGET_FAILED',
      'Das explizite Microsoft-365-POD-Ziel konnte nicht über seine OneDrive-URL aufgelöst werden.',
      error
    );
    wrapped.graphCode = text(error && error.code);
    throw wrapped;
  }
}

async function listUserDrives(token, user) {
  let result = null;
  try {
    result = await graphGet(token, `/users/${encodeURIComponent(user)}/drives?$select=id,driveType,name`);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  return Array.isArray(result && result.body && result.body.value)
    ? result.body.value.filter(item => text(item && item.id))
    : [];
}

async function resolveDefaultUserDriveTarget(token, user, folders) {
  for (const folder of Array.isArray(folders) ? folders : []) {
    const path = encodedPath(folder);
    if (!path) continue;
    try {
      const result = await graphGet(token, `/users/${encodeURIComponent(user)}/drive/root:/${path}?$select=id,name,folder,parentReference`);
      const item = result.body || {};
      const folderId = text(item.id);
      const driveId = text(item.parentReference && item.parentReference.driveId);
      if (folderId && driveId && item.folder) return { driveId, folderId, folder };
    } catch (error) {
      if (isNotFound(error)) continue;
      throw targetError(
        'GRAPH_DEFAULT_DRIVE_TARGET_FAILED',
        'Das explizite Microsoft-365-POD-Ziel konnte im konfigurierten Benutzerlaufwerk nicht aufgelöst werden.',
        error
      );
    }
  }
  return null;
}

function folderLeaf(value) {
  const parts = rawFolder(value).split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function normalizedComparablePath(value) {
  return rawFolder(value)
    .replace(/^root:\/+/i, '')
    .replace(/^drives\/[^/]+\/root:\/+/i, '')
    .replace(/^documents\//i, '')
    .toLowerCase();
}

function folderSearchScore(item, wantedFolder) {
  const wanted = normalizedComparablePath(wantedFolder);
  const name = text(item && item.name).toLowerCase();
  const parentPath = normalizedComparablePath(item && item.parentReference && item.parentReference.path || '');
  const actual = [parentPath, name].filter(Boolean).join('/').replace(/^\/+/, '');
  if (!wanted || !actual) return 0;
  if (actual === wanted) return 100;
  if (actual.endsWith('/' + wanted)) return 90;
  const wantedParts = wanted.split('/').filter(Boolean);
  const actualParts = actual.split('/').filter(Boolean);
  let tail = 0;
  while (
    tail < wantedParts.length &&
    tail < actualParts.length &&
    wantedParts[wantedParts.length - 1 - tail] === actualParts[actualParts.length - 1 - tail]
  ) tail += 1;
  return tail >= 2 ? 50 + tail : 0;
}

async function searchFolderInDrive(token, driveId, wantedFolder) {
  const leaf = folderLeaf(wantedFolder);
  if (!leaf || !driveId) return null;
  let result;
  try {
    result = await graphGet(
      token,
      `/drives/${encodeURIComponent(driveId)}/root/search(q='${encodeURIComponent(leaf)}')?$select=id,name,folder,parentReference,webUrl`
    );
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
  const rows = Array.isArray(result && result.body && result.body.value) ? result.body.value : [];
  const ranked = rows
    .filter(item => item && item.folder && text(item.id))
    .map(item => ({ item, score: folderSearchScore(item, wantedFolder) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  if (ranked.length > 1 && ranked[0].score === ranked[1].score && text(ranked[0].item.id) !== text(ranked[1].item.id)) {
    throw targetError('GRAPH_TARGET_AMBIGUOUS', 'Der konfigurierte Microsoft-365-POD-Zielordner wurde mehrfach gefunden.', { statusCode: 409 });
  }
  const item = ranked[0].item;
  const resolvedDriveId = text(item.parentReference && item.parentReference.driveId) || text(driveId);
  return {
    driveId: resolvedDriveId,
    folderId: text(item.id),
    folder: wantedFolder
  };
}

async function searchConfiguredFolderTargets(token, user, drives, folders) {
  const found = [];
  for (const drive of Array.isArray(drives) ? drives : []) {
    const driveId = text(drive && drive.id);
    if (!driveId) continue;
    for (const folder of Array.isArray(folders) ? folders : []) {
      const match = await searchFolderInDrive(token, driveId, folder);
      if (match) {
        found.push(match);
        break;
      }
    }
  }

  const unique = Array.from(new Map(found.map(item => [item.driveId + ':' + item.folderId, item])).values());
  if (unique.length > 1) throw targetError('GRAPH_TARGET_AMBIGUOUS', 'Der konfigurierte Microsoft-365-POD-Zielordner ist nicht eindeutig.', { statusCode: 409 });
  return unique[0] || null;
}

function sharedSearchItem(item, defaultDriveId) {
  if (!item) return null;
  const remoteCandidate = item.remoteItem || null;
  const remote = remoteCandidate &&
    text(remoteCandidate.id) &&
    text(remoteCandidate.parentReference && remoteCandidate.parentReference.driveId)
    ? remoteCandidate
    : null;
  // Graph kann bei freigegebenen Ordnern die folder-Facette am lokalen
  // Suchtreffer liefern, während remoteItem nur Ziel-ID und driveId enthält.
  // In diesem Fall muss trotzdem das Remote-Ziel verwendet werden.
  if (!item.folder && !(remote && remote.folder)) return null;
  const source = remote || item;
  const folderId = text(source.id || item.id);
  const driveId = text(source.parentReference && source.parentReference.driveId) ||
    text(item.parentReference && item.parentReference.driveId) ||
    text(defaultDriveId);
  if (!folderId || !driveId) return null;
  return {
    driveId,
    folderId,
    name: text(source.name || item.name),
    parentReference: source.parentReference || item.parentReference || {},
    remote: !!remote
  };
}

async function searchAccessibleUserDriveTargets(token, user, folders) {
  let defaultDrive;
  try {
    defaultDrive = await graphGet(token, `/users/${encodeURIComponent(user)}/drive?$select=id`);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw targetError(
      'GRAPH_DEFAULT_DRIVE_TARGET_FAILED',
      'Das konfigurierte Microsoft-365-Benutzerlaufwerk konnte für die freigegebene POD-Zielsuche nicht gelesen werden.',
      error
    );
  }

  const defaultDriveId = text(defaultDrive && defaultDrive.body && defaultDrive.body.id);
  if (!defaultDriveId) return null;

  const matches = [];
  const foldersByLeaf = new Map();
  for (const folder of Array.isArray(folders) ? folders : []) {
    const leaf = folderLeaf(folder);
    if (!leaf) continue;
    const key = leaf.toLowerCase();
    if (!foldersByLeaf.has(key)) foldersByLeaf.set(key, { leaf, folders: [] });
    foldersByLeaf.get(key).folders.push(folder);
  }

  for (const group of foldersByLeaf.values()) {
    let result;
    try {
      result = await graphGet(
        token,
        `/drives/${encodeURIComponent(defaultDriveId)}/root/search(q='${encodeURIComponent(group.leaf)}')?$select=id,name,folder,parentReference,remoteItem,webUrl`
      );
    } catch (error) {
      if (isNotFound(error)) continue;
      throw targetError(
        'GRAPH_SHARED_DRIVE_SEARCH_FAILED',
        'Freigegebene Microsoft-365-Ordner konnten im konfigurierten Benutzerlaufwerk nicht durchsucht werden.',
        error
      );
    }
    const rows = Array.isArray(result && result.body && result.body.value) ? result.body.value : [];
    for (const row of rows) {
      const candidate = sharedSearchItem(row, defaultDriveId);
      if (!candidate) continue;
      let best = null;
      for (const folder of group.folders) {
        const score = folderSearchScore(candidate, folder);
        if (score > 0 && (!best || score > best.score)) best = { folder, score };
      }
      if (best) matches.push({ ...candidate, folder: best.folder, score: best.score });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  if (!matches.length) return null;
  if (
    matches.length > 1 &&
    matches[0].score === matches[1].score &&
    (matches[0].driveId !== matches[1].driveId || matches[0].folderId !== matches[1].folderId)
  ) {
    throw targetError(
      'GRAPH_TARGET_AMBIGUOUS',
      'Der konfigurierte Microsoft-365-POD-Zielordner wurde unter den freigegebenen Elementen mehrfach gefunden.',
      { statusCode: 409 }
    );
  }
  return {
    driveId: matches[0].driveId,
    folderId: matches[0].folderId,
    folder: matches[0].folder
  };
}

function encodedSitePath(value) {
  return rawFolder(value).split('/').map(part => encodeURIComponent(part)).filter(Boolean).join('/');
}

async function resolvePersonalSiteFolderTarget(token, user, folders) {
  const descriptor = personalSiteDescriptor(user);
  if (!descriptor) return null;

  let siteResult;
  try {
    siteResult = await graphGet(
      token,
      `/sites/${descriptor.host}:/${encodedSitePath(descriptor.sitePath)}?$select=id,webUrl`
    );
  } catch (error) {
    if (isNotFound(error)) return null;
    const wrapped = targetError(
      'GRAPH_PERSONAL_SITE_TARGET_FAILED',
      'Die konfigurierte Microsoft-365-Personal-Site konnte nicht über Microsoft Graph aufgelöst werden.',
      error
    );
    wrapped.graphCode = text(error && error.code);
    throw wrapped;
  }

  const siteId = text(siteResult && siteResult.body && siteResult.body.id);
  if (!siteId) return null;

  let drivesResult;
  try {
    drivesResult = await graphGet(token, `/sites/${encodeURIComponent(siteId)}/drives?$select=id,name,driveType`);
  } catch (error) {
    if (isNotFound(error)) return null;
    const wrapped = targetError(
      'GRAPH_PERSONAL_SITE_TARGET_FAILED',
      'Die Dokumentbibliotheken der konfigurierten Microsoft-365-Personal-Site konnten nicht gelesen werden.',
      error
    );
    wrapped.graphCode = text(error && error.code);
    throw wrapped;
  }

  const drives = Array.isArray(drivesResult && drivesResult.body && drivesResult.body.value)
    ? drivesResult.body.value.filter(item => text(item && item.id))
    : [];
  const matches = [];

  for (const drive of drives) {
    const driveId = text(drive && drive.id);
    if (!driveId) continue;
    for (const folder of Array.isArray(folders) ? folders : []) {
      const exact = await findFolder(token, driveId, folder);
      if (exact) {
        matches.push({ driveId, folderId: exact.folderId, folder: exact.folder });
        break;
      }
    }
  }

  if (!matches.length) {
    for (const drive of drives) {
      const driveId = text(drive && drive.id);
      if (!driveId) continue;
      for (const folder of Array.isArray(folders) ? folders : []) {
        const searched = await searchFolderInDrive(token, driveId, folder);
        if (searched) {
          matches.push(searched);
          break;
        }
      }
    }
  }

  const unique = Array.from(new Map(matches.map(item => [item.driveId + ':' + item.folderId, item])).values());
  if (unique.length > 1) {
    throw targetError(
      'GRAPH_TARGET_AMBIGUOUS',
      'Der konfigurierte Microsoft-365-POD-Zielordner wurde in der Personal-Site mehrfach gefunden.',
      { statusCode: 409 }
    );
  }
  return unique[0] || null;
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

  const exactDriveId = text(cfg.driveId);
  const exactFolderId = text(cfg.folderId);
  if (exactDriveId || exactFolderId) {
    if (!exactDriveId || !exactFolderId) {
      throw targetError('GRAPH_EXACT_TARGET_INCOMPLETE', 'Das explizite Microsoft-365-POD-Ziel ist unvollständig konfiguriert.', { statusCode: 503 });
    }
    const value = { driveId: exactDriveId, folderId: exactFolderId, folder: rawFolder(cfg.folder) };
    targetCache = { key, value, expiresAt: Date.now() + 10 * 60 * 1000 };
    return value;
  }

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
  if (unique.length > 1) throw targetError('GRAPH_TARGET_AMBIGUOUS', 'Der konfigurierte Microsoft-365-Zielordner ist nicht eindeutig.', { statusCode: 409 });

  let value = unique[0] || null;
  // RC1392: /users/{id}/drives kann zusätzliche erreichbare Drives liefern,
  // ohne dass der persönliche Default-Drive darin vollständig oder mit dem
  // erwarteten Root-Pfad abgebildet ist. Deshalb den explizit konfigurierten
  // Benutzer-Default-Drive immer als zweiten Resolver versuchen, sobald die
  // Drive-Suche keinen eindeutigen Zielordner gefunden hat.
  if (!value) value = await resolveDefaultUserDriveTarget(token, cfg.user, folders);
  // RC1397: Wenn der konfigurierte Pfad wegen abweichender Root-/Documents-Struktur
  // nicht exakt auflösbar ist, den Zielordner über den echten Drive-Inhalt suchen
  // und den Pfad anhand der letzten Segmente eindeutig abgleichen.
  if (!value) value = await searchConfiguredFolderTargets(token, cfg.user, drives, folders);
  // RC1402: Auf der Drive-Ressource suchen, weil Microsoft Graph dort auch
  // freigegebene Elemente außerhalb des Default-Drives als remoteItem liefert.
  // Damit können wir den echten driveId/itemId des gemeinsamen POD-Ordners
  // verwenden, ohne für die Zielsuche Sites.Read.All vorauszusetzen.
  if (!value) value = await searchAccessibleUserDriveTargets(token, cfg.user, folders);
  // RC1401/RC1421: Personal-Site-Auflösung bleibt als nachgelagerter Fallback.
  // Fehlt der App nur die Site-Auflösung, darf das bereits vorhandene Share-Ziel
  // nicht übersprungen werden. Erst wenn auch der Share-Fallback kein Ziel
  // liefert, wird der ursprüngliche Personal-Site-Fehler an den direkten
  // Benutzerpfad-Fallback weitergereicht.
  let personalSiteError = null;
  if (!value) {
    try {
      value = await resolvePersonalSiteFolderTarget(token, cfg.user, folders);
    } catch (error) {
      if (text(error && error.code) === 'GRAPH_PERSONAL_SITE_TARGET_FAILED') personalSiteError = error;
      else throw error;
    }
  }
  // Historischer Share-URL-Fallback bleibt für echte Sharing-URL-Szenarien
  // aktiv und wird bei einer nicht lesbaren Personal-Site ebenfalls versucht.
  if (!value) {
    try {
      value = await resolvePersonalFolderTarget(token, cfg.user, cfg.folder);
    } catch (error) {
      if (!personalSiteError) throw error;
    }
  }
  if (!value && personalSiteError) throw personalSiteError;
  if (!value) throw targetError('GRAPH_FOLDER_NOT_FOUND', 'Der konfigurierte Microsoft-365-Zielordner wurde weder in erreichbaren Drives noch im konfigurierten Benutzerlaufwerk oder über seine explizite OneDrive-URL gefunden.', { statusCode: 404 });

  targetCache = { key, value, expiresAt: Date.now() + 10 * 60 * 1000 };
  return value;
}

// RC1683: A 2xx response is not proof of a stored POD when Graph omits
// the actual item identifier/size or reports a different file. Do not invent
// the expected size from the uploaded buffer: that masks incomplete writes.
function validateUploadReceipt(item, expectedName, expectedBytes) {
  const id = text(item && item.id);
  const name = text(item && item.name);
  const size = item && item.size;
  if (!id || name !== expectedName || !Number.isSafeInteger(size) || size !== expectedBytes) {
    throw targetError(
      'GRAPH_UPLOAD_RECEIPT_INVALID',
      'Microsoft Graph hat den POD-Upload nicht mit passender Datei-ID, Dateiname und Dateigröße bestätigt.',
      { statusCode: 502 }
    );
  }
  return { id, name, size };
}

async function uploadConfiguredUserPath(token, cfg, name, buffer) {
  const folder = rawFolder(cfg && cfg.folder);
  const user = text(cfg && cfg.user);
  if (!folder || !user) return null;
  const folders = candidateFolders(folder);
  let lastError = null;
  for (const candidate of folders) {
    const path = encodedPath(candidate);
    try {
      const result = await request(
        'PUT',
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(user)}/drive/root:/${path}/${encodeURIComponent(name)}:/content`,
        {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/pdf',
          'Content-Length': buffer.length,
          'Accept': 'application/json'
        },
        buffer,
        8000
      );
      const item = result.body || {};
      const receipt = validateUploadReceipt(item, name, buffer.length);
      return {
        id: receipt.id,
        name: receipt.name,
        size: receipt.size,
        webUrl: text(item.webUrl),
        eTag: text(item.eTag),
        user,
        folder: candidate,
        directPath: true
      };
    } catch (error) {
      lastError = error;
      if (!isNotFound(error)) throw error;
    }
  }
  throw lastError || targetError('GRAPH_FOLDER_NOT_FOUND', 'Der konfigurierte Microsoft-365-Zielordner wurde im Benutzerlaufwerk nicht gefunden.', { statusCode: 404 });
}

function directPathFallbackAllowed(cfg, error) {
  return !text(cfg && cfg.driveId) &&
    !text(cfg && cfg.folderId) &&
    text(error && error.code) === 'GRAPH_PERSONAL_SITE_TARGET_FAILED';
}

function wrapDirectPathError(error) {
  const wrapped = targetError(
    'GRAPH_DIRECT_PATH_TARGET_FAILED',
    'Das explizit konfigurierte Microsoft-365-POD-Ziel konnte nicht über den direkten Benutzer-/Ordnerpfad beschrieben werden.',
    error
  );
  wrapped.graphCode = text(error && error.code);
  return wrapped;
}

async function uploadPdf(buffer, fileName) {
  const cfg = config();
  const name = safeFileName(fileName);
  const cachedFailure = cachedTargetFailure(cfg);
  if (cachedFailure) {
    if (directPathFallbackAllowed(cfg, cachedFailure)) {
      try {
        const token = await accessToken(false);
        const direct = await uploadConfiguredUserPath(token, cfg, name, buffer);
        if (direct) {
          targetFailureCache = null;
          return Object.assign({}, direct, { attempts: 1 });
        }
      } catch (directError) {
        const wrapped = text(directError && directError.code) === 'GRAPH_UPLOAD_RECEIPT_INVALID'
          ? directError : wrapDirectPathError(directError);
        rememberTargetFailure(cfg, wrapped);
        throw wrapped;
      }
    }
    throw cachedFailure;
  }
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
      const receipt = validateUploadReceipt(item, name, buffer.length);
      if (targetFailureCache && targetFailureCache.key === targetKey(cfg)) targetFailureCache = null;
      return {
        id: receipt.id,
        name: receipt.name,
        size: receipt.size,
        webUrl: text(item.webUrl),
        eTag: text(item.eTag),
        user: cfg.user,
        folder: target.folder,
        driveId: target.driveId,
        attempts: attempt
      };
    } catch (error) {
      let effectiveError = error;
      if (directPathFallbackAllowed(cfg, error)) {
        try {
          const token = await accessToken(forceToken);
          const direct = await uploadConfiguredUserPath(token, cfg, name, buffer);
          if (direct) {
            targetFailureCache = null;
            return Object.assign({}, direct, { attempts: attempt });
          }
        } catch (directError) {
          effectiveError = text(directError && directError.code) === 'GRAPH_UPLOAD_RECEIPT_INVALID'
            ? directError : wrapDirectPathError(directError);
        }
      }
      lastError = effectiveError;
      rememberTargetFailure(cfg, effectiveError);
      // A contradictory 2xx receipt must fail closed, not issue more PUTs.
      if (text(effectiveError && effectiveError.code) === 'GRAPH_UPLOAD_RECEIPT_INVALID') throw effectiveError;
      if (effectiveError && effectiveError.statusCode === 401 && !forceToken) {
        tokenCache = null;
        targetCache = null;
        forceToken = true;
        forceTarget = true;
        continue;
      }
      if (isNotFound(effectiveError) && attempt < 3 && !/^GRAPH_(DRIVE|FOLDER)_NOT_FOUND$/.test(text(effectiveError.code))) {
        targetCache = null;
        forceTarget = true;
        forceToken = false;
        continue;
      }
      if (attempt < 3 && transient(effectiveError)) {
        await sleep(retryDelay(effectiveError, attempt));
        forceToken = false;
        forceTarget = false;
        continue;
      }
      throw effectiveError;
    }
  }
  throw lastError || Object.assign(new Error('Microsoft-365-POD-Sicherung ist fehlgeschlagen.'), { code: 'GRAPH_UPLOAD_FAILED', statusCode: 502 });
}

// RC1685: Graph /content normally answers 302 with a short-lived
// preauthenticated SharePoint URL. Never forward the Graph bearer token.
function approvedGraphDownload(location, base) {
  let url;
  try { url = new URL(location, base); } catch (_) { return ''; }
  const host = url.hostname.toLowerCase();
  const allowed = ['.sharepoint.com', '.sharepoint-df.com', '.sharepointonline.com',
    '.blob.core.windows.net', '.1drv.com', '.onedrive.com'];
  if (url.protocol !== 'https:' || url.username || url.password ||
      !allowed.some(suffix => host.endsWith(suffix))) return '';
  return url.href;
}

async function readBackBytes(token, item, expectedSize) {
  const id = text(item && item.id);
  const driveId = text(item && item.driveId);
  const user = text(item && item.user);
  if (!id || (!driveId && !user)) {
    throw targetError('GRAPH_READBACK_TARGET_MISSING',
      'Die Microsoft-365-POD-Datei hat keinen rücklesbaren eindeutigen Speicherort.',
      { statusCode: 502 });
  }
  const resource = driveId
    ? '/drives/' + encodeURIComponent(driveId) + '/items/' + encodeURIComponent(id) + '/content'
    : '/users/' + encodeURIComponent(user) + '/drive/items/' + encodeURIComponent(id) + '/content';
  const graphUrl = 'https://graph.microsoft.com/v1.0' + resource;
  let response;
  try {
    response = await request('GET', graphUrl,
      { 'Authorization': 'Bearer ' + token, 'Accept': 'application/pdf' }, null, 12000, expectedSize);
  } catch (error) {
    const status = Number(error && error.statusCode);
    if (![301, 302, 303, 307, 308].includes(status)) throw error;
    const url = approvedGraphDownload(error.responseHeaders && error.responseHeaders.location, graphUrl);
    if (!url) throw targetError('GRAPH_READBACK_REDIRECT_REJECTED',
      'Die Microsoft-365-POD-Rückleseadresse ist nicht vertrauenswürdig.',
      { statusCode: 502 });
    // IMPORTANT: redirect is an anonymous preauthenticated URL.
    response = await request('GET', url, { 'Accept': 'application/pdf' }, null, 12000, expectedSize);
  }
  return response.buffer;
}

async function verifyPdf(buffer, item) {
  if (!Buffer.isBuffer(buffer) || !buffer.length)
    throw targetError('GRAPH_READBACK_INVALID_ORIGINAL',
      'Die POD-Originaldatei für den Vergleich ist ungültig.', { statusCode: 502 });
  const expectedHash = crypto.createHash('sha256').update(buffer).digest('hex');
  let lastError;
  // Readback may lag a successful PUT briefly. Retry GET only; NEVER repeat PUT.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const bytes = await readBackBytes(await accessToken(false), item, buffer.length);
      const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
      if (bytes.length !== buffer.length || actualHash !== expectedHash)
        throw targetError('GRAPH_POD_READBACK_HASH_MISMATCH',
          'Die aus Microsoft 365 zurückgelesene POD-PDF stimmt nicht mit dem Original überein.',
          { statusCode: 502 });
      return { verified: true, hash: actualHash, size: bytes.length, verifiedAt: new Date().toISOString() };
    } catch (error) {
      lastError = error;
      // A mismatched/corrupt PDF, rejected redirect or oversized download is
      // a definitive integrity/security failure, not a transient HTTP 502.
      const definitiveReadbackFailure = /^(?:GRAPH_POD_READBACK_HASH_MISMATCH|GRAPH_READBACK_REDIRECT_REJECTED|GRAPH_READBACK_TOO_LARGE|GRAPH_READBACK_INVALID_ORIGINAL|GRAPH_READBACK_TARGET_MISSING)$/.test(text(error && error.code));
      if (!definitiveReadbackFailure && attempt < 2 && (isNotFound(error) || transient(error))) {
        await sleep(350);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// RC1687: OIDC-protected, READ-ONLY diagnosis of the configured Graph target.
// Never emit tenant/user, drive/folder IDs, raw paths, tokens or Graph messages.
// Every probe uses only GET; even a valid target is not modified.
async function diagnoseTarget() {
  const status = readiness();
  const result = {
    configured: status.configured,
    missing: status.missing.slice(),
    targetMode: status.driveId && status.folderId ? 'explicit-ids' : 'user-folder-discovery',
    checks: []
  };
  if (!status.configured) return Object.assign(result, { ok: false, code: 'GRAPH_NOT_CONFIGURED' });

  const failure = (stage, error) => {
    const httpStatus = Math.max(0, Math.min(599, Number(error && error.statusCode) || 0));
    const providerCode = text(error && (error.graphCode || error.code))
      .replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 70);
    const kind = httpStatus === 403 ? 'access-denied'
      : httpStatus === 404 ? 'not-found'
      : httpStatus === 401 ? 'unauthorized' : 'error';
    const item = { stage, status: kind, httpStatus, providerCode };
    result.checks.push(item);
    return item;
  };
  const success = stage => result.checks.push({ stage, status: 'ok', httpStatus: 200 });
  let cfg, token;
  try {
    cfg = config();
    token = await accessToken(false);
    success('app-token');
  } catch (error) {
    failure('app-token', error);
    return Object.assign(result, { ok: false, code: 'GRAPH_DIAGNOSTIC_TOKEN_FAILED' });
  }

  // First isolate whether /users/{configured-user}/drive is readable by
  // this app. A failure is recorded, not inferred to mean the target is absent:
  // SharePoint shared drives may still be reachable by explicit IDs.
  if (result.targetMode === 'user-folder-discovery') {
    try {
      const drive = await graphGet(token, '/users/' + encodeURIComponent(cfg.user) + '/drive?$select=id');
      if (text(drive.body && drive.body.id)) success('user-default-drive');
      else failure('user-default-drive', { code: 'GRAPH_DRIVE_ID_MISSING', statusCode: 502 });
    } catch (error) {
      failure('user-default-drive', error);
    }
    // RC1688: the actual fallback uploader tries *all* normalized path
    // variants (with and without "Documents"). A single failed first path
    // is NOT proof of a missing folder. Probe each variant without uploads.
    const candidates = candidateFolders(cfg.folder).slice(0, 3);
    for (let index = 0; index < candidates.length; index++) {
      const stage = index === 0 ? 'user-folder-path' : 'user-folder-path-alternative-' + (index + 1);
      try {
        const folder = await graphGet(token, '/users/' + encodeURIComponent(cfg.user) +
          '/drive/root:/' + encodedPath(candidates[index]) + '?$select=id,folder,parentReference');
        if (text(folder.body && folder.body.id) && folder.body.folder) success(stage);
        else failure(stage, { code: 'GRAPH_FOLDER_NOT_A_FOLDER', statusCode: 409 });
      } catch (error) {
        failure(stage, error);
      }
    }
  }

  // Use the same resolver as real uploads; explicit IDs are checked for an
  // actual folder rather than assuming that configured IDs are valid.
  let target;
  try {
    target = await resolveTarget(token, cfg, true);
    success('target-resolver');
  } catch (error) {
    failure('target-resolver', error);
    return Object.assign(result, { ok: false, code: 'GRAPH_DIAGNOSTIC_RESOLVER_FAILED' });
  }
  try {
    const item = await graphGet(token, '/drives/' + encodeURIComponent(target.driveId) +
      '/items/' + encodeURIComponent(target.folderId) + '?$select=id,folder,parentReference');
    if (!text(item.body && item.body.id) || !item.body.folder) {
      failure('resolved-folder-read', { code: 'GRAPH_FOLDER_NOT_A_FOLDER', statusCode: 409 });
      return Object.assign(result, { ok: false, code: 'GRAPH_DIAGNOSTIC_NOT_A_FOLDER' });
    }
    success('resolved-folder-read');
    return Object.assign(result, { ok: true, code: 'GRAPH_DIAGNOSTIC_TARGET_READABLE' });
  } catch (error) {
    failure('resolved-folder-read', error);
    return Object.assign(result, { ok: false, code: 'GRAPH_DIAGNOSTIC_FOLDER_FAILED' });
  }
}

module.exports = { readiness, config, uploadPdf, verifyPdf, diagnoseTarget, safeFileName, normalizeFolder };
