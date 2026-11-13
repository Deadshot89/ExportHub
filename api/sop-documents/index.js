'use strict';

// SOP2 private API. No legacy SOP or shared team-state mutation.
const authStore=require('../shared/auth-store');
const rules=require('../shared/sop-rules');
const service=require('../shared/sop-service');
const {defaultStore}=require('../shared/sop-store');

const ACTIONS=new Set(['list','get','create','update','submit','approve','reject','new-version','archive']);
const READ_ACTIONS=new Set(['list','get']);
const MAX_REQUEST_BYTES=2*1024*1024;

function fail(code,status) {
  const error=new Error(code);
  error.code=code;
  error.status=status;
  return error;
}
function response(status,body) {
  return {status,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  },body:JSON.stringify(body)};
}
function requestBody(req) {
  const raw=req&&req.body;
  if (raw===undefined || raw===null) throw fail('INVALID_BODY',400);
  let parsed=raw;
  if (typeof raw==='string') {
    if (Buffer.byteLength(raw)>MAX_REQUEST_BYTES) throw fail('REQUEST_TOO_LARGE',413);
    try { parsed=JSON.parse(raw); } catch (_) { throw fail('INVALID_JSON',400); }
  } else {
    try {
      if (Buffer.byteLength(JSON.stringify(raw))>MAX_REQUEST_BYTES) throw fail('REQUEST_TOO_LARGE',413);
    } catch (error) {
      if (error.code==='REQUEST_TOO_LARGE') throw error;
      throw fail('INVALID_BODY',400);
    }
  }
  if (!parsed || typeof parsed!=='object' || Array.isArray(parsed)) throw fail('INVALID_BODY',400);
  return parsed;
}
function safeDoc(doc) {
  service.assertDocumentIntegrity(doc);
  return {...doc,historyIntegrity:{ok:true,brokenAt:0}};
}
function getId(payload) {
  if (typeof payload.id!=='string' || !/^SOP-EH-\d{3}$/.test(payload.id)) throw fail('INVALID_SOP_ID',400);
  return payload.id;
}
async function handle(context,req,deps={}) {
  const auth=deps.auth || authStore;
  const store=deps.store || defaultStore();
  try {
    const method=String(req&&req.method||'').toUpperCase();
    if (method==='OPTIONS') {
      context.res={status:204,headers:{'Cache-Control':'no-store','Allow':'POST, OPTIONS'},body:''};
      return context.res;
    }
    if (method!=='POST') throw fail('METHOD_NOT_ALLOWED',405);
    // New SOP2 stays unavailable until explicitly enabled in the deployment.
    // Test-only injection is not wired into the Azure Function entrypoint.
    if (deps.featureEnabled!==true && process.env.EXPORTHUB_SOP2_ENABLED!=='enabled') {
      throw fail('SOP2_DISABLED',404);
    }

    // No identity, rights, or environment claimed by the browser is trusted.
    const session=await auth.validateSession(req);
    const user=session&&session.user;
    if (!user) throw fail('AUTH_REQUIRED',401);
    const environment=auth.environmentFromRequest(req);
    if (environment!=='production' && environment!=='testservice') throw fail('INVALID_ENVIRONMENT',400);
    const payload=requestBody(req);
    const action=payload.action;
    if (typeof action!=='string'||!ACTIONS.has(action)) throw fail('INVALID_ACTION',400);
    if (READ_ACTIONS.has(action)) {
      if (!rules.canRead(user)) throw fail('SOP_READ_FORBIDDEN',403);
    } else if (!rules.canEdit(user)) throw fail('SOP_EDIT_FORBIDDEN',403);
    if (action==='list') {
      const docs=(await store.listDocs(environment)).map(safeDoc);
      context.res=response(200,{ok:true,items:docs,environment});
      return context.res;
    }
    if (action==='get') {
      const doc=await store.getDoc(environment,getId(payload));
      if (!doc) throw fail('SOP_NOT_FOUND',404);
      context.res=response(200,{ok:true,item:safeDoc(doc),environment});
      return context.res;
    }
    const id=getId(payload);
    const now=typeof deps.now==='function' ? deps.now() : new Date().toISOString();
    const operations={
      create:doc=>service.createDraft(doc,payload,user,now),
      update:doc=>service.updateDraft(doc,payload,user,now),
      submit:doc=>service.submit(doc,payload,user,now),
      approve:doc=>service.approve(doc,payload,user,now),
      reject:doc=>service.reject(doc,payload,user,now),
      'new-version':doc=>service.newVersion(doc,payload,user,now),
      archive:doc=>service.archive(doc,payload,user,now)
    };
    const item=await store.mutateDoc(environment,id,operations[action],{create:action==='create'});
    context.res=response(200,{ok:true,item:safeDoc(item),environment});
    return context.res;
  } catch (e) {
    const status=Number.isInteger(e&&e.status)&&e.status>=400&&e.status<=599?e.status:500;
    const code=typeof e?.code==='string' && /^[A-Z][A-Z0-9_]{1,79}$/.test(e.code)?e.code:'SERVER_ERROR';
    if (context&&context.log&&typeof context.log.warn==='function') context.log.warn('sop-documents',code);
    context.res=response(status,{ok:false,code,...(Array.isArray(e?.errors)?{errors:e.errors}: {})});
    return context.res;
  }
}
module.exports=async function(context,req){return handle(context,req)};
module.exports._test={handle};
