'use strict';

function text(v){ return String(v == null ? '' : v).trim(); }
function key(v){
  return text(v).toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
function error(code, message, statusCode){
  const e = new Error(message);
  e.code = code;
  e.status = statusCode;
  e.statusCode = statusCode;
  return e;
}
function values(user){
  const raw = [user && user.companyId, user && user.companyKey, user && user.tenantId, user && user.tenant];
  for (const listName of ['companyIds','allowedCompanyIds']) {
    const list = user && user[listName];
    if (Array.isArray(list)) raw.push(...list);
  }
  if (Array.isArray(user && user.companies)) {
    for (const c of user.companies) raw.push(typeof c === 'string' ? c : c && (c.id || c.key || c.companyId));
  }
  return [...new Set(raw.map(key).filter(Boolean))];
}
function requested(req){
  const h = req && req.headers || {};
  const q = req && req.query || {};
  const b = req && req.body || {};
  return key(h['x-exporthub-company-id'] || h['X-ExportHUB-Company-Id'] || q.companyId || b.companyId);
}
function isGlobalAdmin(user){
  const role = text(user && (user.role || user.rolle)).toLowerCase();
  return Boolean(user && (
    user.globalAdmin === true ||
    role === 'admin' ||
    /global.?admin|administrator|vollzugriff/.test(role) ||
    (Array.isArray(user.permissions) && user.permissions.includes('*'))
  ));
}
function resolveCompanyContext(req, user){
  const allowed = values(user);
  const wanted = requested(req);
  const admin = isGlobalAdmin(user);
  if (!admin && wanted && allowed.length && !allowed.includes(wanted)) {
    throw error('COMPANY_FORBIDDEN', 'Kein Zugriff auf diese Firma.', 403);
  }
  if (!admin && wanted && !allowed.length && wanted !== 'legacy-default') {
    throw error('COMPANY_FORBIDDEN', 'Für dieses Benutzerkonto ist keine andere Firma freigegeben.', 403);
  }
  const companyKey = wanted || allowed[0] || 'legacy-default';
  return { companyKey, requestedCompanyKey: wanted, allowedCompanyKeys: allowed };
}

module.exports = { text, key, values, requested, resolveCompanyContext, isGlobalAdmin };
