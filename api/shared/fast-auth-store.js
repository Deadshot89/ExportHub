'use strict';

const auth = require('../shared/auth-store');
const apiI18n = require('./i18n');
let clientsPromise = null;
let sessionDocumentsPromise = null;
// Only the TESTSERVICE request path uses the ETag-verified team read cache.
// The shared production login/session blob is always fetched afresh.
let testserviceDocumentsPromise = null;
let verifiedTestserviceTeam = null;

async function clients(){
  if (!clientsPromise) {
    clientsPromise = auth.clients().catch((error) => {
      clientsPromise = null;
      throw error;
    });
  }
  return clientsPromise;
}

// Only the comparatively small user records are copied. Never share mutable
// authorization records between API requests; the large shipment payload remains
// untouched to avoid a second 60-MB clone on every valid session.
function isolateTeamUsers(doc){
  if(!doc || !doc.value || typeof doc.value!=='object')return doc;
  const value=doc.value,state=value.state && typeof value.state==='object'?value.state:null;
  return {...doc,value:{
    ...value,
    users:Array.isArray(value.users)?structuredClone(value.users):value.users,
    ...(state?{state:{...state,users:Array.isArray(state.users)?structuredClone(state.users):state.users}}:{})
  }};
}

async function readVerifiedTestserviceTeam(c){
  const cache=verifiedTestserviceTeam;
  if(cache && cache.blob===c.team && cache.etag && typeof c.team.getProperties==='function'){
    try{
      const props=await c.team.getProperties();
      if(props && props.etag && String(props.etag)===cache.etag)return isolateTeamUsers(cache.document);
    }catch(_){
      // HEAD may be unavailable during a transient incident: read the real
      // full document, never assume a cached user's rights are still current.
    }
  }
  const doc=await auth.readJson(c.team,auth.emptyTeam());
  // No ETag = no safe reuse. Every future attempt falls back to full read.
  verifiedTestserviceTeam=(doc && doc.etag && typeof c.team.getProperties==='function')
    ? {blob:c.team,etag:String(doc.etag),document:isolateTeamUsers(doc)}
    : null;
  return doc;
}

function readSessionDocuments(c,verifiedTestservice=false){
  if(verifiedTestservice){
    if(!testserviceDocumentsPromise){
      testserviceDocumentsPromise=Promise.all([
        auth.readJson(c.auth,auth.emptyAuth()),
        readVerifiedTestserviceTeam(c)
      ]).then(([authDoc,teamDoc])=>({authDoc,teamDoc})).finally(()=>{
        testserviceDocumentsPromise=null;
      });
    }
    return testserviceDocumentsPromise;
  }
  if(!sessionDocumentsPromise){
    sessionDocumentsPromise=Promise.all([
      auth.readJson(c.auth,auth.emptyAuth()),
      auth.readJson(c.team,auth.emptyTeam())
    ]).then(([authDoc,teamDoc])=>({authDoc,teamDoc})).finally(()=>{
      sessionDocumentsPromise=null;
    });
  }
  return sessionDocumentsPromise;
}

function supportsFastPath(){
  return typeof auth.bearer === 'function' &&
    typeof auth.clients === 'function' &&
    typeof auth.readJson === 'function' &&
    typeof auth.emptyAuth === 'function' &&
    typeof auth.emptyTeam === 'function' &&
    typeof auth.resolveSession === 'function' &&
    typeof auth.applyUserPolicy === 'function' &&
    typeof auth.usernameOf === 'function' &&
    typeof auth.isActive === 'function';
}
function isSource(candidate){ return candidate === auth; }
function isSignedTestserviceE2E(token){
  if (typeof auth.verifySignedSessionToken !== 'function') return false;
  const signed = auth.verifySignedSessionToken(token);
  return Boolean(
    signed &&
    auth.lower(signed.environment) === 'testservice' &&
    /^E2E-USER-/.test(auth.text(signed.uid)) &&
    /^e2e\./.test(auth.lower(signed.username))
  );
}

async function validateSession(req, options = {}){
  if (!supportsFastPath()) return auth.validateSession(req, options);
  const token = auth.bearer(req);
  if (!token) throw auth.error('AUTH_REQUIRED', apiI18n.t(req,'api.common.authRequired'), 401);
  if (isSignedTestserviceE2E(token)) return auth.validateSession(req, options);
  const testserviceRequest=typeof auth.environmentFromRequest==='function' &&
    auth.environmentFromRequest(req)==='testservice';
  const c = await clients();
  const { authDoc, teamDoc } = await readSessionDocuments(c,testserviceRequest);
  const resolved = auth.resolveSession(token, authDoc.value || auth.emptyAuth());
  const session = resolved.session;
  if (!session) throw auth.error('SESSION_INVALID', apiI18n.t(req,'api.common.sessionInvalid'), 401);
  if (session.revokedAt) throw auth.error('SESSION_REVOKED', apiI18n.t(req,'api.common.sessionRevoked'), 401);
  if (Date.parse(session.expiresAt || '') <= Date.now()) throw auth.error('SESSION_INVALID', apiI18n.t(req,'api.common.sessionInvalid'), 401);
  const team = auth.applyUserPolicy(teamDoc.value || auth.emptyTeam());
  const user = (team.users || []).find((candidate) => auth.text(candidate.id) === auth.text(session.userId) || auth.usernameOf(candidate) === auth.lower(session.username));
  if (!user || !auth.isActive(user)) throw auth.error('ACCOUNT_DISABLED', apiI18n.t(req,'api.common.accountDisabled'), 403);
  if (Number(session.authVersion || 0) !== Number(user.authVersion || 0)) throw auth.error('SESSION_REVOKED', apiI18n.t(req,'api.common.sessionRevoked'), 401);
  if ((session.mustChange || user.mustChange) && !options.allowPasswordChange) throw auth.error('PASSWORD_CHANGE_REQUIRED', apiI18n.t(req,'api.common.passwordChangeRequired'), 403);
  return { token, session, user, team, source: resolved.source, authDoc, teamDoc };
}

module.exports = Object.assign({}, auth, { clients, validateSession, isSource });