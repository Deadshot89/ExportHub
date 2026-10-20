'use strict';

// Public, unauthenticated probe: report only ok/code per module. Export names, error messages
// (which can contain server file paths) and exact runtime details stay in the function log.
function checkModule(name, loader, context) {
  try {
    loader();
    return { ok: true };
  } catch (e) {
    try { context && context.log && context.log.error && context.log.error('auth-probe module failed', name, e && e.code, e && e.message); } catch (_) {}
    return {
      ok: false,
      code: String(e && e.code || e && e.name || 'MODULE_LOAD_FAILED').replace(/[^A-Z0-9_]/gi, '').slice(0, 60) || 'MODULE_LOAD_FAILED'
    };
  }
}

module.exports = async function (context, req) {
  if (req && req.method === 'OPTIONS') {
    context.res = { status: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
    return;
  }

  const userPolicy = checkModule('user-policy', () => require('../shared/user-policy'), context);
  const storageBlob = checkModule('@azure/storage-blob', () => require('@azure/storage-blob'), context);
  const authStore = checkModule('auth-store', () => require('../shared/auth-store'), context);
  const authEndpoint = checkModule('exporthub-auth', () => require('../exporthub-auth/index.js'), context);

  const result = {
    ok: true,
    version: 'RC880',
    runtime: {
      nodeMajor: Number(String(process.versions && process.versions.node || '').split('.')[0]) || null
    },
    configuration: {
      storageConfigured: Boolean(process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage),
      initialAdminConfigured: Boolean(process.env.EXPORTHUB_INITIAL_ADMIN_PASSWORD),
      signingSecretConfigured: Boolean(process.env.EXPORTHUB_AUTH_SIGNING_SECRET || process.env.EXPORTHUB_SESSION_SECRET)
    },
    modules: {
      userPolicy,
      storageBlob,
      authStore,
      authEndpoint
    }
  };

  result.runtimeReady = Boolean(userPolicy.ok && storageBlob.ok && authStore.ok && authEndpoint.ok);
  context.res = {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(result)
  };
};
