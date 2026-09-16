'use strict';

const crypto=require('crypto');
const https=require('https');
const {createBlobServiceClient}=require('../shared/blob-rest');
const {previewCompaction,buildAppliedDocument}=require('../shared/state-maintenance');

const TEAM_CONTAINER=process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data';
const TEAM_BLOB=process.env.EXPORTHUB_STORAGE_BLOB||process.env.EXPORTHUB_STATE_BLOB||'team-state.json';
const TEST_TEAM_BLOB=process.env.EXPORTHUB_TEST_STORAGE_BLOB||('testservice/'+String(TEAM_BLOB).replace(/^\/+/,'')); 
const REPO='Deadshot89/ExportHub';
const WORKFLOW='rc1137-state-compaction.yml';
const OIDC_ISSUER='https://token.actions.githubusercontent.com';
const OIDC_JWKS_URL='https://token.actions.githubusercontent.com/.well-known/jwks';
const OIDC_AUDIENCE='exporthub-state-compaction';
let oidcCache={expiresAt:0,keys:[]};

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function now(){return new Date().toISOString()}
function json(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)}}
function error(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e}
function body(req){if(req&&req.body&&typeof req.body==='object')return req.body;try{return JSON.parse(req&&req.body||'{}')}catch(_){return{}}}
function header(req,name){const h=req&&req.headers||{};return h[name.toLowerCase()]||h[name]||''}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.EXPORTHUB_STORAGE_CONNECTION||process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
function environmentOf(req,payload){
 const raw=lower(payload&&payload.environment||header(req,'x-exporthub-environment'));
 const host=lower(header(req,'x-forwarded-host')||header(req,'x-original-host')||header(req,'host'));
 const hostTest=/-testservice\./.test(host),hostAzure=/\.azurestaticapps\.net(?:[:/]|$)/.test(host),hostProd=hostAzure&&!hostTest;
 if(raw&&raw!=='production'&&raw!=='testservice')throw error('ENVIRONMENT_INVALID','Unbekannte ExportHUB-Umgebung.',400);
 if(hostTest&&raw&&raw!=='testservice')throw error('ENVIRONMENT_MISMATCH','TESTSERVICE darf keine Produktionsdaten warten.',409);
 if(hostProd&&raw&&raw!=='production')throw error('ENVIRONMENT_MISMATCH','Produktion darf keine TESTSERVICE-Daten warten.',409);
 return raw||(hostTest?'testservice':'production');
}
function teamBlobName(env){return env==='testservice'?TEST_TEAM_BLOB:TEAM_BLOB}
function recoveryPrefix(env){return env==='testservice'?'testservice/recovery-backups/':'recovery-backups/'}
function service(){
 const cs=connectionString();if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);
 return createBlobServiceClient(cs);
}
async function readBuffer(blob){
 const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));
 return{buffer:Buffer.concat(chunks),etag:r.etag||null};
}
async function readJson(blob){
 const r=await readBuffer(blob);let value;
 try{value=JSON.parse(r.buffer.toString('utf8'))}catch(_){throw error('STATE_JSON_INVALID','Der Team-State ist nicht lesbar.',500)}
 return{value,etag:r.etag,bytes:r.buffer.length,raw:r.buffer};
}
async function uploadTeam(blob,value,etag){
 const raw=JSON.stringify(value),bytes=Buffer.byteLength(raw);
 const result=await blob.upload(raw,bytes,{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions:{ifMatch:etag},metadata:{schema:String(value.schemaVersion||3),revision:String(value.revision||0),clientversion:'RC1137-state-compaction',updatedepoch:String(Date.parse(value.updatedAt||'')||Date.now())}});
 return{etag:result&&result.etag||null,bytes};
}
function httpsJson(url){
 return new Promise((resolve,reject)=>{
  const req=https.request(url,{method:'GET',headers:{Accept:'application/json','User-Agent':'ExportHUB-RC1137'}},res=>{
   const chunks=[];res.on('data',c=>chunks.push(Buffer.from(c)));res.on('end',()=>{const raw=Buffer.concat(chunks).toString('utf8');if(res.statusCode>=200&&res.statusCode<300){try{return resolve(JSON.parse(raw||'{}'))}catch(e){return reject(e)}}reject(error('OIDC_JWKS_FAILED','GitHub OIDC-Schlüssel konnten nicht geladen werden.',502))});
  });
  req.on('error',reject);req.end();
 });
}
async function githubOidcAuthorized(req){
 const token=text(header(req,'x-exporthub-github-oidc'));if(!token)return false;
 try{
  const parts=token.split('.');if(parts.length!==3)return false;
  const jose=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
  const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  if(jose.alg!=='RS256'||!text(jose.kid))return false;
  const at=Math.floor(Date.now()/1000),aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(claims.iss!==OIDC_ISSUER||!aud.includes(OIDC_AUDIENCE))return false;
  if(claims.repository!==REPO||claims.ref!=='refs/heads/main'||claims.event_name!=='workflow_run')return false;
  if(claims.workflow_ref!==REPO+'/.github/workflows/'+WORKFLOW+'@refs/heads/main')return false;
  if(!Number(claims.exp)||Number(claims.exp)<=at-30)return false;
  if(Number(claims.nbf||0)>at+60||Number(claims.iat||0)>at+60||Number(claims.iat||0)<at-900)return false;
  if(!oidcCache.keys.length||oidcCache.expiresAt<Date.now()){
   const jwks=await httpsJson(OIDC_JWKS_URL);oidcCache={expiresAt:Date.now()+10*60*1000,keys:Array.isArray(jwks.keys)?jwks.keys:[]};
  }
  const jwk=oidcCache.keys.find(k=>k&&k.kid===jose.kid&&k.kty==='RSA');if(!jwk)return false;
  const key=crypto.createPublicKey({key:jwk,format:'jwk'});
  return crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,Buffer.from(parts[2],'base64url'));
 }catch(_){return false}
}
async function createVerifiedBackup(container,env,current){
 const stamp=now().replace(/[:.]/g,'-'),name=recoveryPrefix(env)+'team-state-before-RC1137-compaction-'+stamp+'.json';
 const raw=JSON.stringify(current),hash=crypto.createHash('sha256').update(raw).digest('hex');
 const blob=container.getBlockBlobClient(name);
 await blob.upload(raw,Buffer.byteLength(raw),{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions:{ifNoneMatch:'*'},metadata:{purpose:'rc1137-state-compaction-backup',sha256:hash}});
 const verify=await readBuffer(blob),verifyHash=crypto.createHash('sha256').update(verify.buffer).digest('hex');
 if(verifyHash!==hash||verify.buffer.length!==Buffer.byteLength(raw))throw error('BACKUP_VERIFY_FAILED','Das RC1137-Sicherungsbackup konnte nicht verifiziert werden.',500);
 return{name,bytes:verify.buffer.length,sha256:hash};
}

module.exports=async function(context,req){
 try{
  if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
  if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'});return}
  if(!await githubOidcAuthorized(req))throw error('GLOBAL_ADMIN_OR_WORKFLOW_REQUIRED','RC1137 darf nur durch den signierten GitHub-Wartungsworkflow ausgeführt werden.',403);
  const payload=body(req),action=lower(payload.action),environment=environmentOf(req,payload);
  if(action!=='preview'&&action!=='apply')throw error('ACTION_INVALID','Erlaubt sind preview und apply.',400);
  const container=service().getContainerClient(TEAM_CONTAINER),blob=container.getBlockBlobClient(teamBlobName(environment));
  const currentRead=await readJson(blob),current=currentRead.value;
  const preview=previewCompaction(current);
  if(action==='preview'){
   context.res=json(200,{ok:true,preview:true,environment,revision:Number(current&&current.revision||0),changed:preview.changed,beforeBytes:preview.beforeBytes,afterBytes:preview.afterBytes,savedBytes:preview.savedBytes,savedPercent:preview.beforeBytes?Number((preview.savedBytes/preview.beforeBytes*100).toFixed(2)):0});
   return;
  }
  if(action==='apply'){
   if(!preview.changed){
    context.res=json(200,{ok:true,applied:false,noChange:true,environment,revision:Number(current&&current.revision||0),beforeBytes:preview.beforeBytes,afterBytes:preview.afterBytes,savedBytes:0});
    return;
   }
   const backup=await createVerifiedBackup(container,environment,current);
   const next=buildAppliedDocument(current,preview,{backupBlob:backup.name,actor:'RC1137 GitHub Workflow',at:now()});
   let uploaded;
   try{uploaded=await uploadTeam(blob,next,currentRead.etag)}
   catch(e){if(e&&(e.statusCode===409||e.statusCode===412))throw error('CONCURRENT_UPDATE','Der Team-State wurde während der Wartung geändert. RC1137 hat den produktiven Write sicher abgebrochen.',409);throw e}
   context.res=json(200,{ok:true,applied:true,environment,revision:Number(next.revision||0),beforeBytes:preview.beforeBytes,previewAfterBytes:preview.afterBytes,afterBytes:uploaded.bytes,savedBytes:Math.max(0,preview.beforeBytes-uploaded.bytes),backupBlob:backup.name,backupBytes:backup.bytes,backupVerified:true});
   return;
  }
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('RC1137 state maintenance error',e&&e.code,e&&e.message)}catch(_){}
  context.res=json(Number(e&&e.status||e&&e.statusCode||500),{ok:false,code:e&&e.code||'SERVER_ERROR',message:e&&e.message||'RC1137 Wartung fehlgeschlagen.'});
 }
};
