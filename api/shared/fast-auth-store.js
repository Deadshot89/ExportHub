'use strict';

const auth = require('../shared/auth-store');
let clientsPromise = null;

async function clients(){
  if (!clientsPromise) {
    clientsPromise = auth.clients().catch((error) => {
      clientsPromise = null;
      throw error;
    });
  }
  return clientsPromise;
}

async function validateSession(req, options = {}){
  const token = auth.bearer(req);
  if (!token) throw auth.error('AUTH_REQUIRED', 'ExportHUB-Anmeldung erforderlich.', 401);
  const c = await clients();
  const [authDoc, teamDoc] = await Promise.all([
    auth.readJson(c.auth, auth.emptyAuth()),
    auth.readJson(c.team, auth.emptyTeam())
  ]);
  const resolved = auth.resolveSession(token, authDoc.value || auth.emptyAuth());
  const session = resolved.session;
  if (!session) throw auth.error('SESSION_INVALID', 'Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.', 401);
  if (session.revokedAt) throw auth.error('SESSION_REVOKED', 'Die Sitzung wurde beendet. Bitte erneut anmelden.', 401);
  if (Date.parse(session.expiresAt || '') <= Date.now()) throw auth.error('SESSION_INVALID', 'Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.', 401);
  const team = auth.applyUserPolicy(teamDoc.value || auth.emptyTeam());
  const user = (team.users || []).find((candidate) => auth.text(candidate.id) === auth.text(session.userId) || auth.usernameOf(candidate) === auth.lower(session.username));
  if (!user || !auth.isActive(user)) throw auth.error('ACCOUNT_DISABLED', 'Das Benutzerkonto ist deaktiviert.', 403);
  if (Number(session.authVersion || 0) !== Number(user.authVersion || 0)) throw auth.error('SESSION_REVOKED', 'Die Sitzung wurde beendet. Bitte erneut anmelden.', 401);
  if ((session.mustChange || user.mustChange) && !options.allowPasswordChange) throw auth.error('PASSWORD_CHANGE_REQUIRED', 'Vor der Nutzung muss das Startpasswort geändert werden.', 403);
  return { token, session, user, team, source: resolved.source, authDoc, teamDoc };
}

module.exports = Object.assign({}, auth, { clients, validateSession });
