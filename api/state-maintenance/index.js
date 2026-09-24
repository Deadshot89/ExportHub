'use strict';

const crypto=require('crypto');
const https=require('https');
const {createBlobServiceClient}=require('../shared/blob-rest');
const {DOCUMENT_CONTAINER,migrateLegacyDocuments,legacyDocumentInventory}=require('../shared/document-blob-store');
const {previewCompaction,buildAppliedDocument}=require('../shared/state-maintenance');
const {CLEANUP_DATE,countPalletDay,cleanupPalletDay}=require('../shared/pallet-account-cleanup');
const {verifyStateRestore}=require('../shared/state-restore-drill');
const {createVerifiedSnapshot}=require('../shared/state-backup-lifecycle');

const TEAM_CONTAINER=process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data';
const TEAM_BLOB=process.env.EXPORTHUB_STORAGE_BLOB||process.env.EXPORTHUB_STATE_BLOB||'team-state.json';
const TEST_TEAM_BLOB=process.env.EXPORTHUB_TEST_STORAGE_BLOB||('testservice/'+String(TEAM_BLOB).replace(/^\/+/,'')); 
const REPO='Deadshot89/ExportHub';
const COMPACTION_WORKFLOW='rc1137-state-compaction.yml';
const BACKUP_WORKFLOW='rc1267-state-backup.yml';
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
 const clientVersion=text(value&&value.clientVersion)||'RC1137-state-compaction';
 const result=await blob.upload(raw,bytes,{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions:{ifMatch:etag},metadata:{schema:String(value.schemaVersion||3),revision:String(value.revision||0),clientversion:clientVersion.replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80),updatedepoch:String(Date.parse(value.updatedAt||'')||Date.now())}});
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
  if(claims.repository!==REPO||claims.ref!=='refs/heads/main')return false;
  const workflowRef=text(claims.workflow_ref),eventName=text(claims.event_name);
  const compactionAllowed=eventName==='workflow_run'&&workflowRef===REPO+'/.github/workflows/'+COMPACTION_WORKFLOW+'@refs/heads/main';
  const backupAllowed=['workflow_run','schedule','workflow_dispatch'].includes(eventName)&&workflowRef===REPO+'/.github/workflows/'+BACKUP_WORKFLOW+'@refs/heads/main';
  if(!compactionAllowed&&!backupAllowed)return false;
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
async function createVerifiedBackup(container,env,current,options={}){
 const marker=text(options.marker)||'RC1137-compaction';
 const purpose=text(options.purpose)||'rc1137-state-compaction-backup';
 const stamp=now().replace(/[:.]/g,'-'),name=recoveryPrefix(env)+'team-state-before-'+marker+'-'+stamp+'.json';
 const raw=JSON.stringify(current),bytes=Buffer.byteLength(raw),hash=crypto.createHash('sha256').update(raw).digest('hex');
 const blob=container.getBlockBlobClient(name);
 const uploaded=await blob.upload(raw,bytes,{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions:{ifNoneMatch:'*'},metadata:{purpose,sha256:hash}});
 const properties=await blob.getProperties(),storedHash=text(properties&&properties.metadata&&properties.metadata.sha256);
 const readBack=await readBuffer(blob),readBackHash=crypto.createHash('sha256').update(readBack.buffer).digest('hex');
 if(!uploaded||!uploaded.etag||!properties||!properties.etag||storedHash!==hash||readBack.buffer.length!==bytes||readBackHash!==hash)throw error('BACKUP_VERIFY_FAILED','Das Sicherungsbackup konnte nicht vollständig zurückgelesen und verifiziert werden.',500);
 return{name,bytes,sha256:hash,readBackVerified:true};
}
async function runRestoreDrill(container,env,current){
 if(env!=='testservice')throw error('TESTSERVICE_ONLY','Der Restore-Drill ist ausschließlich im TESTSERVICE freigegeben.',403);
 const backup=await createVerifiedBackup(container,env,current,{marker:'RC1234-restore-drill',purpose:'rc1234-state-restore-drill-source'});
 const sourceBlob=container.getBlockBlobClient(backup.name),source=await readBuffer(sourceBlob);
 const restoreName='testservice/recovery-drills/team-state-restore-drill-latest.json',restoreBlob=container.getBlockBlobClient(restoreName);
 await restoreBlob.upload(source.buffer,source.buffer.length,{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},metadata:{purpose:'rc1234-state-restore-drill',sha256:backup.sha256}});
 const restored=await readBuffer(restoreBlob),verified=verifyStateRestore(source.buffer,restored.buffer);
 if(!verified||verified.verified!==true)throw error('RESTORE_DRILL_VERIFY_FAILED','Der TESTSERVICE-Restore-Drill konnte die Wiederherstellung nicht bestätigen.',500);
 return{ok:true,restoreDrill:true,verified:true,environment:env,backupBlob:backup.name,backupReadBackVerified:backup.readBackVerified===true,restoreBlob:restoreName,bytes:verified.bytes,sha256:verified.sha256,revision:verified.revision,shipmentReferenceCount:verified.shipmentReferenceCount,shipmentReferencesVerified:verified.shipmentReferencesVerified===true};
}

async function migrateTestserviceDocuments(container,blob,currentRead){
 const current=currentRead.value;
 const initial=legacyDocumentInventory(current);
 if(initial.found===0){
  return{ok:true,migrated:false,noChange:true,environment:'testservice',found:0,migratedCount:0,remaining:0,bytesMoved:0,batches:0,beforeBytes:currentRead.bytes,afterBytes:currentRead.bytes,backupVerified:false};
 }
 const backup=await createVerifiedBackup(container,'testservice',current,{marker:'RC1138-document-migration',purpose:'rc1138-document-migration-backup'});
 const documentContainer=service().getContainerClient(DOCUMENT_CONTAINER);
 let working=current,totalMigrated=0,totalBytesMoved=0,batches=0;
 while(true){
  const before=legacyDocumentInventory(working);
  if(before.found===0)break;
  if(batches>=20)throw error('MIGRATION_BATCH_LIMIT','RC1138 hat das sichere Batch-Limit erreicht und den Team-State nicht verändert.',409);
  const result=await migrateLegacyDocuments(working,{environment:'testservice',limit:10,container:documentContainer});
  if(Number(result.migrated||0)<=0&&Number(result.remaining||0)>0)throw error('MIGRATION_NO_PROGRESS','RC1138 konnte die verbliebenen Inline-Dokumente nicht verifiziert in Blob Storage übernehmen. Der Team-State wurde nicht verändert.',409);
  working=result.state;
  totalMigrated+=Number(result.migrated||0);
  totalBytesMoved+=Number(result.bytesMoved||0);
  batches++;
 }
 const finalInventory=legacyDocumentInventory(working);
 if(finalInventory.found!==0)throw error('MIGRATION_INCOMPLETE','RC1138 hat nicht alle Inline-Dokumente migriert. Der Team-State wurde nicht verändert.',409);
 const at=now();
 working.schemaVersion=Math.max(3,Number(working&&working.schemaVersion||3));
 working.revision=Number(current&&current.revision||0)+1;
 working.updatedAt=at;
 working.updatedBy='RC1138 GitHub Workflow';
 working.updatedByUserId=null;
 working.updatedByDevice='github-actions';
 working.clientVersion='RC1138-document-migration';
 working.documentMigrationAudit={version:'RC1138',at,actor:'RC1138 GitHub Workflow',environment:'testservice',backupBlob:backup.name,found:initial.found,migrated:totalMigrated,bytesMoved:totalBytesMoved,batches};
 let uploaded;
 const currentEtag=currentRead.etag;
 try{uploaded=await uploadTeam(blob,working,currentEtag)}
 catch(e){if(e&&(e.statusCode===409||e.statusCode===412))throw error('CONCURRENT_UPDATE','Der TESTSERVICE-Team-State wurde während der Dokumentmigration geändert. RC1138 hat den State-Write sicher abgebrochen.',409);throw e}
 return{ok:true,migrated:true,environment:'testservice',found:initial.found,migratedCount:totalMigrated,remaining:0,bytesMoved:totalBytesMoved,batches,beforeBytes:currentRead.bytes,afterBytes:uploaded.bytes,backupBlob:backup.name,backupBytes:backup.bytes,backupVerified:true};
}

async function cleanupProductionPalletDay(container,blob,currentRead){
 const current=currentRead.value;
 const prepared=cleanupPalletDay(current,{date:CLEANUP_DATE,actor:'RC1208 GitHub Workflow',at:now()});
 if(!prepared.changed){
  const remaining=countPalletDay(current,CLEANUP_DATE);
  return{ok:true,applied:false,noChange:true,verified:remaining===0,environment:'production',date:CLEANUP_DATE,deletedCount:0,totalDeleted:Number(prepared.totalDeleted||0),remaining,revision:Number(current&&current.revision||0),marker:prepared.marker||null,backupVerified:false};
 }
 const backup=await createVerifiedBackup(container,'production',current,{marker:'RC1208-pallet-cleanup',purpose:'rc1208-pallet-account-cleanup-backup'});
 let uploaded;
 try{uploaded=await uploadTeam(blob,prepared.team,currentRead.etag)}
 catch(e){if(e&&(e.statusCode===409||e.statusCode===412))throw error('CONCURRENT_UPDATE','Der Produktions-State wurde während der Palettenkonto-Bereinigung geändert. RC1208 hat den Write sicher abgebrochen.',409);throw e}
 const verifiedRead=await readJson(blob),remaining=countPalletDay(verifiedRead.value,CLEANUP_DATE);
 const marker=verifiedRead.value&&verifiedRead.value.state&&verifiedRead.value.state.rc1207PalletCleanup20260921At||null;
 if(remaining!==0||!marker||text(marker.date)!==CLEANUP_DATE)throw error('PALLET_CLEANUP_VERIFY_FAILED','RC1208 konnte die dauerhafte Palettenkonto-Bereinigung nicht bestätigen.',500);
 return{ok:true,applied:true,verified:true,environment:'production',date:CLEANUP_DATE,deletedCount:Number(prepared.deletedCount||0),totalDeleted:Number(marker.deletedCount||prepared.totalDeleted||0),remaining,revision:Number(verifiedRead.value&&verifiedRead.value.revision||0),marker,afterBytes:verifiedRead.bytes,backupBlob:backup.name,backupBytes:backup.bytes,backupVerified:true,uploadedBytes:uploaded.bytes};
}

module.exports=async function(context,req){
 try{
  if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
  if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'});return}
  if(!await githubOidcAuthorized(req))throw error('GLOBAL_ADMIN_OR_WORKFLOW_REQUIRED','RC1137 darf nur durch den signierten GitHub-Wartungsworkflow ausgeführt werden.',403);
  const payload=body(req),action=lower(payload.action),environment=environmentOf(req,payload);
  if(action!=='preview'&&action!=='apply'&&action!=='migrate-testservice-documents'&&action!=='cleanup-pallet-20260921'&&action!=='restore-drill'&&action!=='scheduled-backup')throw error('ACTION_INVALID','Erlaubt sind preview, apply, migrate-testservice-documents, cleanup-pallet-20260921, restore-drill und scheduled-backup.',400);
  if(action==='migrate-testservice-documents'&&environment!=='testservice')throw error('TESTSERVICE_ONLY','Die RC1138-Dokumentmigration ist ausschließlich im TESTSERVICE freigegeben.',403);
  if(action==='restore-drill'&&environment!=='testservice')throw error('TESTSERVICE_ONLY','Der RC1234-Restore-Drill ist ausschließlich im TESTSERVICE freigegeben.',403);
  if(action==='cleanup-pallet-20260921'&&environment!=='production')throw error('PRODUCTION_ONLY','Die RC1208-Palettenkonto-Bereinigung ist ausschließlich in Produktion freigegeben.',403);
  const container=service().getContainerClient(TEAM_CONTAINER),blob=container.getBlockBlobClient(teamBlobName(environment));
  const currentRead=await readJson(blob),current=currentRead.value;
  if(action==='scheduled-backup'){
   const result=await createVerifiedSnapshot(container,{environment,tier:lower(payload.tier),current,at:now()});
   context.res=json(200,result);
   return;
  }
  if(action==='restore-drill'){
   context.res=json(200,await runRestoreDrill(container,environment,current));
   return;
  }
  if(action==='migrate-testservice-documents'){
   context.res=json(200,await migrateTestserviceDocuments(container,blob,currentRead));
   return;
  }
  if(action==='cleanup-pallet-20260921'){
   context.res=json(200,await cleanupProductionPalletDay(container,blob,currentRead));
   return;
  }
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
  try{context.log&&context.log.error&&context.log.error('RC1137/RC1138 state maintenance error',e&&e.code,e&&e.message)}catch(_){}
  context.res=json(Number(e&&e.status||e&&e.statusCode||500),{ok:false,code:e&&e.code||'SERVER_ERROR',message:e&&e.message||'ExportHUB Wartung fehlgeschlagen.'});
 }
};
