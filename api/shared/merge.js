'use strict';

const COLLECTION_KEYS = {
  shipments: ['id', 'ref'],
  tasks: ['id', '_syncId'],
  customers: ['id', 'account', 'customerNumber', 'kundennummer', 'customerNo', 'no', 'name'],
  abdRequests: ['id', 'ref'],
  palletAccount: ['id', '_syncId'],
  vacations: ['id', '_syncId'],
  ideas: ['id', '_syncId'],
  customSops: ['id', 'name', '_syncId'],
  sops: ['id', 'name', '_syncId'],
  users: ['id', 'user', 'login', 'username', 'name']
};

const LOCAL_ONLY_KEYS = new Set([
  'view', 'q', 'taskSearch', 'taskFilter', 'taskDay', 'shipmentOverviewSearch',
  'shipmentOverviewStatus', 'selectedCustomerId', 'shipment', 'activeShipmentId',
  'sopId', 'sopStep', 'academyId', 'academyStep', 'quizAnswers', 'quizStep',
  'language', 'rc438NotifySnoozeUntil', 'rc439SyncStatus',
  'rc524OverviewPage', 'rc524OverviewPageSize', 'rc524OverviewSearch'
]);

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function text(value) { return String(value == null ? '' : value).trim(); }
function lower(value) { return text(value).toLowerCase(); }
function isObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function norm(value) { return lower(value).replace(/\s+/g, ' ').replace(/[^a-z0-9äöüß|:_-]+/gi, ''); }

function itemKey(item, fields, fallbackIndex) {
  if (!item || typeof item !== 'object') return `index:${fallbackIndex}`;
  for (const field of fields || []) {
    const value = text(item[field]);
    if (value) return `${field}:${lower(value)}`;
  }
  return `index:${fallbackIndex}`;
}
function canonicalId(name, item, index) {
  const key = itemKey(item, COLLECTION_KEYS[name] || ['id', '_syncId'], index);
  return key.includes(':') ? key.slice(key.indexOf(':') + 1) : key;
}

function aliasValue(value) { return norm(value); }
function recordAliases(name, item, index) {
  if (!item || typeof item !== 'object') return [`index:${index}`];
  const aliases = [];
  const add = (prefix, value) => {
    const normalized = aliasValue(value);
    const key = normalized ? `${prefix}:${normalized}` : '';
    if (key && !aliases.includes(key)) aliases.push(key);
  };
  if (name === 'customers') {
    ['account', 'customerNumber', 'kundennummer', 'customerNo', 'no', 'number', 'debtorNumber'].forEach((field) => add('number', item[field]));
    ['id', 'customerId', '_syncId'].forEach((field) => add('id', item[field]));
    const namePart = aliasValue(item.name || item.customerName || item.deliveryName);
    if (namePart) {
      const country = aliasValue(item.country || item.land);
      const postal = aliasValue(item.postalCode || item.zip || item.plz);
      add('name', [namePart, country, postal].filter(Boolean).join('|'));
      add('nameonly', namePart);
    }
  } else {
    (COLLECTION_KEYS[name] || ['id', '_syncId']).forEach((field) => add(field, item[field]));
  }
  return aliases.length ? aliases : [`index:${index}`];
}
function aliasesOverlap(a, b) {
  if (!a.length || !b.length) return false;
  const set = new Set(a);
  const common = b.filter((value) => set.has(value));
  if (common.some((value) => /^(?:number|id):/.test(value))) return true;
  const aNumbers = a.filter((value) => value.startsWith('number:'));
  const bNumbers = b.filter((value) => value.startsWith('number:'));
  const aIds = a.filter((value) => value.startsWith('id:'));
  const bIds = b.filter((value) => value.startsWith('id:'));
  // Gleicher Name darf widersprüchliche Kundennummern oder IDs niemals überstimmen.
  if ((aNumbers.length && bNumbers.length) || (aIds.length && bIds.length)) return false;
  // Fallback für den Übergang interne ID <-> Kundennummer: nur bei identischem Namen/Adressschlüssel.
  return common.some((value) => value.startsWith('name:'));
}
function timestamp(value) {
  const candidates = [
    value && value._syncUpdatedAt, value && value.updatedAt, value && value.editedAt,
    value && value.modifiedAt, value && value.completedAt, value && value.savedAt,
    value && value.createdAt
  ];
  for (const candidate of candidates) {
    const time = Date.parse(candidate || '');
    if (Number.isFinite(time)) return time;
  }
  return 0;
}
function fieldTimestamp(value, field) {
  const raw = value && value._syncFields && value._syncFields[field];
  const time = Date.parse(isObject(raw) ? raw.updatedAt : raw || '');
  return Number.isFinite(time) ? time : 0;
}
function latestIso(a, b) {
  const ta = Date.parse(a || '') || 0;
  const tb = Date.parse(b || '') || 0;
  return ta >= tb ? (a || b || '') : (b || a || '');
}
function taskDone(item) {
  return Boolean(item && (item.done === true || /erledigt|done|completed|abgeschlossen/i.test(text(item.status))));
}
function equal(a, b) {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; }
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
function mergeRecordFields(serverItem, incomingItem, collectionName) {
  if (!serverItem) return clone(incomingItem);
  if (!incomingItem) return clone(serverItem);
  const out = {};
  const fields = new Set([...Object.keys(serverItem), ...Object.keys(incomingItem)]);
  fields.delete('_syncFields');
  const serverRecordTs = timestamp(serverItem);
  const incomingRecordTs = timestamp(incomingItem);
  const mergedFieldMeta = {};

  for (const field of fields) {
    const sv = serverItem[field];
    const iv = incomingItem[field];
    const st = fieldTimestamp(serverItem, field);
    const it = fieldTimestamp(incomingItem, field);
    if (it > st) out[field] = clone(iv);
    else if (st > it) out[field] = clone(sv);
    else if (it > 0 && st > 0) {
      if (isObject(sv) || isObject(iv)) out[field] = mergePlainObject(sv, iv);
      else out[field] = clone(iv !== undefined ? iv : sv);
    } else if (incomingRecordTs > serverRecordTs) out[field] = clone(iv !== undefined ? iv : sv);
    else if (serverRecordTs > incomingRecordTs) out[field] = clone(sv !== undefined ? sv : iv);
    else if (collectionName === 'tasks' && ['done', 'completed', 'status'].includes(field) && taskDone(serverItem) !== taskDone(incomingItem)) {
      out[field] = clone(taskDone(incomingItem) ? iv : sv);
    } else if (isObject(sv) || isObject(iv)) out[field] = mergePlainObject(sv, iv);
    else out[field] = clone(iv !== undefined ? iv : sv);

    const sMeta = serverItem._syncFields && serverItem._syncFields[field];
    const iMeta = incomingItem._syncFields && incomingItem._syncFields[field];
    if (it > st) mergedFieldMeta[field] = clone(iMeta);
    else if (st > it) mergedFieldMeta[field] = clone(sMeta);
    else if (iMeta || sMeta) mergedFieldMeta[field] = clone(iMeta || sMeta);
  }
  if (Object.keys(mergedFieldMeta).length) out._syncFields = mergedFieldMeta;
  out._syncUpdatedAt = latestIso(serverItem._syncUpdatedAt, incomingItem._syncUpdatedAt) || out._syncUpdatedAt;
  return out;
}

function normalizeTombstones(meta) {
  const list = meta && Array.isArray(meta.tombstones) ? meta.tombstones : [];
  const map = new Map();
  for (const tombstone of list) {
    if (!tombstone || !tombstone.collection || !tombstone.id) continue;
    const key = `${lower(tombstone.collection)}:${lower(tombstone.id)}`;
    const current = map.get(key);
    if (!current || (Date.parse(tombstone.deletedAt || '') || 0) >= (Date.parse(current.deletedAt || '') || 0)) map.set(key, clone(tombstone));
  }
  return Array.from(map.values());
}
function tombstoneMap(meta) {
  const map = new Map();
  for (const tombstone of normalizeTombstones(meta)) map.set(`${lower(tombstone.collection)}:${lower(tombstone.id)}`, tombstone);
  return map;
}
function tombstoneFor(name, item, index, tombstones) {
  const candidates = new Set();
  const keys = COLLECTION_KEYS[name] || ['id', '_syncId'];
  keys.forEach((field) => { if (text(item && item[field])) candidates.add(lower(item[field])); });
  candidates.add(lower(canonicalId(name, item, index)));
  for (const candidate of candidates) {
    const found = tombstones.get(`${lower(name)}:${candidate}`);
    if (found) return found;
  }
  return null;
}
function mergeCollection(name, serverList, incomingList, tombstones) {
  const records = [];
  const ingest = (list) => {
    (Array.isArray(list) ? list : []).forEach((item, sourceIndex) => {
      if (!item || typeof item !== 'object') return;
      const incomingAliases = recordAliases(name, item, sourceIndex);
      const matches = [];
      records.forEach((record, index) => {
        if (aliasesOverlap(recordAliases(name, record, index), incomingAliases)) matches.push(index);
      });
      if (!matches.length) {
        records.push(clone(item));
        return;
      }
      let merged = clone(records[matches[0]]);
      for (let i = matches.length - 1; i >= 1; i -= 1) {
        const index = matches[i];
        merged = mergeRecordFields(merged, records[index], name);
        records.splice(index, 1);
      }
      merged = mergeRecordFields(merged, item, name);
      records[matches[0]] = merged;
    });
  };
  ingest(serverList);
  ingest(incomingList);
  return records.filter((item, index) => {
    const tombstone = tombstoneFor(name, item, index, tombstones);
    return !(tombstone && (Date.parse(tombstone.deletedAt || '') || 0) >= timestamp(item));
  });
}

function materializeChangeSet(incomingState, changeSet) {
  if (!isObject(changeSet) || Number(changeSet.version || 0) < 1) return incomingState;
  const sparse = { _teamSyncMeta: { fields: {}, tombstones: [] } };
  const incomingMeta = isObject(incomingState && incomingState._teamSyncMeta) ? incomingState._teamSyncMeta : {};
  sparse._teamSyncMeta.tombstones = normalizeTombstones(incomingMeta);
  const stateFields = isObject(changeSet.stateFields) ? changeSet.stateFields : {};
  for (const [key, entry] of Object.entries(stateFields)) {
    if (isLocalOnlyKey(key) || !entry || !Object.prototype.hasOwnProperty.call(entry, 'value')) continue;
    sparse[key] = clone(entry.value);
    sparse._teamSyncMeta.fields[key] = {
      updatedAt: entry.updatedAt || changeSet.updatedAt || new Date(0).toISOString(),
      deviceId: entry.deviceId || changeSet.deviceId || ''
    };
  }
  const collections = isObject(changeSet.collections) ? changeSet.collections : {};
  for (const [name, patches] of Object.entries(collections)) {
    if (!Array.isArray(patches)) continue;
    sparse[name] = patches.map((patch) => {
      if (patch && patch.isNew && isObject(patch.full)) return clone(patch.full);
      const record = Object.assign({}, clone(patch && patch.identity || {}), clone(patch && patch.fields || {}));
      const meta = {};
      const fieldMeta = isObject(patch && patch.fieldMeta) ? patch.fieldMeta : {};
      Object.keys(patch && patch.fields || {}).forEach((field) => {
        const raw = fieldMeta[field];
        meta[field] = isObject(raw) ? clone(raw) : {
          updatedAt: patch.updatedAt || changeSet.updatedAt || new Date(0).toISOString(),
          deviceId: patch.deviceId || changeSet.deviceId || ''
        };
      });
      if (Object.keys(meta).length) record._syncFields = meta;
      record._syncUpdatedAt = patch.updatedAt || changeSet.updatedAt || record._syncUpdatedAt;
      return record;
    });
  }
  return sparse;
}

function materializeUserChanges(incomingUsers, changeSet) {
  if (!isObject(changeSet) || !Array.isArray(changeSet.users)) return incomingUsers;
  return changeSet.users.map((patch) => {
    if (patch && patch.isNew && isObject(patch.full)) return clone(patch.full);
    const record = Object.assign({}, clone(patch && patch.identity || {}), clone(patch && patch.fields || {}));
    const meta = {};
    const fieldMeta = isObject(patch && patch.fieldMeta) ? patch.fieldMeta : {};
    Object.keys(patch && patch.fields || {}).forEach((field) => {
      const raw = fieldMeta[field];
      meta[field] = isObject(raw) ? clone(raw) : {
        updatedAt: patch.updatedAt || changeSet.updatedAt || new Date(0).toISOString(),
        deviceId: patch.deviceId || changeSet.deviceId || ''
      };
    });
    if (Object.keys(meta).length) record._syncFields = meta;
    record._syncUpdatedAt = patch.updatedAt || changeSet.updatedAt || record._syncUpdatedAt;
    return record;
  });
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
  ingest(serverLedger); ingest(incomingLedger); return out;
}
function taskLedgerKeys(task, index) {
  const out = [];
  const add = (prefix, value) => { const v = norm(value); if (v && !out.includes(prefix + v)) out.push(prefix + v); };
  if (task) {
    add('id:', task.id); add('sync:', task._syncId);
    add('ship:', `${text(task.linkedShipmentId || task.linkedShipmentRef)}|${text(task.area)}`);
    add('biz:', [task.title || task.name, task.area, task.day, task.dueDate || task.date || task.targetDate, task.time, task.owner, task.linkedShipmentRef].join('|'));
  }
  if (!out.length) add('index:', index);
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
    return Object.assign({}, task, {
      status: done ? 'erledigt' : 'offen', done, completed: done,
      doneAt: done ? (record.doneAt || record.updatedAt || task.doneAt) : '',
      completedAt: done ? (record.doneAt || record.updatedAt || task.completedAt) : '',
      doneBy: done ? (record.doneBy || task.doneBy || '') : '',
      completedBy: done ? (record.doneBy || task.completedBy || '') : '',
      statusUpdatedAt: record.updatedAt || task.statusUpdatedAt,
      _syncUpdatedAt: latestIso(task._syncUpdatedAt, record.updatedAt)
    });
  });
}
function shipmentAliases(shipment) { return [shipment && shipment.id, shipment && shipment.ref].map(norm).filter(Boolean); }
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
function applyDocumentTombstones(shipments, tombstones) {
  const fields = ['podFiles', 'abdFiles', 'deliveryFiles', 'deliveryNotes', 'lieferscheine', 'documents', 'files', 'docs', 'attachments'];
  return (Array.isArray(shipments) ? shipments : []).map((shipment) => {
    const aliases = shipmentAliases(shipment);
    if (!aliases.length) return shipment;
    let changed = false;
    const next = clone(shipment);
    fields.forEach((field) => {
      if (!Array.isArray(next[field])) return;
      const filtered = next[field].filter((file, index) => {
        const fAliases = fileAliases(file, index);
        const hit = aliases.some((s) => fAliases.some((f) => {
          const variants = [
            `documents:${lower(`${s}|${field}|${f}`)}`,
            `documents:${lower(`${s}|${f}`)}`
          ];
          return variants.some((key) => tombstones.has(key));
        }));
        return !hit;
      });
      if (filtered.length !== next[field].length) { next[field] = filtered; changed = true; }
    });
    return changed ? next : shipment;
  });
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
function mergeState(serverState, incomingState, changeSet) {
  const server = isObject(serverState) ? clone(serverState) : {};
  const incomingFull = isObject(incomingState) ? clone(incomingState) : {};
  const incoming = materializeChangeSet(incomingFull, changeSet);
  const serverMeta = isObject(server._teamSyncMeta) ? server._teamSyncMeta : {};
  const incomingMeta = isObject(incoming._teamSyncMeta) ? incoming._teamSyncMeta : {};
  const mergedMeta = {
    fields: Object.assign({}, serverMeta.fields || {}, incomingMeta.fields || {}),
    tombstones: normalizeTombstones({ tombstones: [...(serverMeta.tombstones || []), ...(incomingMeta.tombstones || [])] })
  };
  const tombstones = tombstoneMap(mergedMeta);
  const out = {};
  const keys = new Set([...Object.keys(server), ...Object.keys(incoming)]);
  for (const key of keys) {
    if (key === '_teamSyncMeta' || isLocalOnlyKey(key)) continue;
    const sv = server[key], iv = incoming[key];
    if (Array.isArray(sv) || Array.isArray(iv)) { out[key] = mergeCollection(key, sv, iv, tombstones); continue; }
    const st = fieldTime(serverMeta, key), it = fieldTime(incomingMeta, key);
    if (it > st) out[key] = clone(iv);
    else if (st > it) out[key] = clone(sv);
    else if (isObject(sv) || isObject(iv)) out[key] = mergePlainObject(sv, iv);
    else out[key] = iv !== undefined ? clone(iv) : clone(sv);
  }
  out.taskStatusLedger = mergeLedger(server.taskStatusLedger, incoming.taskStatusLedger);
  out.deliveryFileDeletionLedger = mergeLedger(server.deliveryFileDeletionLedger, incoming.deliveryFileDeletionLedger);
  out.tasks = applyTaskLedger(out.tasks, out.taskStatusLedger);
  out.shipments = applyDeliveryFileLedger(out.shipments, out.deliveryFileDeletionLedger);
  out.shipments = applyDocumentTombstones(out.shipments, tombstones);
  out._teamSyncMeta = mergedMeta;
  return out;
}
function mergeUsers(serverUsers, incomingUsers, meta, changeSet) {
  return mergeCollection('users', serverUsers, materializeUserChanges(incomingUsers, changeSet), tombstoneMap(meta || {}));
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
  COLLECTION_KEYS, LOCAL_ONLY_KEYS, clone, text, lower, itemKey, canonicalId,
  timestamp, fieldTimestamp, mergeRecordFields, mergeCollection, mergeState,
  mergeUsers, sanitizeState, pruneTombstones, isLocalOnlyKey, normalizeTombstones,
  tombstoneMap, applyDocumentTombstones, recordAliases, materializeChangeSet, materializeUserChanges
};
