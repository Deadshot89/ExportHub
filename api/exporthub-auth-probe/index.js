'use strict';

function checkModule(name, loader) {
  try {
    const value = loader();
    return {
      ok: true,
      type: typeof value,
      exports: value && typeof value === 'object' ? Object.keys(value).slice(0, 40) : []
    };
  } catch (e) {
    return {
      ok: false,
      code: String(e && e.code || e && e.name || 'MODULE_LOAD_FAILED'),
      message: String(e && e.message || 'Unbekannter Modulfehler').slice(0, 500)
    };
  }
}

module.exports = async function (context, req) {
  if (req && req.method === 'OPTIONS') {
    context.res = { status: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
    return;
  }

  const userPolicy = checkModule('user-policy', () => require('../shared/user-policy'));
  const storageBlob = checkModule('@azure/storage-blob', () => require('@azure/storage-blob'));
  const authStore = checkModule('auth-store', () => require('../shared/auth-store'));
  const authEndpoint = checkModule('exporthub-auth', () => require('../exporthub-auth/index.js'));

  const result = {
    ok: true,
    version: 'RC880',
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
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
