'use strict';

const MODULES = [
  'start','dashboard','tasks','vacation','planning','shipment','abd','shipmentoverview',
  'cmr','documents','pallet','customers','customerfolder','calculator','customs','sop',
  'academy','ideas','notifications','reports','update','rights','teamfile','archive','settings'
];

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function text(value) { return String(value == null ? '' : value).trim(); }
function lower(value) { return text(value).toLowerCase(); }
function userName(user) { return lower(user && (user.user || user.login || user.username || user.name)); }
function isAdmin(user) {
  return Boolean(user && (
    user.globalAdmin === true ||
    /global.?admin|administrator|vollzugriff/i.test(text(user.role || user.rolle)) ||
    (Array.isArray(user.permissions) && user.permissions.includes('*'))
  ));
}
function defaultRights(admin) {
  const result = {};
  for (const id of MODULES) {
    const allow = admin || id === 'start' || id === 'dashboard';
    result[id] = {
      level: admin ? 'admin' : (allow ? 'view' : 'none'),
      visible: allow,
      read: allow,
      edit: admin,
      admin: admin,
      functionAdmin: admin
    };
  }
  result.rights = {
    level: admin ? 'admin' : 'none', visible: !!admin, read: !!admin,
    edit: !!admin, admin: !!admin, functionAdmin: !!admin
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
function normalizeRights(value, admin) {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};
  for (const id of MODULES) {
    const old = source[id] && typeof source[id] === 'object' ? source[id] : {};
    const fallback = admin ? 'admin' : ((id === 'start' || id === 'dashboard') ? 'view' : 'none');
    const level = admin ? 'admin' : normalizeLevel(old, fallback);
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
  source.id = text(source.id || source._syncId) || `USER-${login.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  source.user = login;
  source.login = login;
  source.username = login;
  source.name = text(source.name) || login;
  source.globalAdmin = admin;
  source.role = admin ? 'Globaler Administrator' : (text(source.role) || 'Benutzer');
  source.permissions = admin ? ['*'] : (Array.isArray(source.permissions) ? source.permissions.filter((x) => x !== '*') : []);
  source.rights = normalizeRights(source.rights, admin);
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
function applyUserPolicy(document) {
  const source = document && typeof document === 'object' ? clone(document) : {};
  source.state = source.state && typeof source.state === 'object' ? source.state : {};
  const topUsers = Array.isArray(source.users) ? source.users : [];
  const fallbackUsers = Array.isArray(source.state.users) ? source.state.users : [];
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
  countAdmins,
  defaultRights,
  publicUser
};
