'use strict';

const https = require('https');

function text(value) {
  return String(value == null ? '' : value).trim();
}

function config() {
  const tenantId = text(process.env.EXPORTHUB_GRAPH_TENANT_ID);
  const clientId = text(process.env.EXPORTHUB_GRAPH_CLIENT_ID);
  const clientSecret = text(process.env.EXPORTHUB_GRAPH_CLIENT_SECRET);
  const user = text(process.env.EXPORTHUB_POD_DRIVE_USER) || 'tobiaslimberg@essentra.com';
  const folder = text(process.env.EXPORTHUB_POD_FOLDER) || '003 Export/ExportHub/Abliefernachweise';
  if (!tenantId || !clientId || !clientSecret) {
    const error = new Error('Microsoft Graph ist für die POD-Sicherung noch nicht konfiguriert.');
    error.code = 'GRAPH_NOT_CONFIGURED';
    error.statusCode = 503;
    throw error;
  }
  return { tenantId, clientId, clientSecret, user, folder };
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
      timeout: timeoutMs || 60000
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
        reject(error);
      });
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('Microsoft Graph Zeitüberschreitung.'), { code: 'GRAPH_TIMEOUT', statusCode: 504 })));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
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
  }, Buffer.from(form, 'utf8'), 30000);
  const token = text(result.body && result.body.access_token);
  if (!token) throw Object.assign(new Error('Microsoft Graph hat kein Zugriffstoken geliefert.'), { code: 'GRAPH_TOKEN_MISSING', statusCode: 502 });
  tokenCache = { token, expiresAt: Date.now() + Math.max(300, Number(result.body && result.body.expires_in || 3600)) * 1000 };
  return token;
}

function safeFileName(value) {
  const name = text(value).replace(/[\/*<>?:|#%\x00-\x1F]/g, '_').replace(/\s+/g, ' ').replace(/[. ]+$/g, '').slice(0, 180);
  return name || 'POD.pdf';
}

function encodedPath(folder, fileName) {
  return `${folder}/${fileName}`.split('/').map(part => encodeURIComponent(text(part))).filter(Boolean).join('/');
}

async function uploadPdf(buffer, fileName) {
  const cfg = config();
  const name = safeFileName(fileName);
  const path = encodedPath(cfg.folder, name);
  async function put(forceToken) {
    const token = await accessToken(forceToken);
    return request('PUT', `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.user)}/drive/root:/${path}:/content`, {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/pdf',
      'Content-Length': buffer.length,
      'Accept': 'application/json'
    }, buffer, 90000);
  }
  let result;
  try { result = await put(false); }
  catch (error) {
    if (error && error.statusCode === 401) { tokenCache = null; result = await put(true); }
    else throw error;
  }
  const item = result.body || {};
  return {
    id: text(item.id),
    name: text(item.name) || name,
    size: Number(item.size || buffer.length),
    webUrl: text(item.webUrl),
    eTag: text(item.eTag),
    user: cfg.user,
    folder: cfg.folder
  };
}

module.exports = { config, uploadPdf, safeFileName };
