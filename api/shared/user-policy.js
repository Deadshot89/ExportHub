'use strict';
const MODULES = [
  'start','dashboard','tasks','vacation','planning','shipment','abd','shipmentoverview',
  'cmr','documents','pallet','customers','customerfolder','calculator','customs','sop',
  'academy','ideas','notifications','reports','update','rights','teamfile','archive','settings','pickupcalendar'
];

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function text(value) { return String(value == null ? '' : value).trim(); }
function lower(value) { return text(value).toLowerCase(); }
function userName(user) { return lower(user && (user.user || user.login || user.username || user.name)); }

function isAdmin(user) {
  const role = lower(user && (user.role || user.rolle));
  const globalRole = role === 'admin' || /global.?admin|administrator|vollzugriff/i.test(role);
  return Boolean(user && (
    user.globalAdmin === true ||
    globalRole ||
    (Array.isArray(user.permissions) && user.permissions.includes('*'))
  ));
}

function isCompanyAdmin(user) {
  const role = lower(user && (user.role || user.rolle));
  return Boolean(user && (
    user.companyAdmin === true ||
    /company[\s/_-]*(?:admin|administrator)/.test(role) ||
    /firmen[\s/_-]*(?:admin|administrator)/.test(role) ||
    /(?:^|[\s/_-])hse(?:$|[\s/_-])/.test(role) ||
    /sicherheits[\s/_-]*verantwortlich/.test(role)
  ));
}

function defaultRights(admin, companyAdmin = false) {
  const result = {};
  for (const id of MODULES) {
    const baseAllow = id === 'start' || id === 'dashboard' || id === 'pickupcalendar';
    const level = admin ? 'admin' : (companyAdmin ? (id === 'update' ? 'none' : 'admin') : (baseAllow ? 'view' : 'none'));
    const allow = level !== 'none';
    result[id] = {
      level,
      visible: allow,
      read: allow,
      edit: level === 'edit' || level === 'admin',
      admin: level === 'admin',
      functionAdmin: level === 'admin'
    };
  }
  const companyManager = admin || companyAdmin;
  result.rights = {
    level: companyManager ? 'admin' : 'none', visible: companyManager, read: companyManager,
    edit: companyManager, admin: companyManager, functionAdmin: companyManager
  };
  return result;
}

function normalizeLevel(old, fallback) {
  const raw = lower(old && (old.level || old.access));
  if (['none','view','edit','admin'].includes(raw)) return raw;
  if (old && (old.admin === true || old.functionAdmin === true)) return 'admin';
  if (old && old.edit === true) return 'edit';
  if (old && (old.read === true || old.visible === true)) return 'view';
  return fallback;
}

function normalizeRights(value, admin, companyAdmin = false) {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};
  for (const id of MODULES) {
    const old = source[id] && typeof source[id] === 'object' ? source[id] : {};
    const fallback = admin ? 'admin' : (companyAdmin ? (id === 'update' ? 'none' : 'admin') : ((id === 'start' || id === 'dashboard' || id === 'pickupcalendar') ? 'view' : 'none'));
    const level = admin ? 'admin' : (companyAdmin ? fallback : normalizeLevel(old, fallback));
    result[id] = {
      level,
      visible: level !== 'none',
      read: level !== 'none',
      edit: level === 'edit' || level === 'admin',
      admin: level === 'admin',
      functionAdmin: level === 'admin'
    };
  }
  return result;
}

function normalizeUser(user, index) {
  const source = user && typeof user === 'object' ? clone(user) : {};
  const login = text(source.user || source.login || source.username || source.name) || `Benutzer${index + 1}`;
  const admin = isAdmin(source);
  const companyAdmin = !admin && isCompanyAdmin(source);
  source.id = text(source.id || source._syncId) || `USER-${login.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  source.user = login;
  source.login = login;
  source.username = login;
  source.name = text(source.name) || login;
  source.globalAdmin = admin;
  source.companyAdmin = companyAdmin;
  source.role = admin ? 'Globaler Administrator' : (text(source.role) || (companyAdmin ? 'Firmen-Admin' : 'Benutzer'));
  source.permissions = admin ? ['*'] : (Array.isArray(source.permissions) ? source.permissions.filter((x) => x !== '*') : []);
  source.rights = normalizeRights(source.rights, admin, companyAdmin);
  source.active = source.active !== false && source.disabled !== true && source.status !== 'Deaktiviert';
  source.disabled = !source.active;
  source.authVersion = Number(source.authVersion || 0);
  source.loginSecurity = source.loginSecurity && typeof source.loginSecurity === 'object' ? source.loginSecurity : { failedAttempts: 0, stage: 'first', lockedUntil: null, permanentLocked: false };
  return source;
}

function dedupeUsers(users) {
  const map = new Map();
  (Array.isArray(users) ? users : []).forEach((user, index) => {
    const normalized = normalizeUser(user, index);
    const key = userName(normalized);
    if (!key) return;
    const current = map.get(key);
    const currentTs = Date.parse(current && (current.updatedAt || current._syncUpdatedAt) || '') || 0;
    const nextTs = Date.parse(normalized.updatedAt || normalized._syncUpdatedAt || '') || 0;
    if (!current || nextTs >= currentTs) map.set(key, normalized);
  });
  return Array.from(map.values());
}

function ensureInitialAdmin(users) {
  if (users.length) return users;
  return [normalizeUser({
    id: 'USER-Tobias', user: 'Tobias', name: 'Tobias',
    role: 'Globaler Administrator', globalAdmin: true, permissions: ['*'],
    rights: defaultRights(true), mustChange: true, authSetupRequired: true,
    active: true, createdAt: new Date().toISOString()
  }, 0)];
}

function publicUser(user, adminView = false) {
  const u = normalizeUser(user || {}, 0);
  const out = {
    id: u.id,
    user: u.user,
    login: u.login,
    username: u.username,
    name: u.name,
    role: u.role,
    globalAdmin: u.globalAdmin === true,
    companyAdmin: u.companyAdmin === true,
    permissions: clone(u.permissions || []),
    rights: clone(u.rights || {}),
    active: u.active !== false,
    disabled: u.disabled === true,
    mustChange: u.mustChange === true,
    createdAt: u.createdAt || null,
    updatedAt: u.updatedAt || u._syncUpdatedAt || null
  };
  if (adminView) {
    out.loginSecurity = clone(u.loginSecurity || {});
    out.passwordChangedAt = u.passwordChangedAt || null;
    out.authVersion = Number(u.authVersion || 0);
  }
  return out;
}

// RC879: Nur der kleine Benutzerbereich wird normalisiert. Der große state-Block
// wird nicht mehr per JSON.stringify/parse vollständig dupliziert. Bei großen
// Teamständen (inkl. POD-/Dokumentdaten) reduziert das die Speicher-Spitzen des
// Auth- und State-Backends deutlich, ohne Daten zu entfernen oder umzuschreiben.
function applyUserPolicy(document) {
  const input = document && typeof document === 'object' ? document : {};
  const source = Object.assign({}, input);
  const inputState = input.state && typeof input.state === 'object' ? input.state : {};
  source.state = Object.assign({}, inputState);
  const topUsers = Array.isArray(input.users) ? input.users : [];
  const fallbackUsers = Array.isArray(inputState.users) ? inputState.users : [];
  const users = ensureInitialAdmin(dedupeUsers(topUsers.length ? topUsers : fallbackUsers));
  source.users = clone(users);
  source.state.users = users.map((u) => publicUser(u, false));
  return source;
}

function countAdmins(users) {
  return (Array.isArray(users) ? users : []).filter((u) => isAdmin(u) && u.active !== false && u.disabled !== true).length;
}

module.exports = {
  MODULES,
  applyUserPolicy,
  normalizeUser,
  normalizeRights,
  dedupeUsers,
  isAdmin,
  isCompanyAdmin,
  countAdmins,
  defaultRights,
  publicUser
};
