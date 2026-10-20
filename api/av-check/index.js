'use strict';

const crypto = require('crypto');
const https = require('https');
const store = require('../shared/pickup-store');
const avCheck = require('../shared/av-check');
const referenceFolder = require('../shared/reference-folder-upload');

const REPO = 'Deadshot89/ExportHub';
const WORKFLOW = 'av-check.yml';
const OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const OIDC_JWKS_URL = 'https://token.actions.githubusercontent.com/.well-known/jwks';
const OIDC_AUDIENCE = 'exporthub-av-check';
const ALLOWED_EVENTS = ['schedule', 'workflow_dispatch'];
const TEAM_MAX_RETRIES = 8;
let oidcCache = { expiresAt: 0, keys: [] };

function text(value) { return String(value == null ? '' : value).trim(); }
function lower(value) { return text(value).toLowerCase(); }
function json(status, body) { return store.json(status, body, { 'Cache-Control': 'no-store' }); }
function error(code, message, status) { const e = new Error(message || code); e.code = code; e.status = status || 400; e.statusCode = e.status; return e; }
function body(req) { if (req && req.body && typeof req.body === 'object') return req.body; try { return JSON.parse(req && req.body || '{}'); } catch (_) { return {}; } }
function header(req, name) { const headers = req && req.headers || {}; return headers[name.toLowerCase()] || headers[name] || ''; }
function environmentOf(req, payload) {
  const raw = lower(payload && payload.environment || header(req, 'x-exporthub-environment'));
  const host = lower(header(req, 'x-forwarded-host') || header(req, 'x-original-host') || header(req, 'host'));
  const hostTest = /-testservice\./.test(host), hostAzure = /\.azurestaticapps\.net(?:[:/]|$)/.test(host), hostProd = hostAzure && !hostTest;
  if (raw && raw !== 'production' && raw !== 'testservice') throw error('ENVIRONMENT_INVALID', 'Unbekannte ExportHUB-Umgebung.', 400);
  if (hostTest && raw && raw !== 'testservice') throw error('ENVIRONMENT_MISMATCH', 'TESTSERVICE darf keine Produktionssendungen prüfen.', 409);
  if (hostProd && raw && raw !== 'production') throw error('ENVIRONMENT_MISMATCH', 'Produktion darf keine TESTSERVICE-Sendungen prüfen.', 409);
  return raw || (hostTest ? 'testservice' : 'production');
}
function httpsJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method: 'GET', headers: { Accept: 'application/json', 'User-Agent': 'ExportHUB-AV-Check' } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode >= 200 && response.statusCode < 300) { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } return; }
        reject(error('OIDC_JWKS_FAILED', 'GitHub OIDC-Schlüssel konnten nicht geladen werden.', 502));
      });
    });
    request.on('error', reject); request.end();
  });
}
async function githubOidcAuthorized(req) {
  const token = text(header(req, 'x-exporthub-github-oidc')); if (!token) return false;
  try {
    const parts = token.split('.'); if (parts.length !== 3) return false;
    const jose = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (jose.alg !== 'RS256' || !text(jose.kid)) return false;
    const at = Math.floor(Date.now() / 1000), audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== OIDC_ISSUER || !audiences.includes(OIDC_AUDIENCE)) return false;
    if (claims.repository !== REPO || claims.ref !== 'refs/heads/main' || !ALLOWED_EVENTS.includes(claims.event_name)) return false;
    if (claims.workflow_ref !== REPO + '/.github/workflows/' + WORKFLOW + '@refs/heads/main') return false;
    if (!Number(claims.exp) || Number(claims.exp) <= at - 30) return false;
    if (Number(claims.nbf || 0) > at + 60 || Number(claims.iat || 0) > at + 60 || Number(claims.iat || 0) < at - 900) return false;
    if (!oidcCache.keys.length || oidcCache.expiresAt < Date.now()) { const jwks = await httpsJson(OIDC_JWKS_URL); oidcCache = { expiresAt: Date.now() + 10 * 60 * 1000, keys: Array.isArray(jwks.keys) ? jwks.keys : [] }; }
    const jwk = oidcCache.keys.find(key => key && key.kid === jose.kid && key.kty === 'RSA'); if (!jwk) return false;
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    return crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), key, Buffer.from(parts[2], 'base64url'));
  } catch (_) { return false; }
}

async function readTeamState(environment) {
  const c = await store.clients(environment), blob = c.team.getBlockBlobClient(environment === 'testservice' ? store.TEST_TEAM_BLOB : store.TEAM_BLOB_BASE);
  const loaded = await store.readJson(blob, null), doc = loaded.value || {};
  return doc.state && typeof doc.state === 'object' ? doc.state : {};
}
async function mutateTeamState(environment, mutator) {
  const c = await store.clients(environment), blob = c.team.getBlockBlobClient(environment === 'testservice' ? store.TEST_TEAM_BLOB : store.TEAM_BLOB_BASE);
  for (let i = 0; i < TEAM_MAX_RETRIES; i++) {
    const loaded = await store.readJson(blob, null), doc = loaded.value || { schemaVersion: 3, revision: 0, state: {}, users: [] };
    doc.state = doc.state && typeof doc.state === 'object' ? doc.state : {};
    const result = mutator(doc.state);
    if (!result.changed) return result;
    doc.revision = Number(doc.revision || 0) + 1; doc.updatedAt = store.now(); doc.updatedBy = 'AV-Prüfung'; doc.updatedByDevice = 'av-check'; doc.clientVersion = 'AV-CHECK';
    try { await store.writeJson(blob, doc, loaded.etag); return result; } catch (e) { if (e && e.statusCode === 412 && i < TEAM_MAX_RETRIES - 1) { await new Promise(r => setTimeout(r, 40 * (i + 1))); continue; } throw e; }
  }
  throw error('TEAM_STATE_CONFLICT', 'Team-State konnte nach mehreren konkurrierenden Änderungen nicht gespeichert werden.', 503);
}

function createHandler(deps = {}) {
  const authorize = deps.authorize || githubOidcAuthorized;
  const readState = deps.readState || readTeamState;
  const mutateState = deps.mutateState || mutateTeamState;
  const listFiles = deps.listFiles || referenceFolder.listFiles;
  const graphConfigured = deps.graphConfigured || (() => { try { referenceFolder.config(); return true; } catch (_) { return false; } });
  const now = deps.now || (() => new Date());
  return async function(req) {
    if (req.method === 'OPTIONS') return { status: 204, body: {} };
    if (req.method !== 'POST') return { status: 405, body: { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Nur POST ist erlaubt.' } };
    try {
      if (!await authorize(req)) throw error('WORKFLOW_REQUIRED', 'Die AV-Prüfung darf nur durch den signierten ExportHUB-Workflow ausgeführt werden.', 403);
      const payload = body(req), environment = environmentOf(req, payload);
      const limit = Math.min(100, Math.max(1, Math.round(Number(payload.limit) || 40)));
      // Ohne Graph-Zugriff kann kein REF-Ordner gelesen werden; dann keine Aufgaben erzeugen.
      if (!graphConfigured()) return { status: 200, body: { ok: true, environment, graphConfigured: false, checked: 0, results: [] } };
      const minAgeMs = Math.max(0, Number(payload.minAgeMinutes == null ? 30 : payload.minAgeMinutes) || 0) * 60 * 1000;
      const at = now(), state = await readState(environment);
      // Gerade erst geprüfte REFs überspringen, damit Folge-Batches eines Laufs weiterkommen.
      const all = avCheck.candidates(state, at).filter(c => !c.lastCheckedAt || at.getTime() - Date.parse(c.lastCheckedAt) >= minAgeMs);
      const selected = all.slice(0, limit);
      const checks = [], errors = [];
      for (const item of selected) {
        try { checks.push({ reference: item.reference, result: await avCheck.checkReference(item.reference, listFiles) }); }
        catch (e) { errors.push({ reference: item.reference, code: text(e && e.code) || 'REFERENCE_FOLDER_LIST_FAILED' }); }
      }
      const applied = await mutateState(environment, current => {
        const results = checks.map(c => avCheck.applyResult(current, c.reference, c.result, at));
        return { changed: results.length > 0, results };
      });
      const results = applied.results || [];
      return { status: 200, body: {
        ok: errors.length === 0, environment, graphConfigured: true, dueDays: avCheck.AV_DUE_DAYS,
        candidates: all.length, checked: checks.length, remaining: Math.max(0, all.length - selected.length),
        present: results.filter(r => r.status === 'present').length,
        missing: results.filter(r => r.status === 'missing').length,
        createdTasks: results.filter(r => r.createdTask).length,
        closedTasks: results.reduce((n, r) => n + r.closedTasks, 0),
        errorCount: errors.length, errors, results
      } };
    } catch (e) {
      return { status: e.status || e.statusCode || 500, body: { ok: false, code: e.code || 'SERVER_ERROR', message: e.message || 'AV check failed.' } };
    }
  };
}

let defaultHandler = null;
module.exports = async function(context, req) {
  if (!defaultHandler) defaultHandler = createHandler();
  const res = await defaultHandler(req);
  if (res.status >= 500) { try { context.log && context.log.error && context.log.error('AV-Prüfung fehlgeschlagen', res.body && res.body.code); } catch (_) {} }
  context.res = res.status === 204 ? { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' }, body: '' } : json(res.status, res.body);
};
module.exports.createHandler = createHandler;
module.exports.environmentOf = environmentOf;
