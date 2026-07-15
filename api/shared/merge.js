'use strict';

const COLLECTION_KEYS = {
  shipments: ['id', 'ref'],
  tasks: ['id'],
  customers: ['id', 'account', 'customerNumber', 'name'],
  abdRequests: ['id', 'ref'],
  palletAccount: ['id', '_syncId'],
  vacations: ['id', '_syncId'],
  ideas: ['id', '_syncId'],
  customSops: ['id', 'name', '_syncId'],
  users: ['id', 'user', 'login', 'username', 'name']
};

const LOCAL_ONLY_KEYS = new Set([
  'view', 'q', 'taskSearch', 'taskFilter', 'taskDay', 'shipmentOverviewSearch',
  'shipmentOverviewStatus', 'selectedCustomerId', 'shipment', 'activeShipmentId',
  'sopId', 'sopStep', 'academyId', 'academyStep', 'quizAnswers', 'quizStep',
  'language', 'rc438NotifySnoozeUntil', 'rc439SyncStatus'
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value == null ? '' : value).trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function itemKey(item, fields, fallbackIndex) {
  if (!item || typeof item !== 'object') return `index:${fallbackIndex}`;
  for (const field of fields || []) {
    const value = text(item[field]);
    if (value) return `${field}:${lower(value)}`;
  }
  return `index:${fallbackIndex}`;
}

function timestamp(value) {
  const candidates = [
    value && value._syncUpdatedAt,
    value && value.updatedAt,
    value && value.editedAt,
    value && value.modifiedAt,
    value && value.completedAt,
    value && value.savedAt,
    value && value.createdAt
  ];
  for (const candidate of candidates) {
    const time = Date.parse(candidate || '');
    if (Number.isFinite(time)) return time;
  }
  return 0;
}

function chooseNewer(serverItem, incomingItem) {
  const serverTs = timestamp(serverItem);
  const incomingTs = timestamp(incomingItem);
  if (incomingTs > serverTs) return clone(incomingItem);
  if (serverTs > incomingTs) return clone(serverItem);
  return Object.assign({}, clone(serverItem) || {}, clone(incomingItem) || {});
}

function normalizeTombstones(meta) {
  const list = meta && Array.isArray(meta.tombstones) ? meta.tombstones : [];
  const map = new Map();
  for (const tombstone of list) {
    if (!tombstone || !tombstone.collection || !tombstone.id) continue;
    const key = `${tombstone.collection}:${lower(tombstone.id)}`;
    const current = map.get(key);
    if (!current || Date.parse(tombstone.deletedAt || '') >= Date.parse(current.deletedAt || '')) {
      map.set(key, clone(tombstone));
    }
  }
  return Array.from(map.values());
}

function tombstoneMap(meta) {
  const map = new Map();
  for (const tombstone of normalizeTombstones(meta)) {
    map.set(`${tombstone.collection}:${lower(tombstone.id)}`, tombstone);
  }
  return map;
}

function mergeCollection(name, serverList, incomingList, tombstones) {
  const keys = COLLECTION_KEYS[name] || ['id', '_syncId'];
  const map = new Map();
  const ingest = (list, source) => {
    (Array.isArray(list) ? list : []).forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const key = itemKey(item, keys, index);
      const existing = map.get(key);
      if (!existing) map.set(key, clone(item));
      else map.set(key, source === 'incoming' ? chooseNewer(existing, item) : chooseNewer(item, existing));
    });
  };
  ingest(serverList, 'server');
  ingest(incomingList, 'incoming');

  const out = [];
  for (const [key, item] of map.entries()) {
    const rawId = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key;
    const tombstone = tombstones.get(`${name}:${lower(rawId)}`);
    if (tombstone && Date.parse(tombstone.deletedAt || '') >= timestamp(item)) continue;
    out.push(item);
  }
  return out;
}

function isLocalOnlyKey(key) {
  if (LOCAL_ONLY_KEYS.has(key)) return true;
  return /(?:Search|Filter|Selected|Step|Snooze|Modal|View|Tab|Page|Sort)$/i.test(key) ||
    /^rc\d+(?:Overview|Search|Filter|Edit|Selected|Notify|Ui|Open|Tab|Page|Sort)/i.test(key);
}

function fieldTime(meta, key) {
  const value = meta && meta.fields && meta.fields[key];
  const time = Date.parse(value && value.updatedAt ? value.updatedAt : value || '');
  return Number.isFinite(time) ? time : 0;
}

function mergePlainObject(serverValue, incomingValue) {
  if (!isObject(serverValue)) return clone(incomingValue);
  if (!isObject(incomingValue)) return clone(serverValue);
  const out = clone(serverValue);
  for (const [key, value] of Object.entries(incomingValue)) {
    if (isObject(value) && isObject(out[key])) out[key] = mergePlainObject(out[key], value);
    else out[key] = clone(value);
  }
  return out;
}

function mergeState(serverState, incomingState) {
  const server = isObject(serverState) ? clone(serverState) : {};
  const incoming = isObject(incomingState) ? clone(incomingState) : {};
  const serverMeta = isObject(server._teamSyncMeta) ? server._teamSyncMeta : {};
  const incomingMeta = isObject(incoming._teamSyncMeta) ? incoming._teamSyncMeta : {};
  const mergedMeta = {
    fields: Object.assign({}, serverMeta.fields || {}, incomingMeta.fields || {}),
    tombstones: normalizeTombstones({ tombstones: [
      ...(serverMeta.tombstones || []),
      ...(incomingMeta.tombstones || [])
    ] })
  };
  const tombstones = tombstoneMap(mergedMeta);
  const out = {};
  const keys = new Set([...Object.keys(server), ...Object.keys(incoming)]);

  for (const key of keys) {
    if (key === '_teamSyncMeta' || isLocalOnlyKey(key)) continue;
    const serverValue = server[key];
    const incomingValue = incoming[key];

    if (Array.isArray(serverValue) || Array.isArray(incomingValue)) {
      out[key] = mergeCollection(key, serverValue, incomingValue, tombstones);
      continue;
    }

    const serverTs = fieldTime(serverMeta, key);
    const incomingTs = fieldTime(incomingMeta, key);
    if (incomingTs > serverTs) out[key] = clone(incomingValue);
    else if (serverTs > incomingTs) out[key] = clone(serverValue);
    else if (isObject(serverValue) || isObject(incomingValue)) out[key] = mergePlainObject(serverValue, incomingValue);
    else out[key] = incomingValue !== undefined ? clone(incomingValue) : clone(serverValue);
  }

  out._teamSyncMeta = mergedMeta;
  return out;
}

function mergeUsers(serverUsers, incomingUsers, meta) {
  return mergeCollection('users', serverUsers, incomingUsers, tombstoneMap(meta || {}));
}

function sanitizeState(state) {
  const source = isObject(state) ? state : {};
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (isLocalOnlyKey(key)) continue;
    out[key] = clone(value);
  }
  if (!isObject(out._teamSyncMeta)) out._teamSyncMeta = { fields: {}, tombstones: [] };
  out._teamSyncMeta.tombstones = normalizeTombstones(out._teamSyncMeta);
  return out;
}

function pruneTombstones(state, maxAgeDays = 365) {
  if (!state || !state._teamSyncMeta) return state;
  const cutoff = Date.now() - maxAgeDays * 86400000;
  state._teamSyncMeta.tombstones = normalizeTombstones(state._teamSyncMeta).filter((item) => {
    const time = Date.parse(item.deletedAt || '');
    return !Number.isFinite(time) || time >= cutoff;
  });
  return state;
}

module.exports = {
  COLLECTION_KEYS,
  clone,
  itemKey,
  timestamp,
  mergeCollection,
  mergeState,
  mergeUsers,
  sanitizeState,
  pruneTombstones,
  isLocalOnlyKey
};
