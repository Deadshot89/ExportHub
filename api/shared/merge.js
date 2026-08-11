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

function taskDone(item) {
  return Boolean(item && (item.done === true || /erledigt|done|completed|abgeschlossen/i.test(text(item.status))));
}


function norm(value) {
  return lower(value).replace(/\s+/g, ' ').replace(/[^a-z0-9äöüß|:_-]+/gi, '');
}

function taskLedgerKeys(task, index) {
  const out = [];
  const add = (prefix, value) => {
    const v = norm(value);
    if (v && !out.includes(prefix + v)) out.push(prefix + v);
  };
  if (task) {
    add('id:', task.id);
    add('sync:', task._syncId);
    add('ship:', `${text(task.linkedShipmentId || task.linkedShipmentRef)}|${text(task.area)}`);
    add('biz:', [task.title || task.name, task.area, task.day, task.dueDate || task.date || task.targetDate, task.time, task.owner, task.linkedShipmentRef].join('|'));
  }
  if (!out.length) add('index:', index);
  return out;
}

function mergeLedger(serverLedger, incomingLedger) {
  const out = {};
  const ingest = (source) => {
    if (!isObject(source)) return;
    for (const [key, value] of Object.entries(source)) {
      if (!isObject(value)) continue;
      const current = out[key];
      const currentTs = Date.parse(current && current.updatedAt || '') || 0;
      const incomingTs = Date.parse(value.updatedAt || '') || 0;
      if (!current || incomingTs >= currentTs) out[key] = clone(value);
    }
  };
  ingest(serverLedger);
  ingest(incomingLedger);
  return out;
}

function applyTaskLedger(tasks, ledger) {
  if (!Array.isArray(tasks) || !isObject(ledger)) return tasks;
  return tasks.map((task, index) => {
    let record = null;
    for (const key of taskLedgerKeys(task, index)) {
      const candidate = ledger[key];
      if (!candidate) continue;
      if (!record || (Date.parse(candidate.updatedAt || '') || 0) >= (Date.parse(record.updatedAt || '') || 0)) record = candidate;
    }
    if (!record) return task;
    const done = record.status === 'erledigt' || record.done === true;
    const next = Object.assign({}, task, {
      status: done ? 'erledigt' : 'offen',
      done,
      statusUpdatedAt: record.updatedAt || task.statusUpdatedAt,
      _syncUpdatedAt: record.updatedAt || task._syncUpdatedAt
    });
    if (done) {
      next.doneAt = record.doneAt || record.updatedAt || next.doneAt;
      next.completedAt = next.doneAt;
      next.doneBy = record.doneBy || next.doneBy || '';
      next.completedBy = next.doneBy;
    } else {
      next.doneAt = '';
      next.completedAt = '';
      next.doneBy = '';
      next.completedBy = '';
    }
    return next;
  });
}

function shipmentAliases(shipment) {
  return [shipment && shipment.id, shipment && shipment.ref].map(norm).filter(Boolean);
}

function fileAliases(file, index) {
  const out = [file && file.id, file && file.remoteId, file && file.name, file && file.fileName].map(norm).filter(Boolean);
  return out.length ? Array.from(new Set(out)) : [norm(index)];
}

function applyDeliveryFileLedger(shipments, ledger) {
  if (!Array.isArray(shipments) || !isObject(ledger)) return shipments;
  return shipments.map((shipment) => {
    const aliases = shipmentAliases(shipment);
    if (!aliases.length || !Array.isArray(shipment.deliveryFiles)) return shipment;
    const files = shipment.deliveryFiles.filter((file, index) => {
      const fAliases = fileAliases(file, index);
      return !aliases.some((s) => fAliases.some((f) => ledger[`${s}|${f}`]));
    });
    return files.length === shipment.deliveryFiles.length ? shipment : Object.assign({}, shipment, { deliveryFiles: files });
  });
}

function chooseNewer(serverItem, incomingItem, collectionName) {
  const serverTs = timestamp(serverItem);
  const incomingTs = timestamp(incomingItem);
  if (incomingTs > serverTs) return clone(incomingItem);
  if (serverTs > incomingTs) return clone(serverItem);
  if (collectionName === 'tasks' && taskDone(serverItem) !== taskDone(incomingItem)) {
    return taskDone(incomingItem) ? clone(incomingItem) : clone(serverItem);
  }
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
      else map.set(key, source === 'incoming' ? chooseNewer(existing, item, name) : chooseNewer(item, existing, name));
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


  out.taskStatusLedger = mergeLedger(server.taskStatusLedger, incoming.taskStatusLedger);
  out.deliveryFileDeletionLedger = mergeLedger(server.deliveryFileDeletionLedger, incoming.deliveryFileDeletionLedger);
  out.tasks = applyTaskLedger(out.tasks, out.taskStatusLedger);
  out.shipments = applyDeliveryFileLedger(out.shipments, out.deliveryFileDeletionLedger);

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
