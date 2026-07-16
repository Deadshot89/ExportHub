'use strict';

const MODULES = [
  'start','dashboard','tasks','vacation','shipment','abd','shipmentoverview',
  'cmr','pallet','customers','customerfolder','calculator','customs','sop',
  'academy','quiz','ideas','update','rights','teamfile','archive'
];

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value == null ? '' : value).trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function userName(user) {
  return lower(user && (user.user || user.login || user.username || user.name));
}

function findUser(list, name) {
  const wanted = lower(name);
  return (Array.isArray(list) ? list : []).find((item) => userName(item) === wanted) || {};
}

function rights(admin) {
  const result = {};
  for (const id of MODULES) {
    const allow = admin || id !== 'rights';
    result[id] = { visible: allow, read: allow, edit: allow };
  }
  result.rights = { visible: !!admin, read: !!admin, edit: !!admin };
  return result;
}

function preserveSync(target, old) {
  for (const key of ['_syncId', '_syncUpdatedAt', '_syncDeviceId', '_syncKey']) {
    if (old && old[key] != null) target[key] = old[key];
  }
  return target;
}

function authoritativeUsers(existingUsers) {
  const existing = Array.isArray(existingUsers) ? existingUsers : [];
  const tobias = findUser(existing, 'Tobias');
  const test = findUser(existing, 'Test');
  const sevastian = findUser(existing, 'Sevastian');

  return [
    preserveSync({
      id: text(tobias.id) || 'USER-Tobias',
      user: 'Tobias', login: 'Tobias', username: 'Tobias', name: 'Tobias',
      password: text(tobias.password) || 'Essentra',
      role: 'Administrator', permissions: ['*'], mustChange: false,
      rights: rights(true)
    }, tobias),
    preserveSync({
      id: text(test.id) || 'USER-Test',
      user: 'Test', login: 'Test', username: 'Test', name: 'Test',
      password: '123456',
      role: 'Benutzer', permissions: [], mustChange: false,
      rights: rights(false)
    }, test),
    preserveSync({
      id: text(sevastian.id) || 'USER-Sevastian',
      user: 'Sevastian', login: 'Sevastian', username: 'Sevastian', name: 'Sevastian',
      password: 'Essentra',
      role: 'Benutzer', permissions: [], mustChange: false,
      rights: rights(false)
    }, sevastian)
  ];
}



function normalizedOwner(value) {
  return lower(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

function isSevastianTask(task) {
  const owner = normalizedOwner(task && task.owner);
  const effective = normalizedOwner(task && task.eowner);
  return ['sevastian','sebastian','sevastion','sevastain'].includes(owner) ||
    ['sevastian','sebastian','sevastion','sevastain'].includes(effective) ||
    !!(task && (task.rc187RestoredSevastian || task.rc86RestoredSevastian));
}

function applyTaskPolicy(state) {
  const source = state && typeof state === 'object' ? state : {};
  if (Array.isArray(source.tasks)) source.tasks = source.tasks.filter((task) => !isSevastianTask(task));
  if (normalizedOwner(source.taskFilter) === 'sevastian') source.taskFilter = 'Alle Aufgaben anzeigen';
  return source;
}

function applyUserPolicy(document) {
  const source = document && typeof document === 'object' ? clone(document) : {};
  const candidates = [
    ...(Array.isArray(source.users) ? source.users : []),
    ...(source.state && Array.isArray(source.state.users) ? source.state.users : [])
  ];
  const users = authoritativeUsers(candidates);
  source.users = clone(users);
  source.state = source.state && typeof source.state === 'object' ? source.state : {};
  source.state = applyTaskPolicy(source.state);
  source.state.users = clone(users);
  return source;
}

module.exports = { MODULES, authoritativeUsers, applyUserPolicy, applyTaskPolicy, isSevastianTask };
