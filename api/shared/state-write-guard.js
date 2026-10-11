'use strict';

const { isDeepStrictEqual } = require('node:util');
const { DOCUMENT_FIELDS } = require('./document-blob-store');
const { mergeCollection, isLocalOnlyKey } = require('./merge');
const { isAdmin } = require('./user-policy');

const DOCUMENT_FIELD_SET = new Set(DOCUMENT_FIELDS || []);

const DIRECT_RIGHTS = Object.freeze({
  tasks: ['tasks'],
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
    // RC1490: mergeCollection normalisiert einzelne Collections (z. B. customerHistory/processStatus).
    // Nur bei einer real abweichenden Client-Collection wird deshalb gegen denselben normalisierten
    // Server-Baseline-Merge projiziert. Unveränderte große Collections werden nicht doppelt gemerged.
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
  stripDocumentFields,
  documentOnlyChange,
  effectiveKeyChange,
  assertMergedStateWriteAllowed
};
