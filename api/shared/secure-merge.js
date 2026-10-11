'use strict';

const base = require('./merge');
const writeContext = require('./state-write-context');
const writeGuard = require('./state-write-guard');

function mergeState(serverState, incomingState) {
  const merged = base.mergeState(serverState, incomingState);
  const user = writeContext.currentUser();
  if (user) writeGuard.assertMergedStateWriteAllowed(serverState, merged, incomingState, user);
  return merged;
}

module.exports = Object.assign({}, base, { mergeState });
