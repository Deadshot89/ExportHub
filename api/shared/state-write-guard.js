'use strict';

const { isDeepStrictEqual } = require('node:util');
const { DOCUMENT_FIELDS } = require('./document-blob-store');
const { mergeCollection, isLocalOnlyKey } = require('./merge');
const { isAdmin } = require('./user-policy');

const DOCUMENT_FIELD_SET = new Set(DOCUMENT_FIELDS || []);

const DIRECT_RIGHTS = Object.freeze({
  tasks: ['tasks'],
  taskSeries: ['tasks'],
  taskTemplates: ['tasks'],
  taskCalendar: ['tasks'],
  taskSettings: ['tasks'],
  taskArchive: ['tasks'],
  taskMigrationMeta: ['tasks'],
  taskWeek: ['tasks'],
  taskMasterRC848: ['tasks'],
  taskMasterSourceVersion: ['tasks'],
  taskMasterUpdatedAt: ['tasks'],
  taskStatusLedger: ['tasks'],
  customers: ['customers'],
  customerNotes: ['customers', 'customerfolder'],
  palletBookings: ['pallet'],
  palletAccount: ['pallet'],
  palletSettlements: ['pallet'],
  vacations: ['vacation'],
  ideas: ['ideas'],
  customSops: ['sop'],
  isoSops: ['sop'],
  settings: ['settings'],
  auditLog: ['history'],
  deliveryFileDeletionLedger: ['documents'],
  packNotifications: ['tasks'],
  packSessions: ['tasks'],
  packStations: ['tasks']
});

const DOCUMENT_AWARE = Object.freeze({
  shipments: ['shipment'],
  savedShipments: ['shipment'],
  salesSharedShipments: ['shipment'],
  sharedShipments: ['shipment'],
  shipmentArchive: ['shipment', 'archive'],
  archivedShipments: ['shipment', 'archive'],
  archive: ['shipment', 'archive'],
  abdRequests: ['abd']
});

const REGISTRATION_AUDIT_COLLECTIONS = new Set([
  'shipments',
  'savedShipments',
  'salesSharedShipments',
  'sharedShipments'
]);
const REGISTRATION_START_LABELS = new Set([
  'versandanmeldung per e-mail gestartet',
  'versandanmeldung gestartet'
]);
const REGISTRATION_SENT_LABEL = 'versandanmeldung versendet';

function text(value) { return String(value == null ? '' : value).trim().toLowerCase(); }
function rawText(value) { return String(value == null ? '' : value).trim(); }
function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function hasOwn(value, key) { return !!value && Object.prototype.hasOwnProperty.call(value, key); }

function canEditModule(user, moduleId) {
  if (isAdmin(user)) return true;
  const right = user && user.rights && user.rights[moduleId];
  if (!right || typeof right !== 'object') return false;
  const level = text(right.level || right.access);
  return right.edit === true || right.admin === true || right.functionAdmin === true || level === 'edit' || level === 'admin';
}

function canEditAny(user, modules) {
  return isAdmin(user) || (modules || []).some((moduleId) => canEditModule(user, moduleId));
}

function canReadModule(user, moduleId) {
  if (isAdmin(user)) return true;
  const right = user && user.rights && user.rights[moduleId];
  if (!right || typeof right !== 'object') return false;
  const level = text(right.level || right.access);
  return right.read === true || right.visible === true || right.edit === true || right.admin === true || right.functionAdmin === true || ['view', 'read', 'edit', 'admin'].includes(level);
}

function canReadAny(user, modules) {
  return isAdmin(user) || (modules || []).some((moduleId) => canReadModule(user, moduleId));
}

function stripDocumentFields(value) {
  if (Array.isArray(value)) return value.map(stripDocumentFields);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (DOCUMENT_FIELD_SET.has(key)) continue;
    out[key] = stripDocumentFields(child);
  }
  return out;
}

function changed(before, after) {
  return !isDeepStrictEqual(before, after);
}

function documentOnlyChange(before, after) {
  return changed(before, after) && !changed(stripDocumentFields(before), stripDocumentFields(after));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = stableValue(value[key]);
  return out;
}

function historySignature(event) {
  if (!isObject(event)) return JSON.stringify(stableValue(event));
  const copy = Object.assign({}, event);
  delete copy.id;
  delete copy.version;
  delete copy.source;
  return JSON.stringify(stableValue(copy));
}

function userIdValues(user) {
  return new Set([
    user && user.id,
    user && user.userId,
    user && user.user,
    user && user.login,
    user && user.username
  ].map(text).filter(Boolean));
}

function userNameValues(user) {
  return new Set([
    user && user.name,
    user && user.displayName,
    user && user.fullName,
    user && user.user,
    user && user.login,
    user && user.username
  ].map(text).filter(Boolean));
}

function registrationEventBelongsToUser(event, user) {
  if (!isObject(event) || !isObject(event.actor)) return false;
  const actorId = text(event.actor.id);
  const actorName = text(event.actor.name);
  if (actorId) return userIdValues(user).has(actorId);
  return Boolean(actorName && (userNameValues(user).has(actorName) || userIdValues(user).has(actorName)));
}

function isRegistrationAuditEvent(event, user) {
  if (!isObject(event) || !registrationEventBelongsToUser(event, user)) return false;
  const type = text(event.type);
  const label = text(event.label || event.action);
  if (type === 'registration') return REGISTRATION_START_LABELS.has(label);
  if (type !== 'mail-sent' || label !== REGISTRATION_SENT_LABEL) return false;
  const mailType = text(event.details && event.details.mailType);
  return mailType === 'versandanmeldung' || mailType === 'registration';
}

function shipmentIdentity(item, index) {
  if (!isObject(item)) return `index:${index}`;
  const fields = ['id', 'shipmentId', 'ref', 'reference', 'referenceNumber', 'shipmentRef', 'sendungsreferenz'];
  for (const field of fields) {
    const value = text(item[field]);
    if (value) return `${field}:${value}`;
  }
  return `index:${index}`;
}

function shipmentWithoutHistory(item) {
  if (!isObject(item)) return item;
  const out = Object.assign({}, item);
  delete out.shipmentHistory;
  return out;
}

function registrationHistoryAppendOnly(beforeHistory, afterHistory, user) {
  const before = Array.isArray(beforeHistory) ? beforeHistory : [];
  const after = Array.isArray(afterHistory) ? afterHistory : [];
  if (after.length <= before.length) return false;

  const remaining = new Map();
  for (const event of before) {
    const signature = historySignature(event);
    remaining.set(signature, (remaining.get(signature) || 0) + 1);
  }

  const added = [];
  for (const event of after) {
    const signature = historySignature(event);
    const count = remaining.get(signature) || 0;
    if (count > 0) {
      if (count === 1) remaining.delete(signature);
      else remaining.set(signature, count - 1);
      continue;
    }
    added.push(event);
  }

  if (remaining.size > 0 || added.length === 0) return false;
  return added.every((event) => isRegistrationAuditEvent(event, user));
}

function registrationAuditOnlyChange(before, after, user) {
  const serverList = Array.isArray(before) ? before : [];
  const incomingList = Array.isArray(after) ? after : [];
  if (serverList.length !== incomingList.length || serverList.length === 0) return false;

  const serverMap = new Map(serverList.map((item, index) => [shipmentIdentity(item, index), item]));
  const incomingMap = new Map(incomingList.map((item, index) => [shipmentIdentity(item, index), item]));
  if (serverMap.size !== serverList.length || incomingMap.size !== incomingList.length || serverMap.size !== incomingMap.size) return false;

  let audited = false;
  for (const [identity, serverItem] of serverMap.entries()) {
    const incomingItem = incomingMap.get(identity);
    if (!incomingItem) return false;
    if (!isDeepStrictEqual(shipmentWithoutHistory(serverItem), shipmentWithoutHistory(incomingItem))) return false;
    const serverHistory = serverItem && serverItem.shipmentHistory;
    const incomingHistory = incomingItem && incomingItem.shipmentHistory;
    if (isDeepStrictEqual(serverHistory, incomingHistory)) continue;
    if (!registrationHistoryAppendOnly(serverHistory, incomingHistory, user)) return false;
    audited = true;
  }
  return audited;
}

function canWriteRegistrationAudit(user, key, before, after) {
  return REGISTRATION_AUDIT_COLLECTIONS.has(key)
    && canReadAny(user, ['shipment', 'shipmentoverview'])
    && registrationAuditOnlyChange(before, after, user);
}

function fieldTime(state, key) {
  const fields = state && state._teamSyncMeta && isObject(state._teamSyncMeta.fields)
    ? state._teamSyncMeta.fields : {};
  const value = fields[key];
  const stamp = value && typeof value === 'object' ? value.updatedAt : value;
  const parsed = Date.parse(stamp || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeObjectProjection(serverValue, incomingValue) {
  if (!isObject(serverValue)) return incomingValue;
  if (!isObject(incomingValue)) return serverValue;
  const out = Object.assign({}, serverValue);
  for (const [key, value] of Object.entries(incomingValue)) {
    out[key] = isObject(value) && isObject(out[key])
      ? mergeObjectProjection(out[key], value)
      : value;
  }
  return out;
}

function effectiveKeyChange(serverState, incomingState, key) {
  const server = serverState && typeof serverState === 'object' ? serverState : {};
  const incoming = incomingState && typeof incomingState === 'object' ? incomingState : {};
  const serverValue = server[key];
  if (!hasOwn(incoming, key)) return { changed: false, before: serverValue, after: serverValue };
  const incomingValue = incoming[key];
  if (isDeepStrictEqual(serverValue, incomingValue)) return { changed: false, before: serverValue, after: serverValue };

  if (Array.isArray(serverValue) || Array.isArray(incomingValue)) {
    const tombstones = new Map();
    const before = mergeCollection(key, serverValue, serverValue, tombstones);
    const after = mergeCollection(key, serverValue, incomingValue, tombstones);
    return { changed: changed(before, after), before, after };
  }

  const serverTs = fieldTime(server, key);
  const incomingTs = fieldTime(incoming, key);
  let after;
  if (incomingTs > serverTs) after = incomingValue;
  else if (serverTs > incomingTs) after = serverValue;
  else if (isObject(serverValue) || isObject(incomingValue)) after = mergeObjectProjection(serverValue, incomingValue);
  else after = incomingValue !== undefined ? incomingValue : serverValue;
  return { changed: changed(serverValue, after), before: serverValue, after };
}

function forbidden(key, modules) {
  const error = new Error('api.state.writeForbidden');
  error.code = 'STATE_MODULE_WRITE_FORBIDDEN';
  error.status = 403;
  error.vars = { key, modules: (modules || []).join(',') };
  throw error;
}

function requiredModulesForKey(key) {
  return DIRECT_RIGHTS[key] || DOCUMENT_AWARE[key] || null;
}

function keyChangeAllowed(serverState, incomingState, user, key) {
  const effect = effectiveKeyChange(serverState, incomingState, key);
  if (!effect.changed) return false;
  const direct = DIRECT_RIGHTS[key];
  if (direct) return canEditAny(user, direct);
  const domain = DOCUMENT_AWARE[key];
  if (!domain) return false;
  if (canEditAny(user, domain)) return true;
  if (canWriteRegistrationAudit(user, key, effect.before, effect.after)) return true;
  return documentOnlyChange(effect.before, effect.after) && canEditModule(user, 'documents');
}

function hasAuthorizedMappedChange(serverState, incomingState, user) {
  for (const key of Object.keys(DIRECT_RIGHTS)) {
    if (keyChangeAllowed(serverState, incomingState, user, key)) return true;
  }
  for (const key of Object.keys(DOCUMENT_AWARE)) {
    if (keyChangeAllowed(serverState, incomingState, user, key)) return true;
  }
  return false;
}

function sanitizeUnmappedNoise(serverState, incomingState, user) {
  if (!user || isAdmin(user) || !isObject(incomingState)) return incomingState;
  if (!hasAuthorizedMappedChange(serverState, incomingState, user)) return incomingState;

  const server = isObject(serverState) ? serverState : {};
  const incoming = incomingState;
  const out = Object.assign({}, incoming);

  for (const key of Object.keys(incoming)) {
    if (key === '_teamSyncMeta' || isLocalOnlyKey(key) || requiredModulesForKey(key)) continue;
    if (effectiveKeyChange(server, incoming, key).changed) delete out[key];
  }

  if (isObject(incoming._teamSyncMeta)) {
    const serverMeta = isObject(server._teamSyncMeta) ? server._teamSyncMeta : {};
    const serverFields = isObject(serverMeta.fields) ? serverMeta.fields : {};
    const incomingFields = isObject(incoming._teamSyncMeta.fields) ? incoming._teamSyncMeta.fields : {};
    const fields = {};
    for (const [key, stamp] of Object.entries(incomingFields)) {
      if (isLocalOnlyKey(key)) continue;
      if (!requiredModulesForKey(key)) {
        if (isDeepStrictEqual(serverFields[key], stamp)) continue;
        continue;
      }
      fields[key] = stamp;
    }

    const serverTombstones = Array.isArray(serverMeta.tombstones) ? serverMeta.tombstones : [];
    const knownServerTombstones = new Set(serverTombstones.map(tombstoneIdentity));
    const tombstones = (Array.isArray(incoming._teamSyncMeta.tombstones) ? incoming._teamSyncMeta.tombstones : []).filter((item) => {
      if (knownServerTombstones.has(tombstoneIdentity(item))) return true;
      const collection = rawText(item && item.collection);
      return Boolean(collection && (isLocalOnlyKey(collection) || requiredModulesForKey(collection)));
    });

    out._teamSyncMeta = Object.assign({}, incoming._teamSyncMeta, { fields, tombstones });
  }

  return out;
}

function assertKeyChangeAllowed(serverState, incomingState, user, key) {
  const effect = effectiveKeyChange(serverState, incomingState, key);
  if (!effect.changed) return;

  const direct = DIRECT_RIGHTS[key];
  if (direct) {
    if (!canEditAny(user, direct)) forbidden(key, direct);
    return;
  }

  const domain = DOCUMENT_AWARE[key];
  if (!domain) return;
  if (canEditAny(user, domain)) return;
  if (canWriteRegistrationAudit(user, key, effect.before, effect.after)) return;
  if (documentOnlyChange(effect.before, effect.after) && canEditModule(user, 'documents')) return;
  forbidden(key, domain);
}

function assertUnmappedIncomingKeysAllowed(serverState, incomingState) {
  const incoming = incomingState && typeof incomingState === 'object' ? incomingState : {};
  for (const key of Object.keys(incoming)) {
    if (key === '_teamSyncMeta' || isLocalOnlyKey(key) || requiredModulesForKey(key)) continue;
    const effect = effectiveKeyChange(serverState, incoming, key);
    if (effect.changed) forbidden(key, []);
  }
}

function tombstoneIdentity(item) {
  if (!item || typeof item !== 'object') return '';
  return JSON.stringify(item);
}

function newIncomingTombstones(serverState, incomingState) {
  const server = serverState && serverState._teamSyncMeta && Array.isArray(serverState._teamSyncMeta.tombstones)
    ? serverState._teamSyncMeta.tombstones : [];
  const incoming = incomingState && incomingState._teamSyncMeta && Array.isArray(incomingState._teamSyncMeta.tombstones)
    ? incomingState._teamSyncMeta.tombstones : [];
  const existing = new Set(server.map(tombstoneIdentity));
  return incoming.filter((item) => !existing.has(tombstoneIdentity(item)));
}

function assertMetadataAllowed(serverState, incomingState, user) {
  const serverFields = serverState && serverState._teamSyncMeta && serverState._teamSyncMeta.fields || {};
  const incomingFields = incomingState && incomingState._teamSyncMeta && incomingState._teamSyncMeta.fields || {};

  for (const [key, stamp] of Object.entries(incomingFields)) {
    if (isDeepStrictEqual(serverFields[key], stamp) || isLocalOnlyKey(key)) continue;
    const modules = requiredModulesForKey(key);
    if (!modules) forbidden(`_teamSyncMeta.fields.${key}`, []);

    if (DOCUMENT_AWARE[key]) {
      const effect = effectiveKeyChange(serverState, incomingState, key);
      if (effect.changed && canWriteRegistrationAudit(user, key, effect.before, effect.after)) continue;
      if (effect.changed && documentOnlyChange(effect.before, effect.after) && canEditModule(user, 'documents')) continue;
    }
    if (!canEditAny(user, modules)) forbidden(`_teamSyncMeta.fields.${key}`, modules);
  }

  for (const tombstone of newIncomingTombstones(serverState, incomingState)) {
    const collection = rawText(tombstone && tombstone.collection);
    if (collection && isLocalOnlyKey(collection)) continue;
    const modules = requiredModulesForKey(collection);
    if (!modules) forbidden(`_teamSyncMeta.tombstones.${collection || 'unknown'}`, []);
    if (!canEditAny(user, modules)) forbidden(`_teamSyncMeta.tombstones.${collection}`, modules);
  }
}

function assertMergedStateWriteAllowed(serverState, mergedState, incomingState, user) {
  if (!user || isAdmin(user)) return true;
  const server = serverState && typeof serverState === 'object' ? serverState : {};
  const incoming = incomingState && typeof incomingState === 'object' ? incomingState : {};

  assertUnmappedIncomingKeysAllowed(server, incoming);
  for (const key of Object.keys(DIRECT_RIGHTS)) assertKeyChangeAllowed(server, incoming, user, key);
  for (const key of Object.keys(DOCUMENT_AWARE)) assertKeyChangeAllowed(server, incoming, user, key);
  assertMetadataAllowed(server, incoming, user);
  return true;
}

module.exports = {
  DIRECT_RIGHTS,
  DOCUMENT_AWARE,
  canEditModule,
  canEditAny,
  canReadModule,
  canReadAny,
  stripDocumentFields,
  documentOnlyChange,
  registrationAuditOnlyChange,
  effectiveKeyChange,
  sanitizeUnmappedNoise,
  assertMergedStateWriteAllowed
};
