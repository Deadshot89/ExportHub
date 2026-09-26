'use strict';

const auth = require('../shared/auth-store');
const apiI18n = require('./i18n');
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
function isSignedTestserviceE2E(token){
  if (typeof auth.verifySignedSessionToken !== 'function') return false;
  const signed = auth.verifySignedSessionToken(token);
  return Boolean(
    signed &&
    auth.lower(signed.environment) === 'testservice' &&
    /^E2E-USER-/.test(auth.text(signed.uid)) &&
    /^e2e\./.test(auth.lower(signed.username))
  );
}

async function validateSession(req, options = {}){
  if (!supportsFastPath()) return auth.validateSession(req, options);
  const token = auth.bearer(req);
  if (!token) throw auth.error('AUTH_REQUIRED', apiI18n.t(req,'api.common.authRequired'), 401);
  if (isSignedTestserviceE2E(token)) return auth.validateSession(req, options);
  const c = await clients();
  const { authDoc, teamDoc } = await readSessionDocuments(c);
  const resolved = auth.resolveSession(token, authDoc.value || auth.emptyAuth());
  const session = resolved.session;
  if (!session) throw auth.error('SESSION_INVALID', apiI18n.t(req,'api.common.sessionInvalid'), 401);
  if (session.revokedAt) throw auth.error('SESSION_REVOKED', apiI18n.t(req,'api.common.sessionRevoked'), 401);
  if (Date.parse(session.expiresAt || '') <= Date.now()) throw auth.error('SESSION_INVALID', apiI18n.t(req,'api.common.sessionInvalid'), 401);
  const team = auth.applyUserPolicy(teamDoc.value || auth.emptyTeam());
  const user = (team.users || []).find((candidate) => auth.text(candidate.id) === auth.text(session.userId) || auth.usernameOf(candidate) === auth.lower(session.username));
  if (!user || !auth.isActive(user)) throw auth.error('ACCOUNT_DISABLED', apiI18n.t(req,'api.common.accountDisabled'), 403);
  if (Number(session.authVersion || 0) !== Number(user.authVersion || 0)) throw auth.error('SESSION_REVOKED', apiI18n.t(req,'api.common.sessionRevoked'), 401);
  if ((session.mustChange || user.mustChange) && !options.allowPasswordChange) throw auth.error('PASSWORD_CHANGE_REQUIRED', apiI18n.t(req,'api.common.passwordChangeRequired'), 403);
  return { token, session, user, team, source: resolved.source, authDoc, teamDoc };
}

module.exports = Object.assign({}, auth, { clients, validateSession, isSource });