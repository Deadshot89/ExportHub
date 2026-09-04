// RC995 TESTSERVICE deployment trigger
'use strict';

const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = process.env.EXPORTHUB_PUBLIC_ACCESS_CONTAINER || process.env.EXPORTHUB_PICKUP_LOCK_CONTAINER || 'exporthub-pickup-lock';
const ROOT = 'rc995-public-access';
const MAX_RETRIES = 6;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;
const DEFAULT_PICKUP_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_AVIS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_MS = 30 * 60 * 1000;

function text(v){ return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g,' ').trim(); }
function lower(v){ return text(v).toLowerCase(); }
function now(){ return new Date().toISOString(); }
function clone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }
function error(code,message,status=400){ const e=new Error(message); e.code=code; e.status=status; return e; }
function body(req){ if(req&&req.body&&typeof req.body==='object')return req.body; try{return JSON.parse(req&&req.body||'{}')}catch(_){return {}} }
function connectionString(){ return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.EXPORTHUB_STORAGE_CONNECTION || process.env.AzureWebJobsStorage || ''; }
function secret(){ const value=process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET || process.env.EXPORTHUB_PICKUP_SECRET || process.env.EXPORTHUB_AUTH_SIGNING_SECRET || connectionString(); if(!value)throw error('PUBLIC_ACCESS_SECRET_MISSING','Serverseitiges Zugriffssicherheits-Geheimnis fehlt.',503); return value; }
function requestEvidence(req){ const h=req&&req.headers||{}; return [h.origin,h.Origin,h.referer,h.Referer,h['x-forwarded-host'],h['X-Forwarded-Host'],h['x-original-host'],h['X-Original-Host'],h.host,h.Host].map(text).filter(Boolean).join(' '); }
function environment(req,payload){
  const h=req&&req.headers||{}, explicit=lower(h['x-exporthub-environment']||h['X-ExportHUB-Environment']||(payload&&payload.environment)||''), evidence=lower(requestEvidence(req));
  if(explicit && !['production','testservice'].includes(explicit))throw error('ENVIRONMENT_INVALID','Unbekannte ExportHUB-Datenumgebung.',400);
  const hostEnv=/-testservice\./i.test(evidence)?'testservice':/\.azurestaticapps\.net(?:[:/]|$)/i.test(evidence)?'production':'';
  if(explicit&&hostEnv&&explicit!==hostEnv)throw error('ENVIRONMENT_MISMATCH','Zugriff gehört zu einer anderen ExportHUB-Umgebung.',409);
  return explicit||hostEnv||'production';
}
function normalizeEnvironment(value){ const v=lower(value); return v==='testservice'?'testservice':'production'; }
function normalizeKind(value){ const v=lower(value); if(v!=='pickup'&&v!=='avis')throw error('ACCESS_KIND_INVALID','Unbekannter öffentlicher Zugriffstyp.',400); return v; }
function accessSecret(environmentName,kind){ return crypto.createHmac('sha256',secret()).update(`exporthub-rc995|${normalizeEnvironment(environmentName)}|${normalizeKind(kind)}`).digest(); }
function hashToken(token,environmentName,kind){ return crypto.createHmac('sha256',accessSecret(environmentName,kind)).update(text(token)).digest('hex'); }
function subjectHash(subjectId,environmentName,kind){ return crypto.createHmac('sha256',accessSecret(environmentName,kind)).update('subject:'+text(subjectId)).digest('hex'); }
function sessionSecret(environmentName,kind){ return crypto.createHmac('sha256',accessSecret(environmentName,kind)).update('session').digest(); }
function safeEqual(a,b){ try{const aa=Buffer.from(String(a||''),'utf8'),bb=Buffer.from(String(b||''),'utf8');return aa.length===bb.length&&aa.length>0&&crypto.timingSafeEqual(aa,bb)}catch(_){return false} }
function tokenValid(token){ return /^[A-Za-z0-9_-]{40,160}$/.test(text(token)); }
function json(status,payload,headers={}){ return {status,headers:Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow, noarchive'},headers),body:JSON.stringify(payload)}; }

async function container(){ const cs=connectionString(); if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503); const c=BlobServiceClient.fromConnectionString(cs).getContainerClient(CONTAINER); await c.createIfNotExists(); return c; }
async function readBuffer(blob){ const r=await blob.download(0),chunks=[]; for await(const chunk of r.readableStreamBody)chunks.push(Buffer.from(chunk)); return {buffer:Buffer.concat(chunks),etag:r.etag||null}; }
async function readJson(blob,fallback=null){ try{const r=await readBuffer(blob);return{value:r.buffer.length?JSON.parse(r.buffer.toString('utf8')):clone(fallback),etag:r.etag}}catch(e){if(e&&e.statusCode===404)return{value:clone(fallback),etag:null};throw e} }
async function writeJson(blob,value,etag){ const raw=JSON.stringify(value),conditions=etag?{ifMatch:etag}:{ifNoneMatch:'*'}; return blob.upload(raw,Buffer.byteLength(raw),{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8',blobCacheControl:'no-store'},conditions}); }
function recordName(environmentName,kind,tokenHash){ return `${ROOT}/${normalizeEnvironment(environmentName)}/${normalizeKind(kind)}/records/${tokenHash}.json`; }
function subjectName(environmentName,kind,subjectId){ return `${ROOT}/${normalizeEnvironment(environmentName)}/${normalizeKind(kind)}/subjects/${subjectHash(subjectId,environmentName,kind)}.json`; }
async function readRecord(environmentName,kind,tokenHash){ const c=await container(),blob=c.getBlockBlobClient(recordName(environmentName,kind,tokenHash)),d=await readJson(blob,null); return {container:c,blob,record:d.value,etag:d.etag}; }
async function mutateRecord(environmentName,kind,tokenHash,fn){
  for(let i=0;i<MAX_RETRIES;i++){
    const got=await readRecord(environmentName,kind,tokenHash); if(!got.record)throw error('ACCESS_NOT_FOUND','Öffentlicher Zugriff wurde nicht gefunden.',410);
    const next=await fn(clone(got.record));
    try{await writeJson(got.blob,next,got.etag);return next}catch(e){if(e&&e.statusCode===412&&i<MAX_RETRIES-1)continue;throw e}
  }
  throw error('ACCESS_CONFLICT','Zugriff konnte wegen eines gleichzeitigen Vorgangs nicht gespeichert werden.',409);
}
async function revokeByHash(environmentName,kind,tokenHash,reason,actor){
  try{return await mutateRecord(environmentName,kind,tokenHash,r=>{if(!r.revokedAt){r.revokedAt=now();r.revokedReason=text(reason||'reissued').slice(0,160);r.revokedBy=text(actor||'ExportHUB').slice(0,120);r.updatedAt=now()}return r})}catch(e){if(e&&e.code==='ACCESS_NOT_FOUND')return null;throw e}
}
async function revokeSubject(req,kind,subjectId,reason='disabled',actor='ExportHUB',payload){
  const env=environment(req,payload),c=await container(),idx=c.getBlockBlobClient(subjectName(env,kind,subjectId)),d=await readJson(idx,null);
  if(d.value&&d.value.tokenHash)await revokeByHash(env,kind,d.value.tokenHash,reason,actor);
  if(d.value){d.value.active=false;d.value.revokedAt=now();d.value.reason=text(reason);try{await writeJson(idx,d.value,d.etag)}catch(e){if(!(e&&e.statusCode===412))throw e}}
  return {ok:true,environment:env};
}
async function issue(req,kind,meta={},ttlMs,payload){
  kind=normalizeKind(kind); const env=environment(req,payload||meta),subjectId=text(meta.subjectId||meta.shipmentId||meta.reference); if(!subjectId)throw error('SUBJECT_REQUIRED','Sendungs-ID für öffentlichen Zugriff fehlt.',400);
  const c=await container(),idx=c.getBlockBlobClient(subjectName(env,kind,subjectId)),old=await readJson(idx,null);
  if(old.value&&old.value.tokenHash)await revokeByHash(env,kind,old.value.tokenHash,'reissued',meta.actor||'ExportHUB');
  const token=crypto.randomBytes(24).toString('hex'),tokenHash=hashToken(token,env,kind),createdAt=now(),ttl=Math.max(60*1000,Number(ttlMs)|| (kind==='pickup'?DEFAULT_PICKUP_TTL_MS:DEFAULT_AVIS_TTL_MS)),expiresAt=new Date(Date.now()+ttl).toISOString();
  const record={schemaVersion:1,kind,environment:env,tokenHash,subjectId,shipmentId:text(meta.shipmentId||subjectId),reference:text(meta.reference).toUpperCase(),snapshot:clone(meta.snapshot||{}),createdAt,updatedAt:createdAt,expiresAt,usedAt:null,revokedAt:null,failedAttempts:0,lockedUntil:null,issuedBy:text(meta.actor||'ExportHUB').slice(0,120)};
  await writeJson(c.getBlockBlobClient(recordName(env,kind,tokenHash)),record,null);
  const index={schemaVersion:1,kind,environment:env,subjectId,tokenHash,active:true,issuedAt:createdAt,expiresAt};
  const current=await readJson(idx,null); try{await writeJson(idx,index,current.etag)}catch(e){if(e&&e.statusCode===412){const retry=await readJson(idx,null);await writeJson(idx,index,retry.etag)}else throw e}
  return {token,tokenHash,environment:env,kind,subjectId,expiresAt,record};
}
function assertUsable(record,{allowUsed=false}={}){
  if(!record)throw error('ACCESS_INVALID','Dieser öffentliche Link ist ungültig oder nicht mehr aktiv.',410);
  if(record.revokedAt)throw error('ACCESS_REVOKED','Dieser öffentliche Link wurde deaktiviert.',410);
  if(record.expiresAt&&Date.now()>=Date.parse(record.expiresAt))throw error('ACCESS_EXPIRED','Dieser öffentliche Link ist abgelaufen.',410);
  if(record.lockedUntil&&Date.now()<Date.parse(record.lockedUntil))throw error('ACCESS_LOCKED','Zu viele falsche Eingaben. Der Zugriff ist vorübergehend gesperrt.',429);
  if(record.usedAt&&!allowUsed)throw error('ACCESS_USED','Dieser Einmal-Link wurde bereits verwendet.',410);
  return record;
}
async function resolve(req,kind,token,options={},payload){
  kind=normalizeKind(kind); token=text(token); if(!tokenValid(token))throw error('ACCESS_INVALID','Dieser öffentliche Link ist ungültig.',410);
  const env=environment(req,payload),tokenHash=hashToken(token,env,kind),got=await readRecord(env,kind,tokenHash); if(!got.record)throw error('ACCESS_INVALID','Dieser öffentliche Link ist ungültig oder nicht mehr aktiv.',410);
  if(got.record.environment!==env||got.record.kind!==kind)throw error('ENVIRONMENT_MISMATCH','Dieser Link gehört zu einer anderen ExportHUB-Umgebung.',410);
  assertUsable(got.record,options); return Object.assign(got,{environment:env,kind,tokenHash});
}
async function registerFailure(environmentName,kind,tokenHash,reason){
  return mutateRecord(environmentName,kind,tokenHash,r=>{const n=Math.max(0,Number(r.failedAttempts)||0)+1;r.failedAttempts=n;r.lastFailureAt=now();r.lastFailureReason=text(reason).slice(0,80);if(n>=MAX_FAILED_ATTEMPTS)r.lockedUntil=new Date(Date.now()+LOCK_MS).toISOString();r.updatedAt=now();return r});
}
async function clearFailures(environmentName,kind,tokenHash){ return mutateRecord(environmentName,kind,tokenHash,r=>{r.failedAttempts=0;r.lockedUntil=null;r.lastFailureAt=null;r.lastFailureReason='';r.updatedAt=now();return r}); }
async function consume(environmentName,kind,tokenHash,extra={}){
  return mutateRecord(environmentName,kind,tokenHash,r=>{assertUsable(r,{allowUsed:false});r.usedAt=now();r.usedReason=text(extra.reason||'completed').slice(0,80);r.failedAttempts=0;r.lockedUntil=null;r.updatedAt=now();Object.assign(r,clone(extra.fields||{}));return r});
}
async function getByHash(environmentName,kind,tokenHash,{allowUsed=true}={}){ const got=await readRecord(environmentName,kind,tokenHash); assertUsable(got.record,{allowUsed}); return got; }
function signSessionPayload(payload){ const env=normalizeEnvironment(payload.environment),kind=normalizeKind(payload.kind),raw=Buffer.from(JSON.stringify(payload)).toString('base64url'),sig=crypto.createHmac('sha256',sessionSecret(env,kind)).update(raw).digest('base64url');return `${raw}.${sig}`; }
function issueSession(accessRecord,ttlMs=SESSION_MS){ const payload={v:1,kind:accessRecord.kind,environment:accessRecord.environment,th:accessRecord.tokenHash,subjectId:accessRecord.subjectId,shipmentId:accessRecord.shipmentId,reference:accessRecord.reference,iat:Date.now(),exp:Date.now()+Math.max(60*1000,Number(ttlMs)||SESSION_MS),nonce:crypto.randomBytes(12).toString('base64url')}; return {session:signSessionPayload(payload),expiresAt:new Date(payload.exp).toISOString(),payload}; }
function verifySession(session,expectedKind){
  const parts=text(session).split('.');if(parts.length!==2)throw error('SESSION_INVALID','Öffentliche Sitzung ist ungültig.',401);
  let p;try{p=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'))}catch(_){throw error('SESSION_INVALID','Öffentliche Sitzung ist ungültig.',401)}
  const env=normalizeEnvironment(p.environment),kind=normalizeKind(p.kind);if(expectedKind&&kind!==normalizeKind(expectedKind))throw error('SESSION_INVALID','Öffentliche Sitzung gehört zu einem anderen Zugriff.',401);
  const sig=crypto.createHmac('sha256',sessionSecret(env,kind)).update(parts[0]).digest('base64url');if(!safeEqual(sig,parts[1]))throw error('SESSION_INVALID','Öffentliche Sitzung ist ungültig.',401);
  if(!p.exp||Date.now()>=Number(p.exp))throw error('SESSION_EXPIRED','Öffentliche Sitzung ist abgelaufen.',401);return p;
}
async function resolveSession(session,expectedKind){ const p=verifySession(session,expectedKind),got=await getByHash(p.environment,p.kind,p.th,{allowUsed:true}); if(got.record.subjectId!==p.subjectId)throw error('SESSION_INVALID','Öffentliche Sitzung ist ungültig.',401); return {payload:p,record:got.record,environment:p.environment,tokenHash:p.th}; }

module.exports={CONTAINER,ROOT,MAX_FAILED_ATTEMPTS,LOCK_MS,SESSION_MS,text,lower,now,clone,error,body,json,environment,normalizeEnvironment,normalizeKind,hashToken,tokenValid,issue,resolve,consume,revokeSubject,registerFailure,clearFailures,getByHash,issueSession,verifySession,resolveSession,assertUsable};
