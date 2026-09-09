'use strict';

const auth = require('../shared/fast-auth-store');
const companies = require('../shared/company-context');
const store = require('../shared/fixed-pickup-store');

module.exports = async function(context, req){
  const method = String(req && req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') { context.res = auth.json(204, {}); return; }
  try {
    if (!['GET','POST','PATCH'].includes(method)) throw auth.error('METHOD_NOT_ALLOWED', 'Methode nicht erlaubt.', 405);
    const session = await auth.validateSession(req);
    const company = companies.resolveCompanyContext(req, session.user);
    const payload = auth.body(req);
    const environment = store.resolveEnvironment(req, payload);
    const admin = auth.isAdmin(session.user);
    if (method === 'GET') {
      const includeInactive = admin && String(req && req.query && req.query.includeInactive || '') === '1';
      const items = await store.list(environment, company.companyKey, { includeInactive });
      context.res = auth.json(200, {ok:true,items,canEdit:admin,environment,companyKey:company.companyKey});
      return;
    }
    if (!admin) throw auth.error('ADMIN_REQUIRED', 'Nur Administratoren dürfen fixe Abholungen ändern.', 403);
    const actor = session.user.name || session.user.user || session.user.login || 'Admin';
    if (method === 'POST') { const item = await store.create(environment, company.companyKey, payload, actor); context.res = auth.json(201, {ok:true,item}); return; }
    const id = String(payload.id || '').trim();
    if (!id) throw auth.error('FIX_ID_REQUIRED', 'FIX-ID fehlt.', 400);
    const item = await store.update(environment, company.companyKey, id, payload, actor);
    context.res = auth.json(200, {ok:true,item});
  } catch (e) {
    context.res = auth.json(e && (e.status || e.statusCode) || 500, {ok:false,code:e && e.code || 'FIXED_PICKUPS_FAILED',message:e && e.message || 'Fixe Abholungen konnten nicht verarbeitet werden.'});
  }
};
