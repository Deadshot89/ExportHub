'use strict';

const { isDeepStrictEqual } = require('node:util');
const { DOCUMENT_FIELDS } = require('./document-blob-store');

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

function isAdmin(user) {
  const role = text(user && (user.role || user.rolle));
  return Boolean(user && (
    user.globalAdmin === true ||
    user.isGlobalAdmin === true ||
    ['global admin','global administrator','globaler administrator','globaler admin','administrator','admin','vollzugriff'].includes(role) ||
    (Array.isArray(user.permissions) && user.permissions.includes('*'))
  ));
}

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

function assertKeyChangeAllowed(serverState, mergedState, user, key) {
  const before = serverState && serverState[key];
  const after = mergedState && mergedState[key];
  if (!changed(before, after)) return;

  const direct = DIRECT_RIGHTS[key];
  if (direct) {
    if (!canEditAny(user, direct)) forbidden(key, direct);
    return;
  }

  const domain = DOCUMENT_AWARE[key];
  if (!domain) return;
  if (canEditAny(user, domain)) return;
  if (documentOnlyChange(before, after) && canEditModule(user, 'documents')) return;
  forbidden(key, domain);
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

function assertMetadataAllowed(serverState, mergedState, incomingState, user) {
  const serverFields = serverState && serverState._teamSyncMeta && serverState._teamSyncMeta.fields || {};
  const incomingFields = incomingState && incomingState._teamSyncMeta && incomingState._teamSyncMeta.fields || {};

  for (const [key, stamp] of Object.entries(incomingFields)) {
    if (isDeepStrictEqual(serverFields[key], stamp)) continue;
    const modules = requiredModulesForKey(key);
    if (!modules) continue;

    if (DOCUMENT_AWARE[key]) {
      const before = serverState && serverState[key];
      const after = mergedState && mergedState[key];
      if (documentOnlyChange(before, after) && canEditModule(user, 'documents')) continue;
    }
    if (!canEditAny(user, modules)) forbidden(`_teamSyncMeta.fields.${key}`, modules);
  }

  for (const tombstone of newIncomingTombstones(serverState, incomingState)) {
    const collection = text(tombstone && tombstone.collection);
    const modules = DIRECT_RIGHTS[collection] || DOCUMENT_AWARE[collection];
    if (modules && !canEditAny(user, modules)) forbidden(`_teamSyncMeta.tombstones.${collection}`, modules);
  }
}

function assertMergedStateWriteAllowed(serverState, mergedState, incomingState, user) {
  if (!user || isAdmin(user)) return true;
  const server = serverState && typeof serverState === 'object' ? serverState : {};
  const merged = mergedState && typeof mergedState === 'object' ? mergedState : {};
  const incoming = incomingState && typeof incomingState === 'object' ? incomingState : {};

  for (const key of Object.keys(DIRECT_RIGHTS)) assertKeyChangeAllowed(server, merged, user, key);
  for (const key of Object.keys(DOCUMENT_AWARE)) assertKeyChangeAllowed(server, merged, user, key);
  assertMetadataAllowed(server, merged, incoming, user);
  return true;
}

module.exports = {
  DIRECT_RIGHTS,
  DOCUMENT_AWARE,
  canEditModule,
  canEditAny,
  stripDocumentFields,
  documentOnlyChange,
  assertMergedStateWriteAllowed
};
