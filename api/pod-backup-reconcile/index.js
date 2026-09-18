'use strict';

const crypto = require('crypto');
const https = require('https');
const podArchive = require('../shared/pod-archive');
const store = require('../shared/pickup-store');
const graphDrive = require('../shared/graph-drive');

const REPO = 'Deadshot89/ExportHub';
const WORKFLOW = 'rc1144-pod-backup-reconcile.yml';
const OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const OIDC_JWKS_URL = 'https://token.actions.githubusercontent.com/.well-known/jwks';
const OIDC_AUDIENCE='exporthub-pod-backup-reconcile';
const ALLOWED_EVENTS = ['workflow_run','schedule','workflow_dispatch'];
let oidcCache = { expiresAt: 0, keys: [] };

function text(value) {
  return String(value == null ? '' : value).trim();
}
function lower(value) {
  return text(value).toLowerCase();
}
function json(status, body) {
  return store.json(status, body, { 'Cache-Control': 'no-store' });
}
function error(code, message, status) {
  const e = new Error(message || code);
  e.code = code;
  e.status = status || 400;
  e.statusCode = e.status;
  return e;
}
function body(req) {
  if (req && req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req && req.body || '{}'); } catch (_) { return {}; }
}
function header(req, name) {
  const headers = req && req.headers || {};
  return headers[name.toLowerCase()] || headers[name] || '';
}
function environmentOf(req, payload) {
  const raw = lower(payload && payload.environment || header(req, 'x-exporthub-environment'));
  const host = lower(header(req, 'x-forwarded-host') || header(req, 'x-original-host') || header(req, 'host'));
  const hostTest = /-testservice\./.test(host);
  const hostAzure = /\.azurestaticapps\.net(?:[:/]|$)/.test(host);
  const hostProd = hostAzure && !hostTest;
  if (raw && raw !== 'production' && raw !== 'testservice') throw error('ENVIRONMENT_INVALID', 'Unbekannte ExportHUB-Umgebung.', 400);
  if (hostTest && raw && raw !== 'testservice') throw error('ENVIRONMENT_MISMATCH', 'TESTSERVICE darf keine Produktions-PODs warten.', 409);
  if (hostProd && raw && raw !== 'production') throw error('ENVIRONMENT_MISMATCH', 'Produktion darf keine TESTSERVICE-PODs warten.', 409);
  return raw || (hostTest ? 'testservice' : 'production');
}
function httpsJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method: 'GET', headers: { Accept: 'application/json', 'User-Agent': 'ExportHUB-RC1144' } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); }
          return;
        }
        reject(error('OIDC_JWKS_FAILED', 'GitHub OIDC-Schlüssel konnten nicht geladen werden.', 502));
      });
    });
    request.on('error', reject);
    request.end();
  });
}
async function githubOidcAuthorized(req) {
  const token = text(header(req, 'x-exporthub-github-oidc'));
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const jose = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (jose.alg !== 'RS256' || !text(jose.kid)) return false;
    const at = Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== OIDC_ISSUER || !audiences.includes(OIDC_AUDIENCE)) return false;
    if (claims.repository !== REPO || claims.ref !== 'refs/heads/main' || !ALLOWED_EVENTS.includes(claims.event_name)) return false;
    if (claims.workflow_ref !== REPO + '/.github/workflows/' + WORKFLOW + '@refs/heads/main') return false;
    if (!Number(claims.exp) || Number(claims.exp) <= at - 30) return false;
    if (Number(claims.nbf || 0) > at + 60 || Number(claims.iat || 0) > at + 60 || Number(claims.iat || 0) < at - 900) return false;
    if (!oidcCache.keys.length || oidcCache.expiresAt < Date.now()) {
      const jwks = await httpsJson(OIDC_JWKS_URL);
      oidcCache = { expiresAt: Date.now() + 10 * 60 * 1000, keys: Array.isArray(jwks.keys) ? jwks.keys : [] };
    }
    const jwk = oidcCache.keys.find(key => key && key.kid === jose.kid && key.kty === 'RSA');
    if (!jwk) return false;
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    return crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), key, Buffer.from(parts[2], 'base64url'));
  } catch (_) {
    return false;
  }
}

module.exports = async function(context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' }, body: '' };
    return;
  }
  if (req.method !== 'POST') {
    context.res = json(405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Nur POST ist erlaubt.' });
    return;
  }
  try {
    if (!await githubOidcAuthorized(req)) throw error('WORKFLOW_REQUIRED', 'Die POD-Nachholung darf nur durch den signierten ExportHUB-Wartungsworkflow ausgeführt werden.', 403);
    const payload = body(req);
    const environment = environmentOf(req, payload);
    const graph = graphDrive.readiness();
    if (!graph.configured) {
      context.res = json(503, {
        ok: false,
        code: 'GRAPH_NOT_CONFIGURED',
        message: 'Microsoft Graph ist für die automatische POD-Zweitsicherung nicht vollständig konfiguriert.',
        version: 'RC1163',
        environment,
        graphConfigured: false,
        missing: graph.missing,
        targetUser: graph.user,
        targetFolder: graph.folder
      });
      return;
    }
    const reference = text(payload.reference).toUpperCase();
    const limit = Math.min(25, Math.max(1, Math.round(Number(payload.limit) || 10)));
    const result = await podArchive.reconcilePendingBackups(environment, {
      reference,
      limit,
      minAgeMs: reference ? 0 : 5 * 60 * 1000
    });
    context.res = json(200, Object.assign({ version: 'RC1163', reference: reference || null }, result));
  } catch (e) {
    try { context.log && context.log.error && context.log.error('RC1144 POD reconcile failed', e && e.code, e && e.message); } catch (_) {}
    context.res = json(e.status || e.statusCode || 500, { ok: false, code: e.code || 'SERVER_ERROR', message: e.message || 'POD-Nachholung ist fehlgeschlagen.', version: 'RC1144' });
  }
};
