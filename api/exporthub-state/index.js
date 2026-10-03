'use strict';

// RC1241: Signed sessions must derive their fallback secret from exactly the
// same configuration chain as api/shared/auth-store.js. Do not reuse the
// broader state-storage aliases here: state storage and session signing have
// separate compatibility requirements.
function sessionSigningConnectionString() {
  return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || '';
}

const configured = String(process.env.EXPORTHUB_AUTH_SIGNING_SECRET || process.env.EXPORTHUB_SESSION_SECRET || '').trim();
const source=configured||sessionSigningConnectionString();
if(!configured&&source)process.env.EXPORTHUB_AUTH_SIGNING_SECRET=source;

module.exports = require('./index-legacy');
