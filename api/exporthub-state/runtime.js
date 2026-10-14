'use strict';

// RC1241: Keep state-storage compatibility aliases untouched while ensuring
// signed sessions use the exact same fallback source as auth-store.js.
function sessionSigningConnectionString() {
  return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || '';
}

const configured = String(process.env.EXPORTHUB_AUTH_SIGNING_SECRET || process.env.EXPORTHUB_SESSION_SECRET || '').trim();
const source=configured||sessionSigningConnectionString();
if(!configured&&source)process.env.EXPORTHUB_AUTH_SIGNING_SECRET=source;

// RC1490: Der große State-Kern bleibt unverändert. Nur für diesen Azure-Endpunkt
// werden Merge und isAdmin beim Laden gezielt abgesichert. Der Request-Kontext
// nutzt AsyncLocalStorage, damit parallele Benutzer niemals Rechte teilen.
const writeContext = require('../shared/state-write-context');
const secureMerge = require('../shared/secure-merge');
const basePolicy = require('../shared/user-policy');

function loadSecuredStateHandler() {
  const mergePath = require.resolve('../shared/merge');
  const policyPath = require.resolve('../shared/user-policy');
  const indexPath = require.resolve('./index');
  const mergeModule = require.cache[mergePath];
  const policyModule = require.cache[policyPath];
  const previousMergeExports = mergeModule && mergeModule.exports;
  const previousPolicyExports = policyModule && policyModule.exports;

  const securedPolicy = Object.assign({}, basePolicy, {
    isAdmin(user) {
      // RC1525: Der State-Kern validiert den Benutzer erneut direkt gegen den
      // gespeicherten Team-State. Repariere den bekannten Legacy-Export-Datensatz
      // deshalb in-place, bevor hasAnyEditRight und secureMerge ihn auswerten.
      // Die Mutation landet bei einem erfolgreichen State-Save in current.users
      // und macht die Migration durch rightsRepairVersion dauerhaft/einmalig.
      if (typeof basePolicy.repairLegacySevastianExportRights === 'function') {
        basePolicy.repairLegacySevastianExportRights(user);
      }
      writeContext.captureUser(user);
      return basePolicy.isAdmin(user);
    }
  });

  try {
    if (mergeModule) mergeModule.exports = secureMerge;
    if (policyModule) policyModule.exports = securedPolicy;
    delete require.cache[indexPath];
    return require('./index');
  } finally {
    if (mergeModule) mergeModule.exports = previousMergeExports;
    if (policyModule) policyModule.exports = previousPolicyExports;
  }
}

const stateHandler = loadSecuredStateHandler();

module.exports = function securedStateRuntime(context, req) {
  return writeContext.run(() => stateHandler(context, req));
};
