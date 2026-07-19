'use strict';

const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');
const { applyUserPolicy, isAdmin, normalizeRights, publicUser } = require('./user-policy');

const TEAM_CONTAINER = process.env.EXPORTHUB_STORAGE_CONTAINER || 'exporthub-data';
const TEAM_BLOB = process.env.EXPORTHUB_STORAGE_BLOB || 'team-state.json';
const AUTH_BLOB = process.env.EXPORTHUB_AUTH_BLOB || 'auth-sessions.json';
const MAX_RETRIES = 6;
const PBKDF2_ITERATIONS = Math.max(120000, Number(process.env.EXPORTHUB_PBKDF2_ITERATIONS || 210000));
const SESSION_DAYS = Math.max(1, Number(process.env.EXPORTHUB_SESSION_DAYS || 365));

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function text(value) { return String(value == null ? '' : value).trim(); }
function lower(value) { return text(value).toLowerCase(); }
function now() { return new Date().toISOString(); }
function randomId(prefix) { return `${prefix}-${crypto.randomBytes(12).toString('hex')}`; }
function usernameOf(user) { return lower(user && (user.user || user.login || user.username || user.name)); }
function json(status, body, headers = {}) {
  return {
    status,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }, headers),
    body: JSON.stringify(body)
  };
}
function error(code, message, status = 400, extra = {}) {
  const e = new Error(message);
  e.code = code;
  e.status = status;
  Object.assign(e, extra);
  return e;
}
function body(req) {
  if (!req) return {};
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}
function connectionString() {
  return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || '';
}
async function clients() {
  const cs = connectionString();
  if (!cs) throw error('STORAGE_NOT_CONFIGURED', 'Azure-Speicher ist nicht konfiguriert.', 503);
  const service = BlobServiceClient.fromConnectionString(cs);
  const container = service.getContainerClient(TEAM_CONTAINER);
  await container.createIfNotExists();
  return {
    team: container.getBlockBlobClient(TEAM_BLOB),
    auth: container.getBlockBlobClient(AUTH_BLOB)
  };
}
async function readJson(blob, fallback) {
  try {
    const response = await blob.download(0);
    const chunks = [];
    for await (const chunk of response.readableStreamBody) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString('utf8');
    return { value: raw ? JSON.parse(raw) : clone(fallback), etag: response.etag || null };
  } catch (e) {
    if (e && e.statusCode === 404) return { value: clone(fallback), etag: null };
    throw e;
  }
}
async function writeJson(blob, value, etag) {
  const raw = JSON.stringify(value);
  return blob.upload(raw, Buffer.byteLength(raw), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
    conditions: etag ? { ifMatch: etag } : { ifNoneMatch: '*' }
  });
}
function emptyTeam() {
  return { schemaVersion: 3, revision: 0, updatedAt: null, updatedBy: null, state: {}, users: [] };
}
function emptyAuth() { return { schemaVersion: 1, updatedAt: null, sessions: [] }; }
function safeEqualText(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}
function credentialFromPassword(password, salt) {
  const actualSalt = salt || crypto.randomBytes(18).toString('base64url');
  const hash = crypto.pbkdf2Sync(String(password), actualSalt, PBKDF2_ITERATIONS, 32, 'sha256').toString('base64url');
  return { algorithm: 'pbkdf2-sha256', iterations: PBKDF2_ITERATIONS, salt: actualSalt, hash, createdAt: now() };
}
function verifyCredential(password, credential) {
  if (!credential || !credential.salt || !credential.hash) return false;
  const iterations = Math.max(120000, Number(credential.iterations || PBKDF2_ITERATIONS));
  const hash = crypto.pbkdf2Sync(String(password), String(credential.salt), iterations, 32, 'sha256').toString('base64url');
  return safeEqualText(hash, credential.hash);
}
function credentialOf(user) {
  if (user && user.passwordCredential && user.passwordCredential.hash) return user.passwordCredential;
  if (user && user.passwordHash && user.passwordSalt) {
    return { algorithm: 'pbkdf2-sha256', iterations: Number(user.passwordIterations || PBKDF2_ITERATIONS), salt: user.passwordSalt, hash: user.passwordHash };
  }
  return null;
}
function passwordPolicy(password) {
  const value = String(password || '');
  if (value.length < 6) return 'Das Passwort muss mindestens 6 Zeichen lang sein.';
  if (!/[A-ZÄÖÜ]/.test(value)) return 'Das Passwort muss mindestens einen Großbuchstaben enthalten.';
  if (!/[a-zäöüß]/.test(value)) return 'Das Passwort muss mindestens einen Kleinbuchstaben enthalten.';
  if (!/\d/.test(value)) return 'Das Passwort muss mindestens eine Zahl enthalten.';
  return '';
}
function passwordWasUsed(user, password) {
  const all = [];
  const current = credentialOf(user);
  if (current) all.push(current);
  for (const item of Array.isArray(user && user.passwordHistory) ? user.passwordHistory : []) if (item && item.hash) all.push(item);
  return all.some((item) => verifyCredential(password, item));
}
function setPassword(user, password, options = {}) {
  const policyError = passwordPolicy(password);
  if (policyError) throw error('PASSWORD_POLICY', policyError, 400);
  if (!options.allowReuse && passwordWasUsed(user, password)) throw error('PASSWORD_REUSED', 'Ein bereits verwendetes Passwort darf nicht erneut benutzt werden.', 409);
  const previous = credentialOf(user);
  user.passwordHistory = Array.isArray(user.passwordHistory) ? user.passwordHistory : [];
  if (previous) user.passwordHistory.push(clone(previous));
  user.passwordCredential = credentialFromPassword(password);
  delete user.password;
  delete user.passwordHash;
  delete user.passwordSalt;
  delete user.passwordIterations;
  user.mustChange = options.mustChange === true;
  user.passwordChangedAt = now();
  user.authVersion = Number(user.authVersion || 0) + 1;
  user.updatedAt = now();
}
function generatedPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowerChars = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lowerChars + digits;
  const pick = (chars) => chars[crypto.randomInt(0, chars.length)];
  const chars = [pick(upper), pick(lowerChars), pick(digits)];
  while (chars.length < 10) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
function isActive(user) { return Boolean(user && user.active !== false && user.disabled !== true && user.status !== 'Deaktiviert'); }
function lockInfo(user) {
  const sec = user && user.loginSecurity || {};
  const until = Date.parse(sec.lockedUntil || '');
  return {
    failedAttempts: Number(sec.failedAttempts || 0),
    lockedUntil: Number.isFinite(until) && until > Date.now() ? new Date(until).toISOString() : null,
    permanentLocked: sec.permanentLocked === true,
    secondStage: sec.stage === 'second'
  };
}
function addAudit(team, type, actor, details = {}) {
  team.state = team.state && typeof team.state === 'object' ? team.state : {};
  team.state.auditLog = Array.isArray(team.state.auditLog) ? team.state.auditLog : [];
  const clean = clone(details || {});
  for (const key of Object.keys(clean)) if (/pass|secret|token|hash|salt/i.test(key)) delete clean[key];
  team.state.auditLog.push({ id: randomId('AUD'), type, actor: text(actor) || 'System', at: now(), details: clean });
}
async function mutateTeam(mutator) {
  const c = await clients();
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const d = await readJson(c.team, emptyTeam());
    const team = applyUserPolicy(d.value || emptyTeam());
    const result = await mutator(team);
    team.revision = Number(team.revision || 0) + 1;
    team.updatedAt = now();
    try {
      await writeJson(c.team, team, d.etag);
      return { team, result };
    } catch (e) {
      if (e && e.statusCode === 412 && attempt < MAX_RETRIES - 1) continue;
      throw e;
    }
  }
  throw error('CONCURRENT_UPDATE', 'Die Benutzeränderung konnte wegen paralleler Änderungen nicht gespeichert werden.', 409);
}
async function mutateAuth(mutator) {
  const c = await clients();
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const d = await readJson(c.auth, emptyAuth());
    const auth = d.value || emptyAuth();
    auth.sessions = Array.isArray(auth.sessions) ? auth.sessions : [];
    const cutoff = Date.now();
    auth.sessions = auth.sessions.filter((s) => !s.revokedAt && Date.parse(s.expiresAt || '') > cutoff);
    const result = await mutator(auth);
    auth.updatedAt = now();
    try {
      await writeJson(c.auth, auth, d.etag);
      return { auth, result };
    } catch (e) {
      if (e && e.statusCode === 412 && attempt < MAX_RETRIES - 1) continue;
      throw e;
    }
  }
  throw error('CONCURRENT_UPDATE', 'Die Sitzung konnte wegen paralleler Änderungen nicht gespeichert werden.', 409);
}
function tokenHash(token) { return crypto.createHash('sha256').update(String(token || '')).digest('hex'); }
function bearer(req) {
  const headers = req && req.headers || {};
  const value = headers.authorization || headers.Authorization || '';
  const match = String(value).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}
async function createSession(user, deviceId, mustChange) {
  const token = crypto.randomBytes(32).toString('base64url');
  const session = {
    id: randomId('SES'),
    tokenHash: tokenHash(token),
    userId: text(user.id),
    username: text(user.user || user.login || user.name),
    displayName: text(user.name || user.user),
    deviceId: text(deviceId).slice(0, 120),
    createdAt: now(),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000).toISOString(),
    authVersion: Number(user.authVersion || 0),
    mustChange: mustChange === true
  };
  await mutateAuth((auth) => { auth.sessions.push(session); return session; });
  return { token, session };
}
async function validateSession(req, options = {}) {
  const token = bearer(req);
  if (!token) throw error('AUTH_REQUIRED', 'ExportHUB-Anmeldung erforderlich.', 401);
  const c = await clients();
  const authDoc = await readJson(c.auth, emptyAuth());
  const hash = tokenHash(token);
  const session = (authDoc.value && Array.isArray(authDoc.value.sessions) ? authDoc.value.sessions : []).find((s) => safeEqualText(s.tokenHash, hash));
  if (!session || session.revokedAt || Date.parse(session.expiresAt || '') <= Date.now()) throw error('SESSION_INVALID', 'Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.', 401);
  const teamDoc = await readJson(c.team, emptyTeam());
  const team = applyUserPolicy(teamDoc.value || emptyTeam());
  const user = (team.users || []).find((u) => text(u.id) === text(session.userId) || usernameOf(u) === lower(session.username));
  if (!user || !isActive(user)) throw error('ACCOUNT_DISABLED', 'Das Benutzerkonto ist deaktiviert.', 403);
  if (Number(session.authVersion || 0) !== Number(user.authVersion || 0)) throw error('SESSION_REVOKED', 'Die Sitzung wurde beendet. Bitte erneut anmelden.', 401);
  if ((session.mustChange || user.mustChange) && !options.allowPasswordChange) throw error('PASSWORD_CHANGE_REQUIRED', 'Vor der Nutzung muss das Startpasswort geändert werden.', 403);
  return { token, session, user, team, teamEtag: teamDoc.etag };
}
function hasAnyEditRight(user) {
  if (isAdmin(user)) return true;
  return Object.values(user && user.rights || {}).some((r) => r && (r.edit === true || r.admin === true || r.functionAdmin === true || r.level === 'edit' || r.level === 'admin'));
}
function adminCount(users) { return (users || []).filter((u) => isAdmin(u) && isActive(u)).length; }
function publicUsers(users, adminView = false) { return (users || []).map((u) => publicUser(u, adminView)); }
function findUser(users, username) { const key = lower(username); return (users || []).find((u) => usernameOf(u) === key); }
function sanitizeDocumentForClient(team, adminView = false) {
  const out = clone(team || emptyTeam());
  out.users = publicUsers(out.users, adminView);
  out.state = out.state && typeof out.state === 'object' ? out.state : {};
  out.state.users = clone(out.users);
  return out;
}
async function revokeUserSessions(userId, reason, exceptSessionId) {
  return mutateAuth((auth) => {
    let count = 0;
    for (const s of auth.sessions) {
      if (text(s.userId) === text(userId) && text(s.id) !== text(exceptSessionId) && !s.revokedAt) {
        s.revokedAt = now(); s.revokedReason = text(reason); count += 1;
      }
    }
    return count;
  });
}

module.exports = {
  TEAM_CONTAINER, TEAM_BLOB, AUTH_BLOB, PBKDF2_ITERATIONS,
  clone, text, lower, now, json, error, body, clients, readJson, writeJson,
  emptyTeam, emptyAuth, usernameOf, isAdmin, isActive, lockInfo, publicUser, publicUsers,
  applyUserPolicy, normalizeRights, credentialOf, credentialFromPassword, verifyCredential,
  passwordPolicy, passwordWasUsed, setPassword, generatedPassword, addAudit,
  mutateTeam, mutateAuth, bearer, createSession, validateSession, hasAnyEditRight,
  adminCount, findUser, sanitizeDocumentForClient, revokeUserSessions, safeEqualText
};
