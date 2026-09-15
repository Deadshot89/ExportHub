'use strict';

const auth = require('../shared/auth-store');

function sessionIsActive(session,at){
  if(typeof auth.sessionIsActive==='function')return sessionIsActive(session,at);
  return !!(session&&!session.revokedAt&&Date.parse(session.expiresAt||'')>(at||Date.now()));
}
function sessionIdleExpiresAt(session){
  if(typeof auth.sessionIdleExpiresAt==='function')return sessionIdleExpiresAt(session);
  return Date.parse(session&&session.expiresAt||'')||0;
}
async function touchSessionActivity(token,session,source){
  if(typeof auth.touchSessionActivity==='function')return touchSessionActivity(token,session,source);
  return false;
}
let clientsPromise = null;
let sessionDocumentsPromise = null;

async function clients(){
  if (!clientsPromise) {
    clientsPromise = auth.clients().catch((error) => {
      clientsPromise = null;
      throw error;
    });
  }
  return clientsPromise;
}

function readSessionDocuments(c){
  if (!sessionDocumentsPromise) {
    sessionDocumentsPromise = Promise.all([
      auth.readJson(c.auth, auth.emptyAuth()),
      auth.readJson(c.team, auth.emptyTeam())
    ]).then(([authDoc, teamDoc]) => ({ authDoc, teamDoc })).finally(() => {
      sessionDocumentsPromise = null;
    });
  }
  return sessionDocumentsPromise;
}

function supportsFastPath(){
  return typeof auth.bearer === 'function' &&
    typeof auth.clients === 'function' &&
    typeof auth.readJson === 'function' &&
    typeof auth.emptyAuth === 'function' &&
    typeof auth.emptyTeam === 'function' &&
    typeof auth.resolveSession === 'function' &&
    typeof auth.applyUserPolicy === 'function' &&
    typeof auth.usernameOf === 'function' &&
    typeof auth.isActive === 'function';
}
function isSource(candidate){ return candidate === auth; }

async function validateSession(req, options = {}){
  if (!supportsFastPath()) return auth.validateSession(req, options);
  const token = auth.bearer(req);
  if (!token) throw auth.error('AUTH_REQUIRED', 'ExportHUB-Anmeldung erforderlich.', 401);
  const c = await clients();
  const { authDoc, teamDoc } = await readSessionDocuments(c);
  const resolved = auth.resolveSession(token, authDoc.value || auth.emptyAuth());
  const session = resolved.session;
  if (!session) throw auth.error('SESSION_INVALID', 'Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.', 401);
  if (session.revokedAt) throw auth.error('SESSION_REVOKED', 'Die Sitzung wurde beendet. Bitte erneut anmelden.', 401);
  const validationNow = Date.now();
  if (!sessionIsActive(session, validationNow)) {
    const idleExpired = sessionIdleExpiresAt(session) > 0 && sessionIdleExpiresAt(session) <= validationNow;
    throw auth.error(idleExpired ? 'SESSION_IDLE_TIMEOUT' : 'SESSION_INVALID', idleExpired ? 'Die Sitzung wurde wegen Inaktivität beendet. Bitte erneut anmelden.' : 'Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.', 401);
  }
  const team = auth.applyUserPolicy(teamDoc.value || auth.emptyTeam());
  const user = (team.users || []).find((candidate) => auth.text(candidate.id) === auth.text(session.userId) || auth.usernameOf(candidate) === auth.lower(session.username));
  if (!user || !auth.isActive(user)) throw auth.error('ACCOUNT_DISABLED', 'Das Benutzerkonto ist deaktiviert.', 403);
  if (Number(session.authVersion || 0) !== Number(user.authVersion || 0)) throw auth.error('SESSION_REVOKED', 'Die Sitzung wurde beendet. Bitte erneut anmelden.', 401);
  if ((session.mustChange || user.mustChange) && !options.allowPasswordChange) throw auth.error('PASSWORD_CHANGE_REQUIRED', 'Vor der Nutzung muss das Startpasswort geändert werden.', 403);
  await touchSessionActivity(token, session, resolved.source);
  return { token, session, user, team, source: resolved.source, authDoc, teamDoc };
}

module.exports = Object.assign({}, auth, { clients, validateSession, isSource });
