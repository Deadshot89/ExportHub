'use strict';

const crypto = require('crypto');
const https = require('https');
const { BlobServiceClient } = require('@azure/storage-blob');
const { isAdmin } = require('../shared/user-policy');
const apiI18n = require('../shared/i18n');

const TEAM_CONTAINER = process.env.EXPORTHUB_STORAGE_CONTAINER || process.env.EXPORTHUB_CONTAINER || 'exporthub-data';
const TEAM_BLOB = process.env.EXPORTHUB_STORAGE_BLOB || process.env.EXPORTHUB_STATE_BLOB || 'team-state.json';
const AUTH_BLOB = process.env.EXPORTHUB_AUTH_BLOB || 'auth-sessions.json';
const DIAG_PROD_BLOB = process.env.EXPORTHUB_DIAGNOSTICS_BLOB || 'diagnostics/team-diagnostics.json';
const DIAG_TEST_BLOB = process.env.EXPORTHUB_TEST_DIAGNOSTICS_BLOB || 'testservice/diagnostics/team-diagnostics.json';
const REPO = process.env.EXPORTHUB_GITHUB_AUTOFIX_REPO || 'Deadshot89/ExportHub';
const WORKFLOW = process.env.EXPORTHUB_GITHUB_AUTOFIX_WORKFLOW || 'diagnostic-autofix.yml';
const PREFLIGHT_WORKFLOW = process.env.EXPORTHUB_AUTOFIX_PREFLIGHT_WORKFLOW || 'rc1083-autofix-preflight.yml';
const MAX_RETRIES = 6;
const OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const OIDC_JWKS_URL = 'https://token.actions.githubusercontent.com/.well-known/jwks';
const OIDC_AUDIENCE = 'exporthub-diagnostic-autofix';
let oidcJwksCache = {expiresAt:0,keys:[]};

function autofixEnabled(){ return /^(1|true|yes|on)$/i.test(text(process.env.EXPORTHUB_AUTOFIX_ENABLED)); }

function text(v){ return String(v == null ? '' : v).trim(); }
function lower(v){ return text(v).toLowerCase(); }
function now(){ return new Date().toISOString(); }
function json(status, body){ return {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)}; }
function error(code,message,status=400,vars){ const e=new Error(message); e.code=code; e.status=status; e.vars=vars||{}; return e; }
function localizedError(req,e){const raw=text(e&&e.message);return /^api\./.test(raw)?apiI18n.t(req,raw,e&&e.vars):raw;}
function body(req){ if(req&&req.body&&typeof req.body==='object')return req.body; try{return JSON.parse(req&&req.body||'{}')}catch(_){return {}} }
function header(req,name){ const h=req&&req.headers||{}; return h[name.toLowerCase()]||h[name]||''; }
function bearer(req,payload){ const direct=text(header(req,'x-exporthub-token')||header(req,'x-exporthub-session')||payload.sessionToken); if(direct)return direct; return text(String(header(req,'authorization')||'').replace(/^Bearer\s+/i,'')); }
function connectionString(){ return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || ''; }
function environmentOf(req,payload){
 const raw=lower(payload&&payload.environment||header(req,'x-exporthub-environment'));
 const origin=lower(header(req,'origin')||header(req,'referer')||header(req,'x-forwarded-host')||header(req,'host'));
 const inferred=/-testservice\./.test(origin)?'testservice':'production';
 if(raw&&raw!=='production'&&raw!=='testservice')throw error('ENVIRONMENT_INVALID','api.common.environmentInvalid',400);
 if(raw&&raw!==inferred&&/azurestaticapps\.net/.test(origin))throw error('ENVIRONMENT_MISMATCH','api.autofix.environmentMismatch',409);
 return raw||inferred;
}
function usernameOf(user){ return lower(user&&(user.user||user.login||user.username||user.name)); }
function isActive(user){ return Boolean(user&&user.active!==false&&user.disabled!==true&&lower(user.status)!=='deaktiviert'); }
function safeEqual(a,b){ const aa=Buffer.from(String(a||''),'utf8'),bb=Buffer.from(String(b||''),'utf8'); return aa.length===bb.length&&aa.length>0&&crypto.timingSafeEqual(aa,bb); }
function tokenHash(value){ return crypto.createHash('sha256').update(String(value||'')).digest('hex'); }
function signingSecret(){ const source=text(process.env.EXPORTHUB_AUTH_SIGNING_SECRET||process.env.EXPORTHUB_SESSION_SECRET)||connectionString(); if(!source)throw error('AUTH_SIGNING_NOT_CONFIGURED','Sitzungssignatur ist nicht konfiguriert.',503); return crypto.createHash('sha256').update('ExportHUB/session/v1|'+source).digest(); }
function verifySigned(value){
 const parts=text(value).split('.'); if(parts.length!==3||parts[0]!=='ehs1')return null;
 const expected=crypto.createHmac('sha256',signingSecret()).update(parts[1]).digest('base64url'); if(!safeEqual(expected,parts[2]))return null;
 let p;try{p=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'))}catch(_){return null}
 if(!p||p.purpose!=='exporthub-session'||Number(p.v||0)!==1||!p.uid||!p.sid||Number(p.exp||0)<=Date.now())return null;
 return p;
}
function parseJson(raw){ const cleaned=String(raw==null?'':raw).replace(/^\uFEFF/,'').replace(/\u0000+$/g,'').trim(); if(!cleaned)return null; let v=JSON.parse(cleaned); if(typeof v==='string'&&/^[\[{]/.test(v.trim()))v=JSON.parse(v.trim()); return v; }
async function readJson(blob,fallback,repair){
 try{
  const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));
  try{const v=parseJson(Buffer.concat(chunks).toString('utf8'));return {value:v==null?fallback:v,etag:r.etag||null}}catch(e){if(repair)return {value:fallback,etag:r.etag||null};throw e}
 }catch(e){if(e&&e.statusCode===404)return {value:fallback,etag:null};throw e}
}
async function uploadJson(blob,value,etag){
 const raw=JSON.stringify(value);
 return blob.upload(raw,Buffer.byteLength(raw),{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions:etag?{ifMatch:etag}:{ifNoneMatch:'*'}});
}
function service(){
 const cs=connectionString();if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);
 return BlobServiceClient.fromConnectionString(cs);
}
async function validateGlobalAdmin(req,payload,env){
 const t=bearer(req,payload);if(!t)throw error('AUTH_REQUIRED','ExportHUB-Admin-Anmeldung erforderlich.',401);
 const container=service().getContainerClient(TEAM_CONTAINER),teamName=env==='testservice'?(process.env.EXPORTHUB_TEST_STORAGE_BLOB||('testservice/'+TEAM_BLOB.replace(/^\/+/,''))):TEAM_BLOB;
 const [authRead,teamRead]=await Promise.all([readJson(container.getBlockBlobClient(AUTH_BLOB),{sessions:[]},true),readJson(container.getBlockBlobClient(teamName),{users:[]},false)]);
 const sessions=Array.isArray(authRead.value&&authRead.value.sessions)?authRead.value.sessions:[],digest=tokenHash(t);
 let session=sessions.find(s=>safeEqual(s&&s.tokenHash,digest));
 if(!session){const signed=verifySigned(t);if(signed)session={id:text(signed.sid),userId:text(signed.uid),username:text(signed.username),expiresAt:new Date(Number(signed.exp)).toISOString(),authVersion:Number(signed.authVersion||0),mustChange:signed.mustChange===true,signedFallback:true}}
 if(!session||session.revokedAt||(session.expiresAt&&Date.parse(session.expiresAt)<=Date.now()))throw error('SESSION_INVALID','api.autofix.sessionInvalid',401);
 const users=Array.isArray(teamRead.value&&teamRead.value.users)?teamRead.value.users:[],user=users.find(u=>text(u&&u.id)===text(session.userId)||usernameOf(u)===lower(session.username));
 if(!user||!isActive(user))throw error('ACCOUNT_DISABLED','Das Benutzerkonto ist nicht aktiv.',403);
 if(Number(session.authVersion||0)!==Number(user.authVersion||0))throw error('SESSION_REVOKED','api.autofix.sessionRevoked',401);
 if(!isAdmin(user))throw error('GLOBAL_ADMIN_REQUIRED','api.autofix.adminRequired',403);
 return user;
}
async function githubOidcAuthorized(req,workflowFile,allowedEvents){
 const token=text(header(req,'x-exporthub-github-oidc'));if(!token)return false;
 try{
  const parts=token.split('.');if(parts.length!==3)return false;
  const jose=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8')),claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  if(jose.alg!=='RS256'||!text(jose.kid))return false;
  const nowSec=Math.floor(Date.now()/1000),aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  const expectedWorkflow=REPO+'/.github/workflows/'+workflowFile+'@refs/heads/main';
  if(claims.iss!==OIDC_ISSUER||!aud.includes(OIDC_AUDIENCE))return false;
  const events=Array.isArray(allowedEvents)&&allowedEvents.length?allowedEvents:['workflow_dispatch'];
  if(claims.repository!==REPO||claims.ref!=='refs/heads/main'||!events.includes(claims.event_name))return false;
  if(claims.workflow_ref!==expectedWorkflow)return false;
  if(!Number(claims.exp)||Number(claims.exp)<=nowSec-30)return false;
  if(Number(claims.nbf||0)>nowSec+60||Number(claims.iat||0)>nowSec+60||Number(claims.iat||0)<nowSec-900)return false;
  if(!oidcJwksCache.keys.length||oidcJwksCache.expiresAt<Date.now()){
   const res=await httpsJson('GET',OIDC_JWKS_URL,{'Accept':'application/json'}),parsed=JSON.parse(res.body||'{}');
   oidcJwksCache={expiresAt:Date.now()+10*60*1000,keys:Array.isArray(parsed.keys)?parsed.keys:[]};
  }
  const jwk=oidcJwksCache.keys.find(k=>k&&k.kid===jose.kid&&k.kty==='RSA');if(!jwk)return false;
  const key=crypto.createPublicKey({key:jwk,format:'jwk'}),signature=Buffer.from(parts[2],'base64url');
  return crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,signature);
 }catch(_){return false}
}
async function callbackAuthorized(req,workflowFile,allowedEvents){
 const configured=text(process.env.EXPORTHUB_AUTOFIX_CALLBACK_SECRET),received=text(header(req,'x-exporthub-autofix-secret'));
 if(configured&&received&&safeEqual(configured,received))return true;
 return githubOidcAuthorized(req,workflowFile||WORKFLOW,allowedEvents);
}
function diagBlob(env){ return service().getContainerClient(TEAM_CONTAINER).getBlockBlobClient(env==='testservice'?DIAG_TEST_BLOB:DIAG_PROD_BLOB); }
function teamBlob(env){
 const name=env==='testservice'?(process.env.EXPORTHUB_TEST_STORAGE_BLOB||('testservice/'+TEAM_BLOB.replace(/^\/+/,''))):TEAM_BLOB;
 return service().getContainerClient(TEAM_CONTAINER).getBlockBlobClient(name);
}
async function appendAudit(env,type,actor,details){
 const blob=teamBlob(env);
 for(let attempt=0;attempt<MAX_RETRIES;attempt++){
  const d=await readJson(blob,{schemaVersion:3,revision:0,state:{}},false),doc=d.value&&typeof d.value==='object'?d.value:{schemaVersion:3,revision:0,state:{}};
  doc.state=doc.state&&typeof doc.state==='object'?doc.state:{};
  const rows=Array.isArray(doc.state.auditLog)?doc.state.auditLog.slice():[],cutoff=Date.now()-365*86400000,clean=sanitize(details||{});
  doc.state.auditLog=rows.filter(e=>{const ts=Date.parse(e&&e.at||'');return !Number.isFinite(ts)||ts>=cutoff}).slice(-4999);
  doc.state.auditLog.push({id:'AUD-'+Date.now().toString(36)+'-'+crypto.randomBytes(3).toString('hex'),type,actor:text(actor)||'System',at:now(),details:clean});
  doc.revision=Number(doc.revision||0)+1;doc.updatedAt=now();doc.updatedBy=text(actor)||'System';
  try{await uploadJson(blob,doc,d.etag);return true}catch(e){if(e&&(e.statusCode===409||e.statusCode===412)&&attempt<MAX_RETRIES-1)continue;throw e}
 }
 return false;
}
function secretKey(k){return /token|authorization|password|passwort|session|signature|base64|dataurl|filedata|cookie|secret|connection|string/i.test(String(k||''))}
function sanitize(value,depth=0){
 if(depth>8)return '[gekürzt]';
 if(Array.isArray(value))return value.slice(0,100).map(v=>sanitize(v,depth+1));
 if(value&&typeof value==='object'){const out={};Object.keys(value).slice(0,120).forEach(k=>{out[k]=secretKey(k)?'[geschützt]':sanitize(value[k],depth+1)});return out}
 if(typeof value==='string')return value.slice(0,8000);
 if(value==null||typeof value==='number'||typeof value==='boolean')return value;
 return String(value).slice(0,1000);
}
async function mutateRecord(env,id,fn){
 const blob=diagBlob(env);
 for(let attempt=0;attempt<MAX_RETRIES;attempt++){
  const d=await readJson(blob,{schemaVersion:1,revision:0,records:[]},false),doc=d.value&&typeof d.value==='object'?d.value:{schemaVersion:1,revision:0,records:[]},rows=Array.isArray(doc.records)?doc.records.slice():[];
  const pos=rows.findIndex(r=>text(r&&r.id)===text(id));if(pos<0)throw error('DIAGNOSTIC_NOT_FOUND','api.autofix.diagnosticNotFound',404);
  const current=Object.assign({},rows[pos]),nextRecord=fn(current)||current;rows[pos]=nextRecord;
  const next=Object.assign({},doc,{schemaVersion:1,revision:Number(doc.revision||0)+1,updatedAt:now(),records:rows});
  try{await uploadJson(blob,next,d.etag);return nextRecord}catch(e){if(e&&(e.statusCode===409||e.statusCode===412)&&attempt<MAX_RETRIES-1)continue;throw e}
 }
 throw error('DIAGNOSTIC_CONCURRENT_UPDATE','api.autofix.diagnosticConcurrent',409);
}
async function findJob(env,jobId){
 const d=await readJson(diagBlob(env),{records:[]},false),rows=Array.isArray(d.value&&d.value.records)?d.value.records:[];
 const record=rows.find(r=>r&&r.autofix&&text(r.autofix.jobId)===text(jobId));
 if(!record)throw error('AUTOFIX_JOB_NOT_FOUND','api.autofix.jobNotFound',404);
 return record;
}
function jobIdFor(record){return 'AF-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase()+'-'+text(record&&record.id).replace(/[^A-Za-z0-9_-]/g,'').slice(-12)}
function httpsJson(method,url,headers,payload){
 return new Promise((resolve,reject)=>{
  const u=new URL(url),raw=payload===undefined?'':JSON.stringify(payload),req=https.request({method,hostname:u.hostname,path:u.pathname+u.search,headers:Object.assign({'User-Agent':'ExportHUB-Autofix','Accept':'application/vnd.github+json'},headers||{},raw?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)}:{})},res=>{
   const chunks=[];res.on('data',c=>chunks.push(Buffer.from(c)));res.on('end',()=>{const body=Buffer.concat(chunks).toString('utf8');if(res.statusCode>=200&&res.statusCode<300)return resolve({status:res.statusCode,body});const e=error('GITHUB_DISPATCH_FAILED','api.autofix.githubDispatchFailed',502,{status:res.statusCode});e.response=body;reject(e)})});
  req.on('error',reject);if(raw)req.write(raw);req.end();
 })
}
async function dispatch(jobId,env){
 const token=text(process.env.EXPORTHUB_GITHUB_AUTOFIX_TOKEN);if(!token)throw error('AUTOFIX_GITHUB_NOT_CONFIGURED','api.autofix.githubTokenMissing',503);
 const url='https://api.github.com/repos/'+REPO+'/actions/workflows/'+encodeURIComponent(WORKFLOW)+'/dispatches';
 await httpsJson('POST',url,{'Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'},{ref:'main',inputs:{job_id:jobId,environment:env}});
}
function promptFor(record,jobId,env){
 return [
  'Du arbeitest autonom im Repository Deadshot89/ExportHub an genau einem gemeldeten ExportHUB-Fehler.',
  'Lies zuerst die Datei .exporthub-autofix/diagnostic-attachment.json vollständig. Sie ist der Anhang zu diesem Auftrag.',
  'Autofix-Auftrag: '+jobId+' · Umgebung: '+env+' · Diagnose-ID: '+text(record.id),
  'Analysiere den aktuellen Repository-Stand und die Diagnose. Reproduziere den Fehler soweit möglich, finde die konkrete Ursache und implementiere die kleinste belastbare Korrektur.',
  'Erhalte bestehende Daten und Funktionen. Bereits ausgegebene QR-Codes und öffentliche Links müssen rückwärtskompatibel bleiben. Keine produktiven Daten löschen oder zurücksetzen.',
  'Keine Secrets ausgeben oder in Dateien schreiben. Die Datei .github/workflows/diagnostic-autofix.yml darfst du nicht verändern.',
  'Führe npm test sowie relevante zielgerichtete Tests aus. Behebe durch deine Änderung verursachte Testfehler.',
  'Committe und pushe NICHT selbst; das übernimmt der Workflow nach erfolgreicher Prüfung.',
  'Wenn der Fehler sicher behoben ist, beginne deine Abschlussmeldung mit FIXED:. Wenn die Diagnose bereits durch den aktuellen Stand behoben ist, beginne mit ALREADY_FIXED:. Wenn eine sichere automatische Korrektur nicht möglich ist, beginne mit BLOCKED: und nenne präzise den Grund.'
 ].join('\n');
}
async function requestAutofix(req,payload,env){
 const admin=await validateGlobalAdmin(req,payload,env);
 if(!autofixEnabled())throw error('AUTOFIX_DISABLED','api.autofix.disabledReason',409);
 const id=text(payload.diagnosticId||payload.id);if(!id)throw error('DIAGNOSTIC_ID_REQUIRED','api.autofix.diagnosticIdRequired',400);
 let jobId='';
 const record=await mutateRecord(env,id,current=>{
  const existing=current.autofix&&typeof current.autofix==='object'?current.autofix:{};
  if(['queued','claimed','running','testing','deploying'].includes(lower(existing.status)))throw error('AUTOFIX_ALREADY_RUNNING','api.autofix.alreadyRunning',409);
  jobId=jobIdFor(current);
  return Object.assign({},current,{autofix:{jobId,status:'queued',requestedAt:now(),requestedBy:text(admin.name||admin.user),requestedByUserId:text(admin.id),attempt:Number(existing.attempt||0)+1,lastMessage:''},resolvedAt:null,resolvedBy:null});
 });
 try{await dispatch(jobId,env)}
 catch(e){
  await mutateRecord(env,id,current=>{const af=Object.assign({},current.autofix||{},{status:'failed',failedAt:now(),lastMessage:e.message});return Object.assign({},current,{autofix:af})});
  throw e;
 }
 try{await appendAudit(env,'DIAGNOSTIC_AUTOFIX_REQUESTED',text(admin.name||admin.user),{diagnosticId:id,jobId,environment:env})}catch(_){}
 return {ok:true,jobId,diagnosticId:id,status:'queued',environment:env,record:sanitize(record)};
}
async function claim(payload,env){
 const jobId=text(payload.jobId);if(!jobId)throw error('AUTOFIX_JOB_REQUIRED','api.autofix.jobRequired',400);
 const found=await findJob(env,jobId),id=text(found.id);
 const record=await mutateRecord(env,id,current=>Object.assign({},current,{autofix:Object.assign({},current.autofix||{},{status:'claimed',claimedAt:now(),lastMessage:''})}));
 return {ok:true,jobId,diagnosticId:id,environment:env,prompt:promptFor(record,jobId,env),attachment:sanitize(record),filename:'diagnostic-'+id.replace(/[^A-Za-z0-9_.-]/g,'-')+'.json'};
}
async function workflowStatus(payload,env){
 const jobId=text(payload.jobId),status=lower(payload.status),message=text(payload.message).slice(0,4000),commit=text(payload.commit).slice(0,80),runUrl=text(payload.runUrl).slice(0,500);
 if(!jobId)throw error('AUTOFIX_JOB_REQUIRED','api.autofix.jobRequired',400);
 const allowed=['running','testing','deploying','fixed','failed','reverted'];if(!allowed.includes(status))throw error('AUTOFIX_STATUS_INVALID','api.autofix.statusInvalid',400);
 const found=await findJob(env,jobId),id=text(found.id);
 const record=await mutateRecord(env,id,current=>{
  const af=Object.assign({},current.autofix||{},{status,lastMessage:message,commit,runUrl,updatedAt:now()});
  if(status==='running')af.startedAt=af.startedAt||now();
  if(status==='testing')af.testingAt=now();
  if(status==='deploying')af.deployingAt=now();
  if(status==='fixed'){af.completedAt=now();return Object.assign({},current,{autofix:af,resolvedAt:now(),resolvedBy:'ChatGPT / Codex Autofix',resolutionMessage:message})}
  if(status==='failed'||status==='reverted')af.failedAt=now();
  return Object.assign({},current,{autofix:af});
 });
 if(status==='fixed'||status==='failed'||status==='reverted'){
  try{await appendAudit(env,status==='fixed'?'DIAGNOSTIC_AUTOFIX_FIXED':'DIAGNOSTIC_AUTOFIX_FAILED',status==='fixed'?'ChatGPT / Codex Autofix':'ExportHUB Autofix',{diagnosticId:id,jobId,status,commit,runUrl,message})}catch(_){}
 }
 return {ok:true,jobId,diagnosticId:id,status,record:sanitize(record)};
}

module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{'Cache-Control':'no-store','Allow':'POST, OPTIONS'},body:''};return}
 if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:apiI18n.t(req,'api.common.postOnly')});return}
 try{
  const payload=body(req),env=environmentOf(req,payload),action=lower(payload.action||'status');
  let result;
  if(action==='request')result=await requestAutofix(req,payload,env);
  else if(action==='claim'){if(!(await callbackAuthorized(req,WORKFLOW)))throw error('AUTOFIX_CALLBACK_UNAUTHORIZED','api.autofix.callbackUnauthorized',401);result=await claim(payload,env)}
  else if(action==='workflow-status'){if(!(await callbackAuthorized(req,WORKFLOW)))throw error('AUTOFIX_CALLBACK_UNAUTHORIZED','api.autofix.callbackUnauthorized',401);result=await workflowStatus(payload,env)}
  else if(action==='preflight'){
   if(!(await callbackAuthorized(req,PREFLIGHT_WORKFLOW,['push','workflow_dispatch'])))throw error('AUTOFIX_CALLBACK_UNAUTHORIZED','api.autofix.preflightUnauthorized',401);
   result={ok:true,githubDispatchConfigured:Boolean(text(process.env.EXPORTHUB_GITHUB_AUTOFIX_TOKEN)),autofixEnabled:autofixEnabled(),callbackMode:'github-oidc',repo:REPO,workflow:WORKFLOW,environment:env}
  }
  else if(action==='configuration'){
   await validateGlobalAdmin(req,payload,env);
   const enabled=autofixEnabled(),githubToken=text(process.env.EXPORTHUB_GITHUB_AUTOFIX_TOKEN);
   let preflight=enabled?{checked:false,status:'unknown',conclusion:'',runUrl:'',updatedAt:'',message:''}:{checked:false,status:'disabled',conclusion:'',runUrl:'',updatedAt:'',message:apiI18n.t(req,'api.autofix.disabled')};
   if(githubToken&&enabled){
    try{
     const probe=await httpsJson('GET','https://api.github.com/repos/'+REPO+'/actions/workflows/'+encodeURIComponent(PREFLIGHT_WORKFLOW)+'/runs?branch=main&per_page=1',{'Authorization':'Bearer '+githubToken,'X-GitHub-Api-Version':'2022-11-28'});
     const parsed=JSON.parse(probe.body||'{}'),run=Array.isArray(parsed.workflow_runs)&&parsed.workflow_runs.length?parsed.workflow_runs[0]:null;
     preflight=run?{checked:true,status:text(run.status),conclusion:text(run.conclusion),runUrl:text(run.html_url),updatedAt:text(run.updated_at),message:text(run.conclusion)==='success'?apiI18n.t(req,'api.autofix.preflightSuccess'):apiI18n.t(req,'api.autofix.preflightPending')}:{checked:true,status:'missing',conclusion:'',runUrl:'',updatedAt:'',message:apiI18n.t(req,'api.autofix.preflightMissing')};
    }catch(e){
     preflight={checked:true,status:'unavailable',conclusion:'',runUrl:'',updatedAt:'',message:apiI18n.t(req,'api.autofix.preflightUnavailable')};
    }
   }
   const serverConfigured=Boolean(githubToken),preflightOk=preflight.conclusion==='success';
   result={ok:true,enabled,configured:Boolean(enabled&&serverConfigured&&preflightOk),serverConfigured,github:Boolean(githubToken),callback:true,callbackMode:'github-oidc',noExternalAiRequests:!enabled,preflight,repo:REPO,workflow:WORKFLOW,preflightWorkflow:PREFLIGHT_WORKFLOW,environment:env}
  }
  else throw error('AUTOFIX_ACTION_INVALID','api.autofix.invalidAction',400);
  context.res=json(200,result);
 }catch(e){
  context.log&&context.log.error&&context.log.error('diagnostic-autofix',e&&e.code,e&&e.message);
  context.res=json(Number(e.status||e.statusCode||500),{ok:false,code:e.code||'SERVER_ERROR',message:localizedError(req,e)||apiI18n.t(req,'api.autofix.failed')});
 }
};
