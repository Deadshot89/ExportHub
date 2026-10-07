'use strict';

const crypto=require('crypto');
const https=require('https');
const {createBlobServiceClient}=require('../shared/blob-rest');
const {TARGET_REFS,inspectHistoricMailDescriptions,cleanHistoricMailDescriptions}=require('../shared/rc1453-mail-contamination-cleanup');

const TEAM_CONTAINER=process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data';
const TEAM_BLOB=process.env.EXPORTHUB_STORAGE_BLOB||process.env.EXPORTHUB_STATE_BLOB||'team-state.json';
const REPO='Deadshot89/ExportHub';
const WORKFLOW='rc1453-mail-cleanup.yml';
const OIDC_ISSUER='https://token.actions.githubusercontent.com';
const OIDC_JWKS_URL='https://token.actions.githubusercontent.com/.well-known/jwks';
const OIDC_AUDIENCE='exporthub-rc1453-mail-cleanup';
// Exact production records covered by this emergency repair: 7YJUPL and 4UXU92.
let oidcCache={expiresAt:0,keys:[]};

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function now(){return new Date().toISOString()}
function json(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)}}
function error(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e}
function body(req){if(req&&req.body&&typeof req.body==='object')return req.body;try{return JSON.parse(req&&req.body||'{}')}catch(_){return{}}}
function header(req,name){const h=req&&req.headers||{};return h[name.toLowerCase()]||h[name]||''}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.EXPORTHUB_STORAGE_CONNECTION||process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value))}
function environmentOf(req,payload){
  const environment=lower(payload&&payload.environment||header(req,'x-exporthub-environment')||'production');
  const host=lower(header(req,'x-forwarded-host')||header(req,'x-original-host')||header(req,'host'));
  if(environment!=='production')throw error('PRODUCTION_ONLY','RC1453 darf ausschließlich auf dem Produktions-State ausgeführt werden.',403);
  if(/-testservice\./.test(host))throw error('PRODUCTION_ONLY','RC1453 darf nicht über den TESTSERVICE-Host ausgeführt werden.',403);
  return environment;
}
function service(){
  const cs=connectionString();
  if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);
  return createBlobServiceClient(cs);
}
async function readBuffer(blob){
  const response=await blob.download(0),chunks=[];
  for await(const chunk of response.readableStreamBody)chunks.push(Buffer.from(chunk));
  return{buffer:Buffer.concat(chunks),etag:response.etag||null};
}
async function readJson(blob){
  const read=await readBuffer(blob);let value;
  try{value=JSON.parse(read.buffer.toString('utf8'))}catch(_){throw error('STATE_JSON_INVALID','Der Produktions-State ist nicht lesbar.',500)}
  return{value,etag:read.etag,bytes:read.buffer.length};
}
async function uploadTeam(blob,value,etag){
  const raw=JSON.stringify(value),bytes=Buffer.byteLength(raw);
  const result=await blob.upload(raw,bytes,{
    blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},
    conditions:{ifMatch:etag},
    metadata:{
      schema:String(value&&value.schemaVersion||3),
      revision:String(value&&value.revision||0),
      clientversion:'RC1453-mail-cleanup',
      updatedepoch:String(Date.parse(value&&value.updatedAt||'')||Date.now())
    }
  });
  return{etag:result&&result.etag||null,bytes};
}
function httpsJson(url){
  return new Promise((resolve,reject)=>{
    const request=https.request(url,{method:'GET',headers:{Accept:'application/json','User-Agent':'ExportHUB-RC1453'}},response=>{
      const chunks=[];
      response.on('data',chunk=>chunks.push(Buffer.from(chunk)));
      response.on('end',()=>{
        const raw=Buffer.concat(chunks).toString('utf8');
        if(response.statusCode>=200&&response.statusCode<300){try{return resolve(JSON.parse(raw||'{}'))}catch(e){return reject(e)}}
        reject(error('OIDC_JWKS_FAILED','GitHub OIDC-Schlüssel konnten nicht geladen werden.',502));
      });
    });
    request.on('error',reject);request.end();
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
    if(text(claims.event_name)!=='workflow_run')return false;
    if(text(claims.workflow_ref)!==REPO+'/.github/workflows/'+WORKFLOW+'@refs/heads/main')return false;
    if(!Number(claims.exp)||Number(claims.exp)<=at-30)return false;
    if(Number(claims.nbf||0)>at+60||Number(claims.iat||0)>at+60||Number(claims.iat||0)<at-900)return false;
    if(!oidcCache.keys.length||oidcCache.expiresAt<Date.now()){
      const jwks=await httpsJson(OIDC_JWKS_URL);
      oidcCache={expiresAt:Date.now()+10*60*1000,keys:Array.isArray(jwks.keys)?jwks.keys:[]};
    }
    const jwk=oidcCache.keys.find(key=>key&&key.kid===jose.kid&&key.kty==='RSA');if(!jwk)return false;
    const key=crypto.createPublicKey({key:jwk,format:'jwk'});
    return crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,Buffer.from(parts[2],'base64url'));
  }catch(_){return false}
}
async function createVerifiedBackup(container,current){
  const at=now(),stamp=at.replace(/[:.]/g,'-');
  const name='recovery-backups/team-state-before-RC1453-mail-cleanup-'+stamp+'.json';
  const raw=JSON.stringify(current),bytes=Buffer.byteLength(raw),sha256=crypto.createHash('sha256').update(raw).digest('hex');
  const blob=container.getBlockBlobClient(name);
  const uploaded=await blob.upload(raw,bytes,{
    blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},
    conditions:{ifNoneMatch:'*'},
    metadata:{purpose:'rc1453-mail-contamination-cleanup-backup',sha256}
  });
  const properties=await blob.getProperties();
  const readBack=await readBuffer(blob),readBackHash=crypto.createHash('sha256').update(readBack.buffer).digest('hex');
  const storedHash=text(properties&&properties.metadata&&properties.metadata.sha256);
  if(!uploaded||!uploaded.etag||!properties||!properties.etag||storedHash!==sha256||readBack.buffer.length!==bytes||readBackHash!==sha256){
    throw error('BACKUP_VERIFY_FAILED','RC1453 hat den Produktions-State nicht verändert, weil das Sicherheitsbackup nicht verifiziert werden konnte.',500);
  }
  return{name,bytes,sha256,readBackVerified:true};
}
function targetSummary(report){
  const out={};
  for(const ref of TARGET_REFS){
    const row=report&&report.targets&&report.targets[ref]||{};
    out[ref]={found:row.found===true,occurrences:Number(row.occurrences||0),contaminatedFields:Number(row.contaminatedFields||0),collections:row.collections||{}};
  }
  return out;
}

module.exports=async function(context,req){
  try{
    if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
    if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'});return}
    if(!await githubOidcAuthorized(req))throw error('WORKFLOW_REQUIRED','RC1453 darf nur vom signierten Produktions-Reparaturworkflow ausgeführt werden.',403);
    const payload=body(req),environment=environmentOf(req,payload);
    if(environment!=='production')throw error('PRODUCTION_ONLY','RC1453 ist ausschließlich für Produktion freigegeben.',403);

    const container=service().getContainerClient(TEAM_CONTAINER);
    const blob=container.getBlockBlobClient(TEAM_BLOB);
    const currentRead=await readJson(blob),current=currentRead.value;
    const before=inspectHistoricMailDescriptions(current);
    const missing=TARGET_REFS.filter(ref=>!before.targets[ref]||before.targets[ref].found!==true);
    if(missing.length)throw error('MAIL_CLEANUP_TARGET_NOT_FOUND','RC1453 konnte die Produktionssendung(en) '+missing.join(', ')+' nicht im Team-State finden.',409);

    if(before.contaminatedFields===0){
      context.res=json(200,{ok:true,environment,applied:false,noChange:true,verified:before.verified===true,backupVerified:false,revision:Number(current&&current.revision||0),targets:targetSummary(before)});
      return;
    }

    const backup=await createVerifiedBackup(container,current);
    const working=clone(current),at=now();
    const repair=cleanHistoricMailDescriptions(working,{at,actor:'RC1453 GitHub Workflow'});
    if(!repair.changed||repair.clearedFields<=0)throw error('MAIL_CLEANUP_NO_PROGRESS','RC1453 hat die erkannte Mail-Verunreinigung nicht verändern können.',500);
    if(!repair.verified)throw error('MAIL_CLEANUP_PREWRITE_VERIFY_FAILED','RC1453 hat den bereinigten State vor dem Speichern nicht verifizieren können.',500);

    working.schemaVersion=Math.max(3,Number(working&&working.schemaVersion||3));
    working.revision=Number(current&&current.revision||0)+1;
    working.updatedAt=at;
    working.updatedBy='RC1453 GitHub Workflow';
    working.updatedByUserId=null;
    working.updatedByDevice='github-actions';
    working.clientVersion='RC1453-mail-cleanup';
    if(working.state&&typeof working.state==='object'){
      working.state.rc1453MailCleanup={version:'RC1453',at,actor:'RC1453 GitHub Workflow',refs:[...TARGET_REFS],clearedFields:repair.clearedFields,backupBlob:backup.name};
    }

    let uploaded;
    try{uploaded=await uploadTeam(blob,working,currentRead.etag)}
    catch(e){
      if(e&&(e.statusCode===409||e.statusCode===412))throw error('CONCURRENT_UPDATE','Der Produktions-State wurde während RC1453 geändert. Der Reparatur-Write wurde sicher abgebrochen.',409);
      throw e;
    }

    const verifiedRead=await readJson(blob),after=inspectHistoricMailDescriptions(verifiedRead.value);
    if(!after.verified||TARGET_REFS.some(ref=>!after.targets[ref].found||after.targets[ref].contaminatedFields!==0)){
      throw error('MAIL_CLEANUP_VERIFY_FAILED','RC1453 konnte nicht bestätigen, dass 7YJUPL und 4UXU92 dauerhaft frei von Lieferavis-/Mailtext sind.',500);
    }

    context.res=json(200,{
      ok:true,
      environment,
      applied:true,
      verified:true,
      backupVerified:backup.readBackVerified===true,
      backupBlob:backup.name,
      backupBytes:backup.bytes,
      revision:Number(verifiedRead.value&&verifiedRead.value.revision||0),
      clearedFields:repair.clearedFields,
      changedShipments:repair.changedShipments,
      uploadedBytes:uploaded.bytes,
      targets:targetSummary(after)
    });
  }catch(e){
    try{context.log&&context.log.error&&context.log.error('RC1453 mail cleanup error',e&&e.code,e&&e.message)}catch(_){}
    context.res=json(Number(e&&e.status||e&&e.statusCode||500),{ok:false,code:e&&e.code||'SERVER_ERROR',message:e&&e.message||'RC1453 Produktionsbereinigung fehlgeschlagen.'});
  }
};
