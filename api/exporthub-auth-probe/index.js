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
function header(req,name){
  const h=req&&req.headers||{};
  return h[name.toLowerCase()]||h[name]||'';
}
function hasExplicitSession(req){
  return Boolean(header(req,'x-exporthub-token')||header(req,'x-exporthub-session')||/(?:^|;\s*)eh_session=/.test(String(header(req,'cookie')||'')));
}

module.exports = async function (context, req) {
  if (req && req.method === 'OPTIONS') {
    context.res = { status: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
    return;
  }

  let authImpl=null;
  try { authImpl=require('../shared/auth-store'); } catch (_) {}

  const userPolicy = checkModule('user-policy', () => require('../shared/user-policy'));
  const storageBlob = checkModule('@azure/storage-blob', () => require('@azure/storage-blob'));
  const authStore = checkModule('auth-store', () => require('../shared/auth-store'));
  const authEndpoint = checkModule('exporthub-auth', () => require('../exporthub-auth/index.js'));
  const runtimeReady = Boolean(userPolicy.ok && storageBlob.ok && authStore.ok && authEndpoint.ok);

  const result = {
    ok: runtimeReady,
    version: 'RC1115',
    service: 'exporthub-auth',
    runtimeReady
  };

  if (hasExplicitSession(req) && authImpl) {
    try {
      const current=await authImpl.validateSession(req,{allowPasswordChange:true});
      if (authImpl.isAdmin(current.user)) {
        result.adminDiagnostics=true;
        result.runtime={
          node:process.version,
          platform:process.platform,
          arch:process.arch
        };
        result.configuration={
          storageConfigured:Boolean(process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage),
          initialAdminConfigured:Boolean(process.env.EXPORTHUB_INITIAL_ADMIN_PASSWORD),
          signingSecretConfigured:Boolean(process.env.EXPORTHUB_AUTH_SIGNING_SECRET||process.env.EXPORTHUB_SESSION_SECRET),
          sessionMaxHours:authImpl.SESSION_MAX_HOURS,
          sessionIdleMinutes:authImpl.SESSION_IDLE_MINUTES
        };
        result.modules={userPolicy,storageBlob,authStore,authEndpoint};
      }
    } catch (_) {
      // Der öffentliche Probe liefert absichtlich keine Auth- oder Konfigurationsdetails.
    }
  }

  context.res = {
    status: runtimeReady ? 200 : 503,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    },
    body: JSON.stringify(result)
  };
};
