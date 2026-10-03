'use strict';

// RC1241: Keep state-storage compatibility aliases untouched while ensuring
// signed sessions use the exact same fallback source as auth-store.js.
function sessionSigningConnectionString() {
  return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || '';
}

const configured = String(process.env.EXPORTHUB_AUTH_SIGNING_SECRET || process.env.EXPORTHUB_SESSION_SECRET || '').trim();
const source=configured||sessionSigningConnectionString();
if(!configured&&source)process.env.EXPORTHUB_AUTH_SIGNING_SECRET=source;

module.exports = require('./index');
