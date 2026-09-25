
'use strict';
const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');
const pins = require('../shared/loader-pin-store');
const auditStore = require('../shared/auth-store');
const { isAdmin } = require('../shared/user-policy');
const apiI18n = require('../shared/i18n');

const TEAM_CONTAINER = process.env.EXPORTHUB_STORAGE_CONTAINER || process.env.EXPORTHUB_CONTAINER || 'exporthub-data';
const TEAM_BLOB = process.env.EXPORTHUB_STORAGE_BLOB || process.env.EXPORTHUB_STATE_BLOB || 'team-state.json';
const AUTH_BLOB = process.env.EXPORTHUB_AUTH_BLOB || 'auth-sessions.json';

function json(status, body) {
  return { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'X-Content-Type-Options': 'nosniff' }, body: JSON.stringify(body) };
}
function text(v) { return String(v == null ? '' : v).trim(); }
function lower(v) { return text(v).toLowerCase(); }
function body(req) { if (req && req.body && typeof req.body === 'object') return req.body; try { return JSON.parse(req && req.body || '{}'); } catch (_) { return {}; } }
function header(req, name) { const h = req && req.headers || {}; return h[name.toLowerCase()] || h[name] || ''; }
function token(req, payload) { const auth = String(header(req, 'authorization') || '').replace(/^Bearer\s+/i, ''); return text(header(req, 'x-exporthub-token') || header(req, 'x-exporthub-session') || payload.sessionToken || payload.authToken || auth); }
function connectionString() { return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || ''; }
function usernameOf(user) { return lower(user && (user.user || user.login || user.username || user.name || user.displayName)); }
function isActive(user) { return Boolean(user && user.active !== false && user.disabled !== true && lower(user.status) !== 'deaktiviert'); }
function safeEqualText(a, b) { const aa = Buffer.from(String(a || ''), 'utf8'), bb = Buffer.from(String(b || ''), 'utf8'); return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb); }
function tokenHash(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex'); }
function signingSecret() {
  const source = text(process.env.EXPORTHUB_AUTH_SIGNING_SECRET || process.env.EXPORTHUB_SESSION_SECRET) || connectionString();
  if (!source) throw pins.error('AUTH_SIGNING_NOT_CONFIGURED', 'Die sichere ExportHUB-Sitzungsprüfung ist serverseitig nicht konfiguriert.', 503);
  return crypto.createHash('sha256').update('ExportHUB/session/v1|' + source).digest();
}
function verifySignedSessionToken(value) {
  const raw = text(value), parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== 'ehs1' || !parts[1] || !parts[2]) return null;
  const expected = crypto.createHmac('sha256', signingSecret()).update(parts[1]).digest('base64url');
  if (!safeEqualText(expected, parts[2])) return null;
  let data; try { data = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch (_) { return null; }
  if (!data || data.purpose !== 'exporthub-session' || Number(data.v || 0) !== 1 || !data.uid || !data.sid || Number(data.exp || 0) <= Date.now()) return null;
  return data;
}
function parseStoredJson(raw) {
  const cleaned = String(raw == null ? '' : raw).replace(/^\uFEFF/, '').replace(/\u0000+$/g, '').trim();
  if (!cleaned) return null;
  let value = JSON.parse(cleaned);
  if (typeof value === 'string' && /^[\[{]/.test(value.trim())) value = JSON.parse(value.trim());
  return value;
}
async function readJson(blob, fallback, repairInvalid) {
  try {
    const response = await blob.download(0), chunks = [];
    for await (const chunk of response.readableStreamBody) chunks.push(Buffer.from(chunk));
    try { const value = parseStoredJson(Buffer.concat(chunks).toString('utf8')); return value == null ? fallback : value; }
    catch (e) { if (repairInvalid) return fallback; throw e; }
  } catch (e) {
    if (e && e.statusCode === 404) return fallback;
    throw e;
  }
}
async function validateGlobalAdmin(req, payload) {
  const t = token(req, payload);
  if (!t) throw pins.error('AUTH_REQUIRED', 'ExportHUB-Admin-Anmeldung erforderlich.', 401);
  const cs = connectionString();
  if (!cs) throw pins.error('STORAGE_NOT_CONFIGURED', 'Azure-Speicher ist nicht konfiguriert.', 503);
  const service = BlobServiceClient.fromConnectionString(cs), container = service.getContainerClient(TEAM_CONTAINER);
  const [authDoc, teamDoc] = await Promise.all([
    readJson(container.getBlockBlobClient(AUTH_BLOB), { schemaVersion: 1, sessions: [] }, true),
    readJson(container.getBlockBlobClient(TEAM_BLOB), { schemaVersion: 3, state: {}, users: [] }, false)
  ]);
  const sessions = Array.isArray(authDoc && authDoc.sessions) ? authDoc.sessions : [];
  const digest = tokenHash(t);
  let session = sessions.find(s => safeEqualText(s && s.tokenHash, digest));
  if (!session) {
    const signed = verifySignedSessionToken(t);
    if (signed) session = { id: text(signed.sid), userId: text(signed.uid), username: text(signed.username), expiresAt: new Date(Number(signed.exp)).toISOString(), authVersion: Number(signed.authVersion || 0), mustChange: signed.mustChange === true, signedFallback: true };
  }
  if (!session) throw pins.error('SESSION_INVALID', 'Die ExportHUB-Sitzung ist nicht mehr gültig. Bitte erneut anmelden.', 401);
  if (session.revokedAt) throw pins.error('SESSION_REVOKED', 'Die ExportHUB-Sitzung wurde beendet. Bitte erneut anmelden.', 401);
  if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) throw pins.error('SESSION_INVALID', 'Die ExportHUB-Sitzung ist abgelaufen. Bitte erneut anmelden.', 401);
  const users = Array.isArray(teamDoc && teamDoc.users) ? teamDoc.users : [];
  const user = users.find(u => text(u && u.id) === text(session.userId) || usernameOf(u) === lower(session.username));
  if (!user || !isActive(user)) throw pins.error('ACCOUNT_DISABLED', 'Das ExportHUB-Benutzerkonto ist nicht aktiv.', 403);
  if (Number(session.authVersion || 0) !== Number(user.authVersion || 0)) throw pins.error('SESSION_REVOKED', 'Die ExportHUB-Sitzung wurde beendet. Bitte erneut anmelden.', 401);
  if ((session.mustChange || user.mustChange) === true) throw pins.error('PASSWORD_CHANGE_REQUIRED', 'Vor der Nutzung muss das Startpasswort geändert werden.', 403);
  if (!isAdmin(user)) throw pins.error('GLOBAL_ADMIN_REQUIRED', 'Nur globale Administratoren dürfen Verlader-PINs verwalten.', 403);
  return user;
}

const PIN_AUDIT_TYPES = Object.freeze({
  create: 'LOADER_PIN_CREATED',
  update: 'LOADER_PIN_UPDATED',
  toggle: 'LOADER_PIN_STATUS_CHANGED',
  delete: 'LOADER_PIN_DELETED'
});
function adminName(user) { return text(user && (user.name || user.displayName || user.user || user.username)) || 'Administrator'; }
function targetRow(action, before, after, payload) {
  const id = text(payload && payload.id);
  if (action === 'create') {
    const prior = new Set((before || []).map(x => text(x && x.id)));
    return (after || []).find(x => !prior.has(text(x && x.id))) || (after || []).find(x => text(x && x.name) === text(payload && payload.name)) || {};
  }
  if (action === 'delete') return (before || []).find(x => text(x && x.id) === id) || { id, name: text(payload && payload.name) };
  return (after || []).find(x => text(x && x.id) === id) || (before || []).find(x => text(x && x.id) === id) || { id, name: text(payload && payload.name) };
}
async function auditPinChange(action, admin, row) {
  const type = PIN_AUDIT_TYPES[action];
  if (!type) return true;
  await auditStore.mutateTeam(team => {
    auditStore.addAudit(team, type, adminName(admin), {
      loaderId: text(row && row.id),
      loaderName: text(row && row.name),
      active: row && typeof row.active === 'boolean' ? row.active : undefined
    });
    return true;
  });
  return true;
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') { context.res = { status: 204, headers: { 'Cache-Control': 'no-store', 'Allow': 'POST, OPTIONS', 'X-ExportHUB-Loader-Pin-Audit': 'RC1087' }, body: '' }; return; }
  if (req.method !== 'POST') { context.res = json(405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Nur POST ist erlaubt.' }); return; }
  try {
    const payload = body(req), admin = await validateGlobalAdmin(req, payload), action = text(payload.action || 'list').toLowerCase();
    const before = PIN_AUDIT_TYPES[action] ? await pins.list() : [];
    let list;
    if (action === 'list') list = await pins.list();
    else if (action === 'create') list = await pins.create(payload);
    else if (action === 'update') list = await pins.update(payload);
    else if (action === 'toggle') list = await pins.toggle(payload);
    else if (action === 'delete') list = await pins.remove(payload);
    else throw pins.error('INVALID_ACTION', 'Unbekannte PIN-Aktion.', 400);

    let auditStored = true;
    if (PIN_AUDIT_TYPES[action]) {
      const row = targetRow(action, before, list, payload);
      try { await auditPinChange(action, admin, row); }
      catch (auditError) {
        auditStored = false;
        context.log && context.log.error && context.log.error('loader-pin-audit', auditError && auditError.code, auditError && auditError.message);
      }
    }
    context.res = json(200, { ok: true, pins: list, count: list.length, serverStored: true, auditStored, admin: adminName(admin), version: 'RC1087' });
  } catch (e) {
    context.log && context.log.error && context.log.error('loader-pins-admin', e && e.code, e && e.message);
    context.res = json(e.status || 500, { ok: false, code: e.code || 'SERVER_ERROR', message: e.message || apiI18n.t(req,'api.loaderPins.manageFailed') });
  }
};
