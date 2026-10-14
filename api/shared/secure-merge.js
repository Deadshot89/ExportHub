'use strict';

const base = require('./merge');
const writeContext = require('./state-write-context');
const writeGuard = require('./state-write-guard');

function mergeState(serverState, incomingState) {
  const user = writeContext.currentUser();
  const safeIncoming = user
    ? writeGuard.sanitizeUnmappedNoise(serverState, incomingState, user)
    : incomingState;
  const merged = base.mergeState(serverState, safeIncoming);
  if (user) writeGuard.assertMergedStateWriteAllowed(serverState, merged, safeIncoming, user);
  return merged;
}

module.exports = Object.assign({}, base, { mergeState });
