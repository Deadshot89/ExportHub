'use strict';

const auth = require('../shared/auth-store');
const fastAuth = require('../shared/fast-auth-store');
const companies = require('../shared/company-context');
const store = require('../shared/fixed-pickup-store');
const userPolicy = require('../shared/user-policy');

async function validateSession(req){
  if (fastAuth && typeof fastAuth.isSource === 'function' && fastAuth.isSource(auth)) return fastAuth.validateSession(req);
  return auth.validateSession(req);
}

function calendarAccess(user){
  if (auth.isAdmin(user)) return { level:'admin', canRead:true, canEdit:true };
  const rights = userPolicy.normalizeRights(user && user.rights, false);
  const level = String(rights && rights.pickupcalendar && rights.pickupcalendar.level || 'none').toLowerCase();
  return {
    level,
    canRead: level === 'view' || level === 'edit' || level === 'admin',
    canEdit: level === 'edit' || level === 'admin'
  };
}

module.exports = async function(context, req){
  const method = String(req && req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') { context.res = auth.json(204, {}); return; }
  try {
    if (!['GET','POST','PATCH'].includes(method)) throw auth.error('METHOD_NOT_ALLOWED', 'Methode nicht erlaubt.', 405);
    const session = await validateSession(req);
    const company = companies.resolveCompanyContext(req, session.user);
    const payload = auth.body(req);
    const environment = store.resolveEnvironment(req, payload);
    const access = calendarAccess(session.user);
    if (!access.canRead) throw auth.error('CALENDAR_READ_REQUIRED', 'Keine Berechtigung für den Abholkalender.', 403);
    if (method === 'GET') {
      const includeInactive = access.canEdit && String(req && req.query && req.query.includeInactive || '') === '1';
      const items = await store.list(environment, company.companyKey, { includeInactive });
      context.res = auth.json(200, {ok:true,items,canEdit:access.canEdit,calendarAccess:access.level,environment,companyKey:company.companyKey});
      return;
    }
    if (!access.canEdit) throw auth.error('ADMIN_REQUIRED', 'Für fixe Abholungen ist das Recht Abholkalender – Bearbeiten oder Admin erforderlich.', 403);
    const actor = session.user.name || session.user.user || session.user.login || 'Benutzer';
    if (method === 'POST') { const item = await store.create(environment, company.companyKey, payload, actor); context.res = auth.json(201, {ok:true,item}); return; }
    const id = String(payload.id || '').trim();
    if (!id) throw auth.error('FIX_ID_REQUIRED', 'FIX-ID fehlt.', 400);
    const item = await store.update(environment, company.companyKey, id, payload, actor);
    context.res = auth.json(200, {ok:true,item});
  } catch (e) {
    context.res = auth.json(e && (e.status || e.statusCode) || 500, {ok:false,code:e && e.code || 'FIXED_PICKUPS_FAILED',message:e && e.message || 'Fixe Abholungen konnten nicht verarbeitet werden.'});
  }
};