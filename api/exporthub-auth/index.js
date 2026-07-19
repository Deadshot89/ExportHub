'use strict';

const crypto = require('crypto');
const auth = require('../shared/auth-store');
const { MODULES, normalizeUser, defaultRights } = require('../shared/user-policy');

function responseError(context, e) {
  const status = e && e.status ? e.status : 500;
  context.res = auth.json(status, {
    ok: false,
    code: e && e.code ? e.code : 'SERVER_ERROR',
    message: e && e.message ? e.message : 'Unbekannter Anmeldefehler.',
    retryAfterSeconds: e && e.retryAfterSeconds ? e.retryAfterSeconds : undefined
  });
}
function requireGlobalAdmin(session) {
  if (!auth.isAdmin(session.user)) throw auth.error('ADMIN_REQUIRED', 'Nur globale Administratoren dürfen diese Aktion ausführen.', 403);
}
function findByIdOrName(users, value) {
  const key = auth.lower(value);
  return (users || []).find((u) => auth.text(u.id) === auth.text(value) || auth.usernameOf(u) === key);
}
function activeAdminCount(users) { return auth.adminCount(users); }
function normalizedSetting(value, fallback = '') {
  let out = String(value == null ? '' : value).trim();
  if (out.length >= 2 && ((out[0] === '"' && out[out.length - 1] === '"') || (out[0] === "'" && out[out.length - 1] === "'"))) out = out.slice(1, -1).trim();
  return out || fallback;
}
function configuredBootstrapUsername() {
  return normalizedSetting(process.env.EXPORTHUB_INITIAL_ADMIN_USERNAME, 'Tobias');
}
function configuredBootstrapSecret() {
  return normalizedSetting(process.env.EXPORTHUB_INITIAL_ADMIN_PASSWORD, '');
}
function recoverySecretMatches(entered, configured) {
  const raw = String(entered == null ? '' : entered);
  if (!configured) return false;
  if (auth.safeEqualText(configured, raw)) return true;
  const trimmed = raw.trim();
  return trimmed !== raw && auth.safeEqualText(configured, trimmed);
}
function soleActiveAdmin(users) {
  const admins = (users || []).filter((candidate) => auth.isAdmin(candidate) && auth.isActive(candidate));
  return admins.length === 1 ? admins[0] : null;
}

function ticketSecret() {
  return normalizedSetting(
    process.env.EXPORTHUB_AUTH_SIGNING_SECRET,
    normalizedSetting(process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage, '')
  );
}
function encodeTicketPart(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value), 'utf8').toString('base64url');
}
function signTicketPart(encodedPayload) {
  const secret = ticketSecret();
  if (!secret) throw auth.error('AUTH_SIGNING_NOT_CONFIGURED', 'Der sichere Passwortwechsel ist serverseitig nicht konfiguriert.', 503);
  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}
function createPasswordChangeTicket(user) {
  const payload = {
    v: 1,
    purpose: 'password-change',
    userId: auth.text(user && user.id),
    username: auth.usernameOf(user),
    authVersion: Number(user && user.authVersion || 0),
    exp: Date.now() + 15 * 60 * 1000,
    nonce: crypto.randomBytes(12).toString('base64url')
  };
  const encoded = encodeTicketPart(payload);
  return encoded + '.' + signTicketPart(encoded);
}
function decodePasswordChangeTicket(ticket) {
  const raw = String(ticket || '').trim();
  const parts = raw.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw auth.error('PASSWORD_TICKET_INVALID', 'Der Passwortwechsel ist nicht mehr gültig. Bitte die Admin-Wiederherstellung erneut starten.', 401);
  const expected = signTicketPart(parts[0]);
  if (!auth.safeEqualText(expected, parts[1])) throw auth.error('PASSWORD_TICKET_INVALID', 'Der Passwortwechsel ist nicht mehr gültig. Bitte die Admin-Wiederherstellung erneut starten.', 401);
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); }
  catch (_) { throw auth.error('PASSWORD_TICKET_INVALID', 'Der Passwortwechsel ist nicht mehr gültig. Bitte die Admin-Wiederherstellung erneut starten.', 401); }
  if (!payload || payload.purpose !== 'password-change' || Number(payload.exp || 0) <= Date.now()) throw auth.error('PASSWORD_TICKET_EXPIRED', 'Der Passwortwechsel ist abgelaufen. Bitte die Admin-Wiederherstellung erneut starten.', 401);
  return payload;
}
async function validatePasswordChangeTicket(ticket, payload) {
  const decoded = decodePasswordChangeTicket(ticket);
  const c = await auth.clients();
  const teamDoc = await auth.readJson(c.team, auth.emptyTeam());
  const team = auth.applyUserPolicy(teamDoc.value || auth.emptyTeam());
  const user = (team.users || []).find((candidate) =>
    auth.text(candidate.id) === auth.text(decoded.userId) || auth.usernameOf(candidate) === auth.lower(decoded.username)
  );
  if (!user || !auth.isActive(user)) throw auth.error('ACCOUNT_DISABLED', 'Das Benutzerkonto ist deaktiviert.', 403);
  if (user.mustChange !== true) throw auth.error('PASSWORD_CHANGE_NOT_ALLOWED', 'Für dieses Konto ist kein Passwortwechsel mehr offen.', 403);
  if (Number(user.authVersion || 0) !== Number(decoded.authVersion || 0)) throw auth.error('PASSWORD_TICKET_REVOKED', 'Der Passwortwechsel wurde bereits verwendet oder zurückgesetzt.', 401);
  return {
    user,
    team,
    session: { id: '', deviceId: auth.text(payload && payload.deviceId), mustChange: true },
    passwordTicket: decoded
  };
}

async function login(payload) {
  const username = auth.text(payload.username || payload.user || payload.login);
  const password = String(payload.password || '');
  const recoveryRequested = payload.recoveryRequested === true || payload.mode === 'recovery';
  if (!username || !password) throw auth.error('LOGIN_REQUIRED', 'Benutzername und Passwort sind erforderlich.', 400);

  const bootstrapUsername = configuredBootstrapUsername();
  const configuredBootstrapPassword = configuredBootstrapSecret();

  const saved = await auth.mutateTeam((team) => {
    team.authBootstrap = team.authBootstrap && typeof team.authBootstrap === 'object' ? team.authBootstrap : {};
    const bootstrapCompleted = Boolean(team.authBootstrap.completedAt);
    const enteredRecoverySecret = recoverySecretMatches(password, configuredBootstrapPassword);
    const usernameMatchesBootstrap = auth.lower(username) === auth.lower(bootstrapUsername) || auth.lower(username) === 'admin';
    let user = auth.findUser(team.users, username);
    // RC550: Das zentrale Azure-Geheimnis kann den konfigurierten Admin auch dann
    // wiederherstellen, wenn im Login versehentlich "Admin" statt des echten
    // Benutzernamens verwendet wurde oder ältere Daten einen anderen Adminnamen tragen.
    if (!user && enteredRecoverySecret && usernameMatchesBootstrap) {
      user = auth.findUser(team.users, bootstrapUsername) || soleActiveAdmin(team.users);
    }

    // RC548: Bestehende Teamdaten dürfen die Erstanmeldung nicht blockieren.
    // Fehlt Tobias in alten Daten, wird er einmalig nur dann ergänzt, wenn noch kein
    // sicher eingerichteter globaler Administrator vorhanden ist.
    if (!user && usernameMatchesBootstrap && enteredRecoverySecret && (!bootstrapCompleted || !(team.users || []).some((candidate) => auth.isAdmin(candidate)))) {
      const secureAdminExists = (team.users || []).some((candidate) => auth.isAdmin(candidate) && Boolean(auth.credentialOf(candidate)));
      if (!secureAdminExists) {
        user = normalizeUser({
          id: 'USER-' + bootstrapUsername.replace(/[^A-Za-z0-9_-]/g, '-'),
          user: bootstrapUsername,
          login: bootstrapUsername,
          username: bootstrapUsername,
          name: bootstrapUsername,
          role: 'Globaler Administrator',
          globalAdmin: true,
          permissions: ['*'],
          rights: defaultRights(true),
          mustChange: true,
          authSetupRequired: true,
          active: true,
          createdAt: auth.now()
        }, team.users.length);
        team.users.push(user);
      }
    }

    if (!user) return { ok: false, code: 'INVALID_CREDENTIALS', message: 'Benutzername oder Passwort ist falsch.', status: 401 };
    if (!auth.isActive(user)) return { ok: false, code: 'ACCOUNT_DISABLED', message: 'Das Benutzerkonto ist deaktiviert.', status: 403 };

    const secureCredential = auth.credentialOf(user);
    const personalPasswordMatches = Boolean(secureCredential && auth.verifyCredential(password, secureCredential));
    const initialPasswordMatches = Boolean(
      enteredRecoverySecret &&
      (usernameMatchesBootstrap || auth.isAdmin(user))
    );
    // RC554: Der sichtbare Wiederherstellungsbutton entsperrt ein dauerhaft
    // gesperrtes initiales Admin-Konto auch mit dem weiterhin bekannten
    // persönlichen Passwort. Der in Azure konfigurierte Startwert muss dafür
    // nur vorhanden sein; er wird nicht offengelegt und nicht ersetzt.
    const recoveryUnlockWithPersonalPassword = Boolean(
      recoveryRequested &&
      configuredBootstrapPassword &&
      usernameMatchesBootstrap &&
      auth.isAdmin(user) &&
      personalPasswordMatches
    );
    const bootstrapEligible = Boolean(
      initialPasswordMatches &&
      !bootstrapCompleted &&
      auth.isAdmin(user) &&
      (!secureCredential || user.authSetupRequired === true)
    );
    const bootstrapPasswordMatches = bootstrapEligible;

    // Ein korrekter einmaliger Azure-Startwert darf eine Sperre aus fehlgeschlagenen
    // Einrichtungsversuchen aufheben. Nach abgeschlossener Einrichtung gilt das nicht mehr.
    const security = user.loginSecurity && typeof user.loginSecurity === 'object'
      ? user.loginSecurity
      : (user.loginSecurity = { failedAttempts: 0, stage: 'first', lockedUntil: null, permanentLocked: false });
    const lockUntil = Date.parse(security.lockedUntil || '');
    if (!initialPasswordMatches && !recoveryUnlockWithPersonalPassword) {
      if (security.permanentLocked === true) {
        return { ok: false, code: 'ACCOUNT_LOCKED_ADMIN', message: 'Das Konto ist gesperrt und kann nur durch einen globalen Administrator entsperrt werden.', status: 423 };
      }
      if (Number.isFinite(lockUntil) && lockUntil > Date.now()) {
        return {
          ok: false,
          code: 'ACCOUNT_LOCKED_TEMPORARY',
          message: 'Das Konto ist vorübergehend gesperrt.',
          status: 423,
          retryAfterSeconds: Math.max(1, Math.ceil((lockUntil - Date.now()) / 1000))
        };
      }
    }
    if (Number.isFinite(lockUntil) && lockUntil <= Date.now()) {
      security.lockedUntil = null;
      security.failedAttempts = 0;
      security.stage = 'second';
    }

    let valid = false;
    let bootstrapUsed = false;
    let recoveryUsed = false;
    let recoveryUnlocked = false;

    if (recoveryUnlockWithPersonalPassword) {
      valid = true;
      recoveryUnlocked = true;
    } else if (bootstrapPasswordMatches) {
      // Das Azure-Geheimnis ist nur ein temporärer Aktivierungswert. Die normale
      // Passwortregel gilt anschließend zwingend beim persönlichen Passwortwechsel.
      auth.setPassword(user, configuredBootstrapPassword, { mustChange: true, allowReuse: true, skipPolicy: true });
      user.authSetupRequired = false;
      user.mustChange = true;
      team.authBootstrap = {
        completedAt: auth.now(),
        userId: user.id,
        username: user.user,
        source: 'EXPORTHUB_INITIAL_ADMIN_PASSWORD'
      };
      valid = true;
      bootstrapUsed = true;
    } else if (secureCredential) {
      valid = personalPasswordMatches;
    } else if (user.password != null) {
      valid = auth.safeEqualText(String(user.password), password);
      if (valid) auth.setPassword(user, password, { mustChange: user.mustChange === true, allowReuse: true });
    } else if (user.authSetupRequired === true || (usernameMatchesBootstrap && !bootstrapCompleted)) {
      if (!configuredBootstrapPassword) {
        return {
          ok: false,
          code: 'INITIAL_ADMIN_NOT_CONFIGURED',
          message: 'Für die Erstanmeldung muss EXPORTHUB_INITIAL_ADMIN_PASSWORD in Azure konfiguriert werden.',
          status: 503
        };
      }
    }

    // RC548 recovery: if the personal credential is unavailable or no longer known,
    // the exact Azure initial-admin secret can recover only the configured initial username.
    // The account is forced through a new password change and all old sessions are revoked.
    if (!valid && initialPasswordMatches) {
      user.globalAdmin = true;
      user.role = 'Globaler Administrator';
      user.permissions = ['*'];
      user.rights = defaultRights(true);
      user.active = true;
      user.disabled = false;
      user.status = 'Aktiv';
      auth.setPassword(user, configuredBootstrapPassword, { mustChange: true, allowReuse: true, skipPolicy: true });
      user.authSetupRequired = false;
      user.mustChange = true;
      team.authBootstrap = Object.assign({}, team.authBootstrap || {}, {
        completedAt: team.authBootstrap && team.authBootstrap.completedAt || auth.now(),
        recoveredAt: auth.now(),
        userId: user.id,
        username: user.user,
        source: 'EXPORTHUB_INITIAL_ADMIN_PASSWORD_RECOVERY'
      });
      valid = true;
      recoveryUsed = true;
    }

    if (!valid) {
      security.failedAttempts = Number(security.failedAttempts || 0) + 1;
      security.lastFailureAt = auth.now();
      const limit = security.stage === 'second' ? 2 : 5;
      let result = { ok: false, code: 'INVALID_CREDENTIALS', message: 'Benutzername oder Passwort ist falsch.', status: 401 };
      if (security.failedAttempts >= limit) {
        if (security.stage === 'second') {
          security.permanentLocked = true;
          security.lockedUntil = null;
          result = { ok: false, code: 'ACCOUNT_LOCKED_ADMIN', message: 'Das Konto ist gesperrt und kann nur durch einen globalen Administrator entsperrt werden.', status: 423 };
        } else {
          security.stage = 'cooldown';
          security.lockedUntil = new Date(Date.now() + 30 * 60000).toISOString();
          result = { ok: false, code: 'ACCOUNT_LOCKED_TEMPORARY', message: 'Das Konto wurde nach fünf Fehlversuchen für 30 Minuten gesperrt.', status: 423, retryAfterSeconds: 1800 };
        }
      }
      user.updatedAt = auth.now();
      auth.addAudit(team, 'LOGIN_FAILED', username, { username, code: result.code, failedAttempts: security.failedAttempts });
      return result;
    }

    security.failedAttempts = 0;
    security.lockedUntil = null;
    security.permanentLocked = false;
    security.stage = 'first';
    security.lastSuccessAt = auth.now();
    user.updatedAt = auth.now();
    if (bootstrapUsed) auth.addAudit(team, 'INITIAL_ADMIN_BOOTSTRAPPED', user.name || user.user, { userId: user.id, username: user.user });
    if (recoveryUsed) auth.addAudit(team, 'INITIAL_ADMIN_RECOVERED', user.name || user.user, { userId: user.id, username: user.user });
    if (recoveryUnlocked) auth.addAudit(team, 'ADMIN_ACCOUNT_UNLOCKED_WITH_PERSONAL_PASSWORD', user.name || user.user, { userId: user.id, username: user.user });
    auth.addAudit(team, 'LOGIN_SUCCESS', user.name || user.user, { userId: user.id, username: user.user, recoveryUsed });
    return { ok: true, userId: user.id, mustChange: user.mustChange === true, recoveryUsed, recoveryUnlocked };
  });

  const outcome = saved.result;
  if (!outcome || outcome.ok !== true) throw auth.error(outcome.code, outcome.message, outcome.status, { retryAfterSeconds: outcome.retryAfterSeconds });
  const user = saved.team.users.find((u) => auth.text(u.id) === auth.text(outcome.userId));
  if (outcome.recoveryUsed) await auth.revokeUserSessions(user.id, 'Admin-Zugang wiederhergestellt');
  const created = await auth.createSession(user, payload.deviceId, outcome.mustChange);
  return {
    ok: true,
    token: created.token,
    mustChange: outcome.mustChange,
    passwordChangeTicket: outcome.mustChange ? createPasswordChangeTicket(user) : '',
    recoveryUsed: outcome.recoveryUsed === true,
    recoveryUnlocked: outcome.recoveryUnlocked === true,
    user: auth.publicUser(user, false),
    passwordPolicy: { minLength: 6, upper: true, lower: true, number: true, special: false, history: true }
  };
}

async function bootstrapStatus(payload) {
  const bootstrapUsername = configuredBootstrapUsername();
  const storageConfigured = Boolean(process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage);
  const initialPasswordConfigured = Boolean(configuredBootstrapSecret());
  if (!storageConfigured) {
    return {
      ok: true,
      version: 'RC556',
      storageConfigured: false,
      initialPasswordConfigured,
      bootstrapUsername,
      bootstrapCompleted: false,
      userExists: false,
      userHasCredential: false,
      requiresBootstrap: true,
      message: 'Azure-Speicher ist noch nicht konfiguriert.'
    };
  }
  let stored;
  try {
    const c = await auth.clients();
    stored = await auth.readJson(c.team, auth.emptyTeam());
  } catch (storageError) {
    return {
      ok: true,
      version: 'RC556',
      storageConfigured: true,
      storageReachable: false,
      initialPasswordConfigured,
      bootstrapUsername,
      bootstrapCompleted: false,
      userExists: false,
      userHasCredential: false,
      requiresBootstrap: true,
      storageErrorCode: storageError && (storageError.code || storageError.name) || 'STORAGE_UNREACHABLE',
      message: 'Die Azure-Speicherverbindung ist hinterlegt, aber nicht erreichbar.'
    };
  }
  const team = auth.applyUserPolicy(stored.value || auth.emptyTeam());
  const user = auth.findUser(team.users, bootstrapUsername);
  const bootstrapCompleted = Boolean(team.authBootstrap && team.authBootstrap.completedAt);
  const userHasCredential = Boolean(user && auth.credentialOf(user));
  const userLock = user ? auth.lockInfo(user) : { permanentLocked: false, lockedUntil: null };
  return {
    ok: true,
    version: 'RC556',
    storageConfigured: true,
    storageReachable: true,
    initialPasswordConfigured,
    bootstrapUsername,
    bootstrapCompleted,
    userExists: Boolean(user),
    userHasCredential,
    accountActive: Boolean(user && auth.isActive(user)),
    accountLocked: Boolean(userLock.permanentLocked),
    accountLockedUntil: userLock.lockedUntil || null,
    requiresBootstrap: !bootstrapCompleted && (!userHasCredential || Boolean(user && user.authSetupRequired)),
    recoveryAvailable: Boolean(initialPasswordConfigured && user),
    message: userLock.permanentLocked && initialPasswordConfigured
      ? 'Das globale Admin-Konto ist dauerhaft gesperrt. Über „Admin-Zugang wiederherstellen“ kann es mit dem bekannten persönlichen Passwort oder dem Azure-Startwert entsperrt werden.'
      : (!initialPasswordConfigured && !bootstrapCompleted
        ? 'Das einmalige Admin-Startpasswort ist in Azure noch nicht hinterlegt.'
        : (!bootstrapCompleted ? 'Die einmalige Admin-Aktivierung ist bereit.' : (initialPasswordConfigured ? 'Die sichere Anmeldung ist eingerichtet; Admin-Wiederherstellung ist verfügbar.' : 'Die sichere Anmeldung ist eingerichtet.')))
  };
}

async function changePassword(req, payload) {
  let current;
  try {
    current = await auth.validateSession(req, { allowPasswordChange: true });
  } catch (sessionError) {
    const fallbackCodes = ['SESSION_INVALID', 'SESSION_REVOKED', 'AUTH_REQUIRED'];
    if (!payload.passwordChangeTicket || fallbackCodes.indexOf(sessionError && sessionError.code) < 0) throw sessionError;
    current = await validatePasswordChangeTicket(payload.passwordChangeTicket, payload);
  }
  if (!current.user.mustChange && !current.session.mustChange) throw auth.error('PASSWORD_CHANGE_NOT_ALLOWED', 'Das eigene Passwort kann nur bei der Erstanmeldung oder nach einem administrativen Reset geändert werden.', 403);
  const password = String(payload.newPassword || '');
  const repeat = String(payload.repeatPassword || payload.confirmPassword || '');
  if (password !== repeat) throw auth.error('PASSWORD_MISMATCH', 'Die beiden Passwörter stimmen nicht überein.', 400);

  const changed = await auth.mutateTeam((team) => {
    const user = findByIdOrName(team.users, current.user.id);
    if (!user) throw auth.error('USER_NOT_FOUND', 'Benutzer wurde nicht gefunden.', 404);
    auth.setPassword(user, password, { mustChange: false, allowReuse: false });
    user.mustChange = false;
    auth.addAudit(team, 'PASSWORD_CHANGED', user.name || user.user, { userId: user.id });
    return { userId: user.id };
  });
  const user = changed.team.users.find((u) => auth.text(u.id) === auth.text(changed.result.userId));
  await auth.revokeUserSessions(user.id, 'Passwort geändert');
  const created = await auth.createSession(user, payload.deviceId || current.session.deviceId, false);
  return { ok: true, token: created.token, mustChange: false, user: auth.publicUser(user, false) };
}

async function logout(req) {
  const token = auth.bearer(req);
  if (!token) return { ok: true };
  const hash = require('crypto').createHash('sha256').update(token).digest('hex');
  await auth.mutateAuth((document) => {
    const session = document.sessions.find((s) => auth.safeEqualText(s.tokenHash, hash));
    if (session) { session.revokedAt = auth.now(); session.revokedReason = 'Abmeldung'; }
    return true;
  });
  return { ok: true };
}

async function adminList(req) {
  const current = await auth.validateSession(req);
  requireGlobalAdmin(current);
  const c = await auth.clients();
  const teamDoc = await auth.readJson(c.team, auth.emptyTeam());
  const team = auth.applyUserPolicy(teamDoc.value || auth.emptyTeam());
  const authDoc = await auth.readJson(c.auth, auth.emptyAuth());
  const sessions = (authDoc.value && Array.isArray(authDoc.value.sessions) ? authDoc.value.sessions : []).filter((s) => !s.revokedAt && Date.parse(s.expiresAt || '') > Date.now());
  const users = auth.publicUsers(team.users, true).map((u) => Object.assign(u, { activeSessions: sessions.filter((s) => auth.text(s.userId) === auth.text(u.id)).length }));
  return { ok: true, users, modules: MODULES, sessions: sessions.map((s) => ({ id: s.id, userId: s.userId, username: s.username, displayName: s.displayName, deviceId: s.deviceId, createdAt: s.createdAt, expiresAt: s.expiresAt })) };
}

async function adminCreate(req, payload) {
  const current = await auth.validateSession(req);
  requireGlobalAdmin(current);
  const username = auth.text(payload.username || payload.user);
  const name = auth.text(payload.name) || username;
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) throw auth.error('INVALID_USERNAME', 'Der Benutzername muss 3 bis 40 Zeichen lang sein und darf nur Buchstaben, Zahlen, Punkt, Unterstrich oder Bindestrich enthalten.', 400);
  const startPassword = auth.generatedPassword();
  const result = await auth.mutateTeam((team) => {
    if (auth.findUser(team.users, username)) throw auth.error('USER_EXISTS', 'Dieser Benutzername ist bereits vorhanden.', 409);
    const globalAdmin = payload.globalAdmin === true;
    const user = {
      id: `USER-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      user: username, login: username, username, name,
      role: globalAdmin ? 'Globaler Administrator' : 'Benutzer',
      globalAdmin,
      permissions: globalAdmin ? ['*'] : [],
      rights: auth.normalizeRights(payload.rights || {}, globalAdmin),
      active: true, disabled: false, mustChange: true,
      authVersion: 0, createdAt: auth.now(), createdBy: current.user.name || current.user.user,
      loginSecurity: { failedAttempts: 0, stage: 'first', lockedUntil: null, permanentLocked: false }
    };
    auth.setPassword(user, startPassword, { mustChange: true, allowReuse: true });
    team.users.push(user);
    auth.addAudit(team, 'USER_CREATED', current.user.name || current.user.user, { userId: user.id, username: user.user, globalAdmin });
    return { userId: user.id };
  });
  const user = result.team.users.find((u) => auth.text(u.id) === auth.text(result.result.userId));
  return { ok: true, user: auth.publicUser(user, true), startPassword };
}

async function adminUpdate(req, payload) {
  const current = await auth.validateSession(req);
  requireGlobalAdmin(current);
  const result = await auth.mutateTeam((team) => {
    const user = findByIdOrName(team.users, payload.userId || payload.username);
    if (!user) throw auth.error('USER_NOT_FOUND', 'Benutzer wurde nicht gefunden.', 404);
    const beforeAdmin = auth.isAdmin(user);
    const nextAdmin = payload.globalAdmin === undefined ? beforeAdmin : payload.globalAdmin === true;
    if (beforeAdmin && !nextAdmin && activeAdminCount(team.users) <= 1) throw auth.error('LAST_ADMIN_PROTECTED', 'Der letzte globale Administrator kann nicht herabgestuft werden.', 409);
    if (payload.name !== undefined) user.name = auth.text(payload.name) || user.user;
    user.globalAdmin = nextAdmin;
    user.role = nextAdmin ? 'Globaler Administrator' : 'Benutzer';
    user.permissions = nextAdmin ? ['*'] : [];
    user.rights = auth.normalizeRights(payload.rights || user.rights || {}, nextAdmin);
    user.updatedAt = auth.now();
    user.updatedBy = current.user.name || current.user.user;
    auth.addAudit(team, 'USER_RIGHTS_UPDATED', current.user.name || current.user.user, { userId: user.id, username: user.user, globalAdmin: nextAdmin });
    return { userId: user.id };
  });
  const user = result.team.users.find((u) => auth.text(u.id) === auth.text(result.result.userId));
  return { ok: true, user: auth.publicUser(user, true) };
}

async function adminSetActive(req, payload) {
  const current = await auth.validateSession(req);
  requireGlobalAdmin(current);
  const active = payload.active === true;
  const result = await auth.mutateTeam((team) => {
    const user = findByIdOrName(team.users, payload.userId || payload.username);
    if (!user) throw auth.error('USER_NOT_FOUND', 'Benutzer wurde nicht gefunden.', 404);
    if (!active && auth.isAdmin(user) && activeAdminCount(team.users) <= 1) throw auth.error('LAST_ADMIN_PROTECTED', 'Der letzte globale Administrator kann nicht deaktiviert werden.', 409);
    user.active = active; user.disabled = !active; user.status = active ? 'Aktiv' : 'Deaktiviert';
    user.authVersion = Number(user.authVersion || 0) + 1;
    user.updatedAt = auth.now();
    auth.addAudit(team, active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', current.user.name || current.user.user, { userId: user.id, username: user.user });
    return { userId: user.id };
  });
  await auth.revokeUserSessions(result.result.userId, active ? 'Benutzerstatus geändert' : 'Benutzer deaktiviert');
  const user = result.team.users.find((u) => auth.text(u.id) === auth.text(result.result.userId));
  return { ok: true, user: auth.publicUser(user, true) };
}

async function adminResetPassword(req, payload) {
  const current = await auth.validateSession(req);
  requireGlobalAdmin(current);
  const startPassword = auth.generatedPassword();
  const result = await auth.mutateTeam((team) => {
    const user = findByIdOrName(team.users, payload.userId || payload.username);
    if (!user) throw auth.error('USER_NOT_FOUND', 'Benutzer wurde nicht gefunden.', 404);
    auth.setPassword(user, startPassword, { mustChange: true, allowReuse: false });
    user.mustChange = true;
    auth.addAudit(team, 'PASSWORD_RESET', current.user.name || current.user.user, { userId: user.id, username: user.user });
    return { userId: user.id };
  });
  await auth.revokeUserSessions(result.result.userId, 'Passwort zurückgesetzt');
  return { ok: true, userId: result.result.userId, startPassword };
}

async function adminUnlock(req, payload) {
  const current = await auth.validateSession(req);
  requireGlobalAdmin(current);
  const result = await auth.mutateTeam((team) => {
    const user = findByIdOrName(team.users, payload.userId || payload.username);
    if (!user) throw auth.error('USER_NOT_FOUND', 'Benutzer wurde nicht gefunden.', 404);
    user.loginSecurity = { failedAttempts: 0, stage: 'first', lockedUntil: null, permanentLocked: false, unlockedAt: auth.now(), unlockedBy: current.user.name || current.user.user };
    user.updatedAt = auth.now();
    auth.addAudit(team, 'ACCOUNT_UNLOCKED', current.user.name || current.user.user, { userId: user.id, username: user.user });
    return { userId: user.id };
  });
  return { ok: true, userId: result.result.userId };
}

async function adminTerminateSessions(req, payload) {
  const current = await auth.validateSession(req);
  requireGlobalAdmin(current);
  const userId = auth.text(payload.userId);
  const sessionId = auth.text(payload.sessionId);
  const result = await auth.mutateAuth((document) => {
    let count = 0;
    for (const s of document.sessions) {
      if (s.revokedAt) continue;
      if ((sessionId && auth.text(s.id) === sessionId) || (!sessionId && userId && auth.text(s.userId) === userId)) {
        s.revokedAt = auth.now(); s.revokedReason = 'Durch globalen Administrator beendet'; count += 1;
      }
    }
    return count;
  });
  return { ok: true, terminated: result.result };
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
    return;
  }
  if (req.method !== 'POST') {
    context.res = auth.json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST, OPTIONS' });
    return;
  }
  try {
    const payload = auth.body(req);
    // Body fallback is used only for the same-origin authentication endpoint.
    // It protects the password-change transition if Azure removes Authorization.
    if (payload.sessionToken && !auth.bearer(req)) {
      req.headers = Object.assign({}, req.headers || {}, { 'x-exporthub-token': auth.text(payload.sessionToken) });
    }
    const action = auth.lower(payload.action);
    let result;
    if (action === 'bootstrap-status') result = await bootstrapStatus(payload);
    else if (action === 'login') result = await login(payload);
    else if (action === 'change-password') result = await changePassword(req, payload);
    else if (action === 'logout') result = await logout(req);
    else if (action === 'session') {
      const current = await auth.validateSession(req, { allowPasswordChange: true });
      result = { ok: true, mustChange: current.user.mustChange === true || current.session.mustChange === true, user: auth.publicUser(current.user, false) };
    }
    else if (action === 'admin-list') result = await adminList(req);
    else if (action === 'admin-create-user') result = await adminCreate(req, payload);
    else if (action === 'admin-update-user') result = await adminUpdate(req, payload);
    else if (action === 'admin-set-active') result = await adminSetActive(req, payload);
    else if (action === 'admin-reset-password') result = await adminResetPassword(req, payload);
    else if (action === 'admin-unlock') result = await adminUnlock(req, payload);
    else if (action === 'admin-terminate-sessions') result = await adminTerminateSessions(req, payload);
    else throw auth.error('UNKNOWN_ACTION', 'Unbekannte Anmeldeaktion.', 400);
    context.res = auth.json(200, result);
  } catch (e) {
    context.log.error('ExportHUB auth API error', e && e.code, e && e.message);
    responseError(context, e);
  }
};
