'use strict';

const MODULES = [
  'start','dashboard','tasks','vacation','shipment','abd','shipmentoverview',
  'cmr','pallet','customers','customerfolder','calculator','customs','sop',
  'academy','quiz','ideas','update','rights','teamfile','archive'
];

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
function text(value) { return String(value == null ? '' : value).trim(); }
function lower(value) { return text(value).toLowerCase(); }
function userName(user) { return lower(user && (user.user || user.login || user.username || user.name)); }
function isAdmin(user) {
  return Boolean(user && (
    /administrator|admin|vollzugriff/i.test(text(user.role || user.rolle)) ||
    (Array.isArray(user.permissions) && user.permissions.includes('*'))
  ));
}
function defaultRights(admin) {
  const result = {};
  for (const id of MODULES) {
    const allow = admin || id === 'start' || id === 'dashboard';
    result[id] = { visible: allow, read: allow, edit: admin };
  }
  result.rights = { visible: !!admin, read: !!admin, edit: !!admin };
  return result;
}
function normalizeRights(value, admin) {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};
  for (const id of MODULES) {
    const old = source[id] && typeof source[id] === 'object' ? source[id] : {};
    const preset = defaultRights(admin)[id];
    const hasExplicit = Object.prototype.hasOwnProperty.call(source, id);
    result[id] = {
      visible: admin ? true : (hasExplicit ? (old.visible === true || old.read === true || old.edit === true) : preset.visible === true),
      read: admin ? true : (hasExplicit ? (old.read === true || old.edit === true) : preset.read === true),
      edit: admin ? true : (hasExplicit ? old.edit === true : preset.edit === true)
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
  source.role = admin ? 'Administrator' : (text(source.role) || 'Benutzer');
  source.permissions = admin ? ['*'] : (Array.isArray(source.permissions) ? source.permissions.filter((x) => x !== '*') : []);
  source.rights = normalizeRights(source.rights, admin);
  return source;
}
function dedupeUsers(users) {
  const map = new Map();
  (Array.isArray(users) ? users : []).forEach((user, index) => {
    const normalized = normalizeUser(user, index);
    const key = userName(normalized);
    if (!key) return;
    const current = map.get(key);
    const currentTs = Date.parse(current && current._syncUpdatedAt || '') || 0;
    const nextTs = Date.parse(normalized._syncUpdatedAt || '') || 0;
    if (!current || nextTs >= currentTs) map.set(key, normalized);
  });
  return Array.from(map.values());
}
function ensureInitialAdmin(users) {
  if (users.length) return users;
  return [normalizeUser({
    id: 'USER-Tobias', user: 'Tobias', name: 'Tobias', password: 'Essentra',
    role: 'Administrator', permissions: ['*'], rights: defaultRights(true), mustChange: false
  }, 0)];
}
function applyUserPolicy(document) {
  const source = document && typeof document === 'object' ? clone(document) : {};
  source.state = source.state && typeof source.state === 'object' ? source.state : {};
  const candidates = [
    ...(Array.isArray(source.users) ? source.users : []),
    ...(Array.isArray(source.state.users) ? source.state.users : [])
  ];
  const users = ensureInitialAdmin(dedupeUsers(candidates));
  source.users = clone(users);
  source.state.users = clone(users);
  return source;
}
function countAdmins(users) {
  return (Array.isArray(users) ? users : []).filter(isAdmin).length;
}

module.exports = {
  MODULES,
  applyUserPolicy,
  normalizeUser,
  dedupeUsers,
  isAdmin,
  countAdmins,
  defaultRights
};
