'use strict';

const { isDeepStrictEqual } = require('node:util');
const base = require('./merge');
const writeContext = require('./state-write-context');
const writeGuard = require('./state-write-guard');
const { isAdmin } = require('./user-policy');

function text(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function hasOwn(value, key) {
  return !!value && Object.prototype.hasOwnProperty.call(value, key);
}

function progressIdentity(item, index) {
  return base.itemKey(item, base.COLLECTION_KEYS.sopLearningProgress, index);
}

function progressMap(list) {
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    map.set(progressIdentity(item, index), item);
  });
  return map;
}

function userProgressIds(user) {
  return new Set([
    user && user.id,
    user && user.userId,
    user && user.user,
    user && user.login,
    user && user.username
  ].map(text).filter(Boolean));
}

function progressBelongsToUser(item, user) {
  if (!item || typeof item !== 'object') return false;
  const owner = text(item.userId);
  return Boolean(owner && userProgressIds(user).has(owner));
}

function forbiddenProgressWrite() {
  const error = new Error('api.state.writeForbidden');
  error.code = 'STATE_MODULE_WRITE_FORBIDDEN';
  error.status = 403;
  error.vars = { key: 'sopLearningProgress', modules: 'sop:self' };
  throw error;
}

function hasAuthorizedOwnProgressChange(serverState, incomingState, user) {
  if (!user || isAdmin(user) || !hasOwn(incomingState, 'sopLearningProgress')) return false;

  const serverList = Array.isArray(serverState && serverState.sopLearningProgress)
    ? serverState.sopLearningProgress : [];
  const incomingList = Array.isArray(incomingState && incomingState.sopLearningProgress)
    ? incomingState.sopLearningProgress : [];
  const before = base.mergeCollection('sopLearningProgress', serverList, serverList, new Map());
  const after = base.mergeCollection('sopLearningProgress', serverList, incomingList, new Map());

  if (isDeepStrictEqual(before, after)) return false;
  if (!writeGuard.canReadModule(user, 'sop')) forbiddenProgressWrite();

  const beforeMap = progressMap(before);
  const afterMap = progressMap(after);
  const identities = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  let changed = false;

  for (const identity of identities) {
    const previous = beforeMap.get(identity);
    const next = afterMap.get(identity);
    if (isDeepStrictEqual(previous, next)) continue;
    changed = true;
    if (previous && !progressBelongsToUser(previous, user)) forbiddenProgressWrite();
    if (next && !progressBelongsToUser(next, user)) forbiddenProgressWrite();
  }

  return changed;
}

function maskOwnProgressForGuard(serverState, incomingState, user) {
  const incoming = incomingState && typeof incomingState === 'object' ? incomingState : {};
  const allowed = hasAuthorizedOwnProgressChange(serverState, incoming, user);
  if (!allowed) return { incoming, allowed: false };

  const server = serverState && typeof serverState === 'object' ? serverState : {};
  const masked = Object.assign({}, incoming, {
    sopLearningProgress: Array.isArray(server.sopLearningProgress) ? server.sopLearningProgress : []
  });

  if (incoming._teamSyncMeta && typeof incoming._teamSyncMeta === 'object') {
    const serverMeta = server._teamSyncMeta && typeof server._teamSyncMeta === 'object'
      ? server._teamSyncMeta : {};
    const incomingFields = incoming._teamSyncMeta.fields && typeof incoming._teamSyncMeta.fields === 'object'
      ? incoming._teamSyncMeta.fields : {};
    const fields = Object.assign({}, incomingFields);
    const serverFields = serverMeta.fields && typeof serverMeta.fields === 'object'
      ? serverMeta.fields : {};

    if (hasOwn(fields, 'sopLearningProgress')) {
      if (hasOwn(serverFields, 'sopLearningProgress')) fields.sopLearningProgress = serverFields.sopLearningProgress;
      else delete fields.sopLearningProgress;
    }

    masked._teamSyncMeta = Object.assign({}, incoming._teamSyncMeta, { fields });
  }

  return { incoming: masked, allowed: true };
}

function restoreOwnProgress(safeIncoming, originalIncoming) {
  const safe = safeIncoming && typeof safeIncoming === 'object' ? safeIncoming : {};
  const original = originalIncoming && typeof originalIncoming === 'object' ? originalIncoming : {};
  const restored = Object.assign({}, safe, {
    sopLearningProgress: original.sopLearningProgress
  });

  const originalMeta = original._teamSyncMeta && typeof original._teamSyncMeta === 'object'
    ? original._teamSyncMeta : null;
  const originalFields = originalMeta && originalMeta.fields && typeof originalMeta.fields === 'object'
    ? originalMeta.fields : null;

  if (originalFields && hasOwn(originalFields, 'sopLearningProgress')) {
    const safeMeta = safe._teamSyncMeta && typeof safe._teamSyncMeta === 'object'
      ? safe._teamSyncMeta : {};
    const safeFields = safeMeta.fields && typeof safeMeta.fields === 'object'
      ? safeMeta.fields : {};
    restored._teamSyncMeta = Object.assign({}, safeMeta, {
      fields: Object.assign({}, safeFields, {
        sopLearningProgress: originalFields.sopLearningProgress
      })
    });
  }

  return restored;
}

function mergeState(serverState, incomingState) {
  const user = writeContext.currentUser();
  const progress = user
    ? maskOwnProgressForGuard(serverState, incomingState, user)
    : { incoming: incomingState, allowed: false };
  const safeIncoming = user
    ? writeGuard.sanitizeUnmappedNoise(serverState, progress.incoming, user)
    : progress.incoming;
  const guardMerged = base.mergeState(serverState, safeIncoming);
  if (user) writeGuard.assertMergedStateWriteAllowed(serverState, guardMerged, safeIncoming, user);
  if (!progress.allowed) return guardMerged;

  const finalIncoming = restoreOwnProgress(safeIncoming, incomingState);
  return base.mergeState(serverState, finalIncoming);
}

module.exports = Object.assign({}, base, { mergeState });
