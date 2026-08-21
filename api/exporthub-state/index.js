
'use strict';

const crypto = require('crypto');
const { createBlobServiceClient } = require('../shared/blob-rest');
const { mergeState, sanitizeState, pruneTombstones, clone } = require('../shared/merge');

const TEAM_CONTAINER = process.env.EXPORTHUB_STORAGE_CONTAINER || process.env.EXPORTHUB_CONTAINER || 'exporthub-data';
const TEAM_BLOB_BASE = process.env.EXPORTHUB_STORAGE_BLOB || process.env.EXPORTHUB_STATE_BLOB || 'team-state.json';
const TEST_TEAM_BLOB = process.env.EXPORTHUB_TEST_STORAGE_BLOB || ('testservice/'+String(TEAM_BLOB_BASE||'team-state.json').replace(/^\/+/, ''));
const AUTH_BLOB = process.env.EXPORTHUB_AUTH_BLOB || 'auth-sessions.json';
const MAX_RETRIES = 6;
const API_VERSION = 'RC858';

function text(v){ return String(v == null ? '' : v).trim(); }
function lower(v){ return text(v).toLowerCase(); }
function now(){ return new Date().toISOString(); }
function error(code,message,status=400){ const e=new Error(message); e.code=code; e.status=status; return e; }
function json(status,body,headers={}){ return {status,headers:Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},headers),body:JSON.stringify(body)}; }
function body(req){ if(req&&req.body&&typeof req.body==='object')return req.body; try{return JSON.parse(req&&req.body||'{}')}catch(_){return {}} }
function connectionString(){ return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.EXPORTHUB_STORAGE_CONNECTION || process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING || ''; }
function requestHost(req){
 const h=req&&req.headers||{};
 return lower(h['x-forwarded-host']||h['X-Forwarded-Host']||h['x-original-host']||h['X-Original-Host']||h.host||h.Host||'');
}
function requestEnvironmentEvidence(req){
 const h=req&&req.headers||{};
 return [h.origin,h.Origin,h.referer,h.Referer,h['x-forwarded-host'],h['X-Forwarded-Host'],h['x-original-host'],h['X-Original-Host'],h['x-ms-original-url'],h['X-MS-Original-URL'],h.host,h.Host].map(text).filter(Boolean).join(' ');
}
function requestedEnvironment(req,payload){
 const h=req&&req.headers||{},raw=lower(h['x-exporthub-environment']||h['X-ExportHUB-Environment']||(payload&&payload.environment)||'');
 if(raw&&raw!=='production'&&raw!=='testservice')throw error('ENVIRONMENT_INVALID','Unbekannte ExportHUB-Datenumgebung.',400);
 const evidence=requestEnvironmentEvidence(req),origin=lower(h.origin||h.Origin||h.referer||h.Referer||''),originTest=/-testservice\./i.test(origin),originAzure=/\.azurestaticapps\.net(?:[:/]|$)/i.test(origin),originProd=originAzure&&!originTest;
 if(originTest){if(raw&&raw!=='testservice')throw error('ENVIRONMENT_MISMATCH','Ein Testservice-Aufruf darf keine Produktionsdaten anfordern.',409);return'testservice'}
 if(originProd){if(raw&&raw!=='production')throw error('ENVIRONMENT_MISMATCH','Die Produktionsseite darf keine Testservice-Daten anfordern.',409);return'production'}
 if(raw)return raw;
 return /-testservice\./i.test(evidence)?'testservice':'production';
}
function teamBlobForEnvironment(env){return env==='testservice'?TEST_TEAM_BLOB:TEAM_BLOB_BASE}
function recoveryPrefixForEnvironment(env){return env==='testservice'?'testservice/recovery-backups/':'recovery-backups/'}
function connectionSource(){ if(process.env.EXPORTHUB_STORAGE_CONNECTION_STRING)return 'EXPORTHUB_STORAGE_CONNECTION_STRING'; if(process.env.EXPORTHUB_STORAGE_CONNECTION)return 'EXPORTHUB_STORAGE_CONNECTION'; if(process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING)return 'EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING'; return ''; }
function usernameOf(user){ return lower(user&&(user.user||user.login||user.username||user.name)); }
function isActive(user){ return Boolean(user && user.active!==false && user.disabled!==true && lower(user.status)!=='deaktiviert'); }
function isAdmin(user){
 if(!user)return false;
 if(user.globalAdmin===true||user.isGlobalAdmin===true)return true;
 if(Array.isArray(user.permissions)&&user.permissions.includes('*'))return true;
 const role=lower(user.role||user.rolle);
 return ['globaler administrator','globaler admin','administrator','admin','vollzugriff'].includes(role);
}
function hasAnyEditRight(user){
 if(isAdmin(user))return true;
 return Object.values(user&&user.rights||{}).some(r=>r&&(r.edit===true||r.admin===true||r.functionAdmin===true||r.level==='edit'||r.level==='admin'));
}
function publicUser(user,adminView=false){
 const u=clone(user||{});
 ['password','passwordHash','passwordSalt','passwordIterations','passwordCredential','passwordHistory','temporaryPassword','startPassword'].forEach(k=>delete u[k]);
 if(!adminView)delete u.loginSecurity;
 return u;
}
function publicUsers(users,adminView=false){ return (Array.isArray(users)?users:[]).map(u=>publicUser(u,adminView)); }
function safeEqualText(a,b){ const aa=Buffer.from(String(a||''),'utf8'),bb=Buffer.from(String(b||''),'utf8'); return aa.length===bb.length&&aa.length>0&&crypto.timingSafeEqual(aa,bb); }
function tokenHash(token){ return crypto.createHash('sha256').update(String(token||'')).digest('hex'); }
function sessionSigningSecret(){
 const configured=text(process.env.EXPORTHUB_AUTH_SIGNING_SECRET||process.env.EXPORTHUB_SESSION_SECRET);
 const source=configured||connectionString();
 if(!source)throw error('AUTH_SIGNING_NOT_CONFIGURED','Die sichere Sitzungssignatur ist serverseitig nicht konfiguriert.',503);
 return crypto.createHash('sha256').update('ExportHUB/session/v1|'+source).digest();
}
function signSessionPart(encoded){ return crypto.createHmac('sha256',sessionSigningSecret()).update(encoded).digest('base64url'); }
function verifySignedSessionToken(token){
 const raw=text(token),parts=raw.split('.');
 if(parts.length!==3||parts[0]!=='ehs1'||!parts[1]||!parts[2])return null;
 const expected=signSessionPart(parts[1]);
 if(!safeEqualText(expected,parts[2]))return null;
 let p; try{p=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'))}catch(_){return null}
 if(!p||p.purpose!=='exporthub-session'||Number(p.v||0)!==1||!p.uid||!p.sid||Number(p.exp||0)<=Date.now())return null;
 return p;
}
function bearer(req,payload){
 const h=req&&req.headers||{};
 const dedicated=h['x-exporthub-token']||h['X-ExportHUB-Token']||h['x-exporthub-session']||h['X-ExportHUB-Session'];
 if(text(dedicated))return text(dedicated);
 if(payload&&text(payload.sessionToken))return text(payload.sessionToken);
 const auth=h.authorization||h.Authorization||''; const m=String(auth).match(/^Bearer\s+(.+)$/i); return m?m[1].trim():'';
}
async function clients(req,payload){
 const cs=connectionString();
 if(!cs)throw error('STORAGE_NOT_CONFIGURED','Keine ExportHUB-Speicherverbindung ist in Azure verfügbar.',503);
 let service; try{service=createBlobServiceClient(cs)}catch(e){throw error('STORAGE_NOT_CONFIGURED','Die ExportHUB-Speicherverbindung ist ungültig: '+(e&&e.message||'Konfigurationsfehler'),503)}
 const container=service.getContainerClient(TEAM_CONTAINER),environment=requestedEnvironment(req,payload),teamBlobName=teamBlobForEnvironment(environment);
 return {container,environment,teamBlobName,recoveryPrefix:recoveryPrefixForEnvironment(environment),allowGenericRecoveryDiscovery:environment!=='testservice',team:container.getBlockBlobClient(teamBlobName),productionTeam:container.getBlockBlobClient(TEAM_BLOB_BASE),auth:container.getBlockBlobClient(AUTH_BLOB)};
}
function parseStoredJson(raw,name){
 const cleaned=String(raw==null?'':raw).replace(/^\uFEFF/,'').replace(/\u0000+$/g,'').trim();
 if(!cleaned)return null;
 try{let v=JSON.parse(cleaned);if(typeof v==='string'&&/^[\[{]/.test(v.trim()))v=JSON.parse(v.trim());return v}catch(e){throw error('STORAGE_JSON_INVALID','Die Azure-Datei '+text(name||'unbekannt')+' enthält keine gültigen ExportHUB-Daten.',500)}
}
async function readJson(blob,fallback,repairAuth=false){
 try{
  const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));
  try{const v=parseStoredJson(Buffer.concat(chunks).toString('utf8'),blob&&blob.name);return {value:v==null?clone(fallback):v,etag:r.etag||null}}
  catch(e){e.etag=r.etag||null;if(repairAuth)return {value:clone(fallback),etag:r.etag||null,repairedInvalidJson:true};throw e}
 }catch(e){if(e&&e.statusCode===404)return {value:clone(fallback),etag:null};throw e}
}
async function uploadJson(blob,value,etag){
 const raw=JSON.stringify(value),conditions=etag?{ifMatch:etag}:{ifNoneMatch:'*'},base={blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions};
 const metadata={schema:String(value.schemaVersion||3),revision:String(value.revision||0),updatedepoch:String(Date.parse(value.updatedAt||'')||Date.now()),clientversion:String(value.clientVersion||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)};
 try{return await blob.upload(raw,Buffer.byteLength(raw),Object.assign({},base,{metadata}))}
 catch(e){
  const code=String(e&&e.code||e&&e.details&&e.details.errorCode||'');
  if(Number(e&&e.statusCode||0)===400||/InvalidMetadata|InvalidHeader/i.test(code))return blob.upload(raw,Buffer.byteLength(raw),base);
  throw e;
 }
}
function emptyTeam(){return {schemaVersion:3,revision:0,updatedAt:null,updatedBy:null,state:{},users:[]}}
function emptyAuth(){return {schemaVersion:1,updatedAt:null,sessions:[]}}
function usableTeamDocument(value){return !!(value&&typeof value==='object'&&!Array.isArray(value)&&value.state&&typeof value.state==='object'&&!Array.isArray(value.state)&&Array.isArray(value.users))}
async function latestValidTeamFallback(container,teamBlobName,recoveryPrefix,allowDiscovery){
 let history=[];try{history=await listHistory(container,teamBlobName,recoveryPrefix,allowDiscovery)}catch(_){history=[]}
 for(let i=0;i<history.length&&i<500;i++){
  const source=history[i];
  try{const d=await readJson(historyClient(container,source,teamBlobName),emptyTeam(),false),value=d.value||emptyTeam();if(usableTeamDocument(value)&&value.users.length)return {value,source}}catch(_){}
 }
 return null;
}
async function readTeamResilient(container,blob,teamBlobName,recoveryPrefix,allowDiscovery){
 try{
  const d=await readJson(blob,emptyTeam(),false);
  if(d.etag||usableTeamDocument(d.value))return d;
  const fallback=await latestValidTeamFallback(container,teamBlobName,recoveryPrefix,allowDiscovery);
  return fallback?{value:fallback.value,etag:null,recoveredFromHistory:true,recoverySource:fallback.source,missingCurrent:true}:d;
 }catch(e){
  if(e&&e.code!=='STORAGE_JSON_INVALID')throw e;
  const fallback=await latestValidTeamFallback(container,teamBlobName,recoveryPrefix,allowDiscovery);
  if(!fallback)throw error('STATE_CORRUPT_NO_BACKUP','Der aktuelle Azure-Teamstand ist beschädigt und es wurde keine lesbare historische Sicherung gefunden.',500);
  return {value:fallback.value,etag:e&&e.etag||null,recoveredFromHistory:true,recoverySource:fallback.source,corruptCurrent:true};
 }
}
async function readTeamFast(blob){
 try{
  const d=await readJson(blob,emptyTeam(),false);
  if(d.etag||usableTeamDocument(d.value))return d;
  throw error('STATE_MISSING','Der aktuelle Azure-Teamstand fehlt. Die Historienrettung wird im normalen Lese-/Speicherpfad nicht automatisch gestartet.',503);
 }catch(e){
  if(e&&e.code==='STORAGE_JSON_INVALID')throw error('STATE_CORRUPT_RECOVERY_REQUIRED','Der aktuelle Azure-Teamstand ist beschädigt. Bitte die explizite Wiederherstellung verwenden; normale Speichervorgänge wurden gestoppt.',503);
  throw e;
 }
}
async function ensureEnvironmentTeam(c){
 if(!c||c.environment!=='testservice')return false;
 const existing=await readJson(c.team,emptyTeam(),false);
 if(existing.etag)return false;
 const prod=await readJson(c.productionTeam,emptyTeam(),false),base=prod.value||emptyTeam();
 if(!usableTeamDocument(base))throw error('TEST_STATE_SEED_FAILED','Der Testservice konnte keinen gültigen Produktions-Ausgangsstand lesen.',503);
 const next=clone(base);next.schemaVersion=Math.max(3,Number(next.schemaVersion||3));next.revision=1;next.updatedAt=now();next.updatedBy='Testservice Initialisierung';next.updatedByUserId=null;next.updatedByDevice=null;next.clientVersion='RC855-testservice-seed';next.dataEnvironment='testservice';next.state=isObj(next.state)?clone(next.state):{};next.state._exporthubEnvironment={name:'testservice',isolated:true,seededAt:next.updatedAt,sourceBlob:TEAM_BLOB_BASE};
 try{await uploadJson(c.team,next,null);return true}catch(e){if(Number(e&&e.statusCode||0)===409||Number(e&&e.statusCode||0)===412)return false;throw e}
}
async function safetyRawBackup(container,blob,label,recoveryPrefix){
 try{
  const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));
  const raw=Buffer.concat(chunks);if(!raw.length)return null;
  const stamp=now().replace(/[:.]/g,'-'),name=(cleanScalar(recoveryPrefix)||'recovery-backups/')+String(label||'raw-team-state').replace(/[^A-Za-z0-9_.-]+/g,'-')+'-'+stamp+'.json.raw';
  const backup=container.getBlockBlobClient(name);await backup.upload(raw,raw.length,{blobHTTPHeaders:{blobContentType:'application/octet-stream'},conditions:{ifNoneMatch:'*'}});return name;
 }catch(e){if(Number(e&&e.statusCode||0)===404)return null;return null}
}
async function validateSession(req,payload,c){
 const token=bearer(req,payload);if(!token)throw error('AUTH_REQUIRED','ExportHUB-Anmeldung erforderlich.',401);
 await ensureEnvironmentTeam(c);
 const requestedMode=lower((req.query&&req.query.mode)||(payload&&payload.action)||(payload&&payload.mode));
 const teamRead=(requestedMode==='recovery-preview'||requestedMode==='recover-shipments')?readTeamResilient(c.container,c.team,c.teamBlobName,c.recoveryPrefix,c.allowGenericRecoveryDiscovery):readTeamFast(c.team);
 const reads=await Promise.all([readJson(c.auth,emptyAuth(),true),teamRead]);
 const authDoc=reads[0],teamDoc=reads[1],sessions=Array.isArray(authDoc.value&&authDoc.value.sessions)?authDoc.value.sessions:[];
 const hash=tokenHash(token);let session=sessions.find(s=>safeEqualText(s.tokenHash,hash)),source='blob';
 if(!session){const signed=verifySignedSessionToken(token);if(signed){source='signed';session={id:text(signed.sid),userId:text(signed.uid),username:text(signed.username),deviceId:text(signed.deviceId),createdAt:new Date(Number(signed.iat||Date.now())).toISOString(),expiresAt:new Date(Number(signed.exp)).toISOString(),authVersion:Number(signed.authVersion||0),mustChange:signed.mustChange===true,signedFallback:true}}}
 if(!session)throw error('SESSION_INVALID','Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.',401);
 if(session.revokedAt)throw error('SESSION_REVOKED','Die Sitzung wurde beendet. Bitte erneut anmelden.',401);
 if(Date.parse(session.expiresAt||'')<=Date.now())throw error('SESSION_INVALID','Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.',401);
 const team=teamDoc.value||emptyTeam(),users=Array.isArray(team.users)?team.users:[];
 const user=users.find(u=>text(u.id)===text(session.userId)||usernameOf(u)===lower(session.username));
 if(!user||!isActive(user))throw error('ACCOUNT_DISABLED','Das Benutzerkonto ist deaktiviert.',403);
 if(Number(session.authVersion||0)!==Number(user.authVersion||0))throw error('SESSION_REVOKED','Die Sitzung wurde beendet. Bitte erneut anmelden.',401);
 if((session.mustChange||user.mustChange)===true)throw error('PASSWORD_CHANGE_REQUIRED','Vor der Nutzung muss das Startpasswort geändert werden.',403);
 return {token,session,user,team,teamEtag:teamDoc.etag,sessionSource:source,teamRecoveredFromHistory:teamDoc.recoveredFromHistory===true,teamRecoverySource:teamDoc.recoverySource||null,teamCurrentCorrupt:teamDoc.corruptCurrent===true,teamCurrentMissing:teamDoc.missingCurrent===true};
}
function sanitizeForClient(document,adminView){
 const out=clone(document||emptyTeam());delete out.authBootstrap;delete out.recentOperations;out.users=publicUsers(out.users,adminView);out.state=out.state&&typeof out.state==='object'?mergeState({},out.state):{};out.state.users=clone(out.users);return out;
}
async function metadataOnly(blob){
 try{const p=await blob.getProperties(),m=p.metadata||{};if(m.revision!==undefined)return {schemaVersion:Number(m.schema||3),revision:Number(m.revision||0),updatedAt:m.updatedepoch?new Date(Number(m.updatedepoch)).toISOString():(p.lastModified||null),clientVersion:m.clientversion||null};
 const d=await readJson(blob,emptyTeam());const v=d.value||emptyTeam();return {schemaVersion:Number(v.schemaVersion||3),revision:Number(v.revision||0),updatedAt:v.updatedAt||null,clientVersion:v.clientVersion||null};}
 catch(e){if(e&&e.statusCode===404)return {schemaVersion:3,revision:0,updatedAt:null,clientVersion:null};throw e}
}
function normalizeIncoming(payload){const state=sanitizeState(payload.state||{});delete state.users;return {clientVersion:text(payload.clientVersion),baseRevision:Number(payload.baseRevision||0),deviceId:text(payload.deviceId),operationId:text(payload.operationId||payload.clientMutationId),reason:text(payload.reason||'save'),state}}
async function saveMerged(blob,incoming,user,initialTeam,initialEtag){
 let d={value:initialTeam||emptyTeam(),etag:initialEtag||null};
 for(let attempt=0;attempt<MAX_RETRIES;attempt++){
  if(attempt>0)d=await readJson(blob,emptyTeam());
  const current=d.value||emptyTeam(),operationId=text(incoming.operationId),recentOperations=Array.isArray(current.recentOperations)?current.recentOperations:[];
  if(operationId&&recentOperations.some(op=>text(op&&op.id)===operationId)){const replay=clone(current);replay.concurrentMerge=false;replay.idempotentReplay=true;replay.baseRevision=Number(incoming.baseRevision||0);return replay}
  const merged=pruneTombstones(mergeState(current.state||{},incoming.state||{}));delete merged.users;merged.users=publicUsers(current.users||[],false);
  const next={schemaVersion:3,revision:Number(current.revision||0)+1,updatedAt:now(),updatedBy:text(user.name||user.user),updatedByUserId:text(user.id),updatedByDevice:incoming.deviceId||null,clientVersion:incoming.clientVersion||null,state:merged,users:current.users||[],authBootstrap:current.authBootstrap&&typeof current.authBootstrap==='object'?clone(current.authBootstrap):undefined};
  next.recentOperations=(operationId?[{id:operationId,at:next.updatedAt,deviceId:incoming.deviceId||null,revision:next.revision}]:[]).concat(recentOperations.filter(op=>text(op&&op.id)!==operationId)).slice(0,50);
  try{await uploadJson(blob,next,d.etag);next.concurrentMerge=Number(incoming.baseRevision||0)!==Number(current.revision||0);next.baseRevision=Number(incoming.baseRevision||0);return next}catch(e){if(e&&(e.statusCode===409||e.statusCode===412)&&attempt<MAX_RETRIES-1)continue;if(e&&e.statusCode>=500)throw error('STORAGE_UNREACHABLE','Azure Storage konnte den Teamstand nicht speichern: '+(e.message||'Serverfehler'),503);throw e}
 }
 throw error('CONCURRENT_UPDATE','Der Teamstand konnte nach mehreren Konfliktversuchen nicht gespeichert werden.',409);
}


/* RC614: administrative, non-destructive shipment recovery from Azure blob history. */
const RC614_TARGET_COUNT=25;
const RC614_EVIDENCE_REFS=[
 'PKC5WB','8DAXMV','W4MY9T','ECUFAU','BT7U4H','6ZQ6AT','94XD9K','CPZM5E',
 'KLQA2M','PWFB8E','UBF78K','D97W6U','ONIYV3','Y4ABSN','ASZ9JM','J84J2S','8GYGG3','U2KBBK'
];
function arr(v){return Array.isArray(v)?v:[]}
function isObj(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
function cleanScalar(v){
 if(v===null||v===undefined||typeof v==='boolean'||typeof v==='object')return '';
 const s=String(v).trim();
 return /^(?:false|true|null|undefined|\[object Object\])$/i.test(s)?'':s;
}
function refOf(sh){
 if(!isObj(sh))return '';
 const vals=[sh.ref,sh.reference,sh.shipmentRef,sh.referenceNumber,sh.referenceNo,sh.referenceId,sh.refNo,sh.refNr,sh.shipmentNumber,sh.sendungsnummer,sh.exporthubRef,sh.exportHubReference];
 for(const v of vals){const x=cleanScalar(v).toUpperCase();if(/^[A-Z0-9]{6}$/.test(x))return x}
 return '';
}
function idOf(sh){return cleanScalar(sh&&(sh.id||sh.shipmentId||sh._syncId))}
function identityOf(sh){return refOf(sh)||idOf(sh).toLowerCase()}
function badCustomerValue(v){const x=cleanScalar(v);return !x||/^(?:-|–|—|test|test kunde|test kunde gmbh)$/i.test(x)}
function customerOf(sh){
 if(!isObj(sh))return '';
 const vals=[sh.customerName,sh.customerDisplay,sh.consigneeName,sh.recipientName,sh.companyName];
 for(const v of vals){const x=cleanScalar(v);if(x&&!badCustomerValue(x))return x}
 if(typeof sh.customer==='string'){const x=cleanScalar(sh.customer);if(x&&!badCustomerValue(x))return x}
 if(isObj(sh.customer)){const x=cleanScalar(sh.customer.name||sh.customer.customerName||sh.customer.companyName);if(x&&!badCustomerValue(x))return x}
 return '';
}
function rowList(sh){
 if(!sh)return [];
 const lists=[sh.rows,sh.colli,sh.collis,sh.packages,sh.packagingRows,sh.packageRows,sh.packingRows,sh.shipmentRows,sh.colliRows,sh.cargoRows,sh.freightRows,sh.loadRows,sh.palletRows,sh.handlingUnits,sh.handlingUnitRows,sh.shipmentItems,sh.items,sh.lines,sh.colliData,sh.packagesData,sh.cargo&&sh.cargo.rows,sh.cargoData&&sh.cargoData.rows,sh.freight&&sh.freight.rows,sh.packaging&&sh.packaging.rows,sh.load&&sh.load.rows];
 for(const list of lists)if(Array.isArray(list)&&list.length)return list;
 return [];
}
function num(v){const n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n:0}
function rowDataScore(rows){
 return arr(rows).reduce((score,row)=>{
  row=isObj(row)?row:{};
  return score+(cleanScalar(row.type||row.packaging||row.verpackung||row.name)?20:0)+(num(row.count||row.qty||row.anzahl||row.quantity)>0?15:0)+(num(row.weight||row.gewicht)>0?12:0)+(num(row.ldm)>0?8:0)+(num(row.l||row.length)>0?4:0)+(num(row.w||row.width)>0?4:0)+(num(row.h||row.height)>0?4:0);
 },arr(rows).length);
}
function meaningfulRows(sh){
 const rows=rowList(sh);
 return rows.filter(row=>{
  row=isObj(row)?row:{};
  return !!cleanScalar(row.type||row.packaging||row.verpackung||row.name)||num(row.count||row.qty||row.anzahl||row.quantity)>0||num(row.weight||row.gewicht)>0||num(row.ldm)>0;
 });
}
function docCount(sh){
 if(!isObj(sh))return 0;
 const fields=['podFiles','abdFiles','deliveryFiles','deliveryNotesFiles','lieferscheine','documents','generatedDocuments','files','attachments','invoiceFiles','mailAttachments'];
 return fields.reduce((n,k)=>n+arr(sh[k]).length,0);
}
function coreContentComplete(sh){
 if(!isObj(sh)||!customerOf(sh))return false;
 return meaningfulRows(sh).length>0;
}
function recoveryFlagged(sh){
 return !!(sh&&(sh.recoveryIncomplete===true||sh._recoveredFromLocationRecord===true||/location-booking|verified-location-evidence/i.test(lower(sh.recoverySource))||badCustomerValue(sh.customerName||(typeof sh.customer==='string'?sh.customer:''))));
}
function shipmentRichness(sh){
 if(!isObj(sh))return 0;
 let n=0;
 if(refOf(sh))n+=40;
 if(customerOf(sh))n+=50;
 if(cleanScalar(sh.customerId||sh.customerAccount||sh.customerNumber))n+=15;
 if(cleanScalar(sh.recipientAddress||sh.deliveryAddress||sh.destinationAddress||sh.address||(sh.locationData&&sh.locationData.address)||(sh.siteData&&sh.siteData.address)||(sh.location&&sh.location.address)))n+=45;
 const rows=meaningfulRows(sh);if(rows.length)n+=80+Math.min(120,rows.length*18)+Math.min(120,rowDataScore(rows));
 n+=Math.min(60,docCount(sh)*8);
 if(cleanScalar(sh.pickupDate||sh.plannedPickupDate||sh.actualPickupDate))n+=8;
 if(cleanScalar(sh.status||sh.processStatus))n+=5;
 if(recoveryFlagged(sh))n-=100;
 return n;
}
function bestShipmentSet(state){
 const map=new Map(),all=[];
 if(isObj(state)){
  all.push(...arr(state.shipments),...arr(state.savedShipments));
  [state.shipment,state.currentShipment,state.activeShipment,state.editingShipment,state.documentShipment].forEach(sh=>{if(isObj(sh))all.push(sh)});
  ['shipmentsById','savedShipmentsById','shipmentMap','shipmentsMap'].forEach(k=>{if(isObj(state[k]))Object.values(state[k]).forEach(sh=>{if(isObj(sh))all.push(sh)})});
 }
 all.forEach(sh=>{
  if(!isObj(sh))return;
  const k=identityOf(sh);if(!k)return;
  const cur=map.get(k);
  if(!cur||shipmentRichness(sh)>shipmentRichness(cur))map.set(k,clone(sh));
 });
 return Array.from(map.values());
}
function parseEvidenceValue(value){
 if(isObj(value))return value;
 if(typeof value!=='string')return null;
 const s=value.trim();if(!s||!/^\s*[\[{]/.test(s))return null;
 try{const v=JSON.parse(s);return isObj(v)||Array.isArray(v)?v:null}catch(_){return null}
}
function addEvidenceCandidate(out,seen,raw,sourceType,state){
 let sh=parseEvidenceValue(raw)||raw;if(!isObj(sh))return;
 sh=clone(sh);
 const ref=refOf(sh);if(!ref)return;
 const rows=meaningfulRows(sh),key=[ref,sourceType,rowDataScore(rows),customerOf(sh),cleanScalar(sh.updatedAt||sh.createdAt)].join('|');
 if(seen.has(key))return;seen.add(key);
 sh._forensicEvidenceSource=sourceType;
 if(state)enrichEvidenceFromState(sh,state);
 out.push(sh);
}
function customerMasterFor(state,sh){
 if(!isObj(state)||!isObj(sh))return null;
 const id=lower(sh.customerId||sh.linkedCustomerId),account=lower(sh.customerAccount||sh.customerNumber),name=lower(customerOf(sh));
 return arr(state.customers).find(c=>c&&((id&&lower(c.id)===id)||(account&&lower(c.account||c.customerNumber)===account)||(name&&lower(c.name||c.customerName)===name)))||null;
}
function enrichEvidenceFromState(sh,state){
 const c=customerMasterFor(state,sh);if(!c)return sh;
 if(!customerOf(sh)&&!badCustomerValue(c.name||c.customerName)){sh.customerName=cleanScalar(c.name||c.customerName);if(!sh.customerId&&c.id)sh.customerId=c.id;if(!sh.customerNumber&&(c.account||c.customerNumber))sh.customerNumber=c.account||c.customerNumber}
 const locationId=cleanScalar(sh.locationId||sh.selectedLocationId||sh.siteId),locations=arr(c.locations||c.sites||c.deliveryLocations);
 if(locationId&&locations.length){const loc=locations.find(x=>x&&lower(x.id||x.locationId||x.siteId)===lower(locationId));if(loc){const a=cleanScalar(loc.address||loc.fullAddress||loc.recipientAddress);if(a&&!cleanScalar(sh.recipientAddress||sh.deliveryAddress||sh.destinationAddress||sh.address))sh.recipientAddress=a}}
 return sh;
}
function abdEvidence(state){
 const out=[];
 arr(state&&state.abdRequests).forEach(a=>{
  if(!isObj(a)||!refOf(a))return;
  const e={ref:refOf(a),reference:refOf(a),id:cleanScalar(a.linkedShipmentId)||undefined,shipmentId:cleanScalar(a.linkedShipmentId)||undefined,customerId:a.customerId,customerName:a.customerName||a.customer,customerNumber:a.customerNumber,country:a.country,rows:clone(rowList(a)),deliveryNotes:a.deliveryNotes,deliveryFiles:clone(a.deliveryFiles),invoiceFiles:clone(a.invoiceFiles),abdFiles:clone(a.abdFiles),abdStatus:a.abdStatus||a.status,abdRequestId:a.id,createdAt:a.createdAt||a.created,updatedAt:a.updatedAt,source:'abd-request'};
  out.push(enrichEvidenceFromState(e,state));
 });
 [state&&state.abdRequest,state&&state.abdDraft,state&&state.rc265AbdDraft,state&&state.rc291AbdDraft,state&&state.rc409AbdDraft].forEach(a=>{if(isObj(a)&&refOf(a)){const e=clone(a);e._forensicEvidenceSource='abd-draft';out.push(enrichEvidenceFromState(e,state))}});
 if(isObj(state&&state.abdDrafts))Object.values(state.abdDrafts).forEach(a=>{const v=parseEvidenceValue(a)||a;if(isObj(v)&&refOf(v)){const e=clone(v);e._forensicEvidenceSource='abd-draft-map';out.push(enrichEvidenceFromState(e,state))}});
 return out;
}
function linkedPartialEvidence(state){
 const out=[];
 arr(state&&state.tasks).forEach(t=>{if(!isObj(t))return;const ref=cleanScalar(t.linkedShipmentRef||t.shipmentRef||t.reference).toUpperCase();if(!/^[A-Z0-9]{6}$/.test(ref))return;out.push(enrichEvidenceFromState({ref,customerId:t.linkedCustomerId,customerName:t.linkedCustomer,customerNumber:t.linkedAccount,pickupDate:t.plannedPickupDate,actualPickupDate:t.actualPickupDate,_forensicEvidenceSource:'task-link'},state))});
 arr(state&&state.palletAccount).forEach(p=>{if(!isObj(p))return;const ref=cleanScalar(p.shipmentRef||p.reference).toUpperCase();if(!/^[A-Z0-9]{6}$/.test(ref))return;out.push(enrichEvidenceFromState({ref,customerId:p.customerId,customerName:p.customerName,customerNumber:p.customerAccount,palletAccountCount:num(p.count),palletType:p.palletType,date:p.date,_forensicEvidenceSource:'pallet-account'},state))});
 return out;
}
function cachedColliEvidence(state,baseShipments){
 const out=[],byId=new Map();arr(baseShipments).forEach(sh=>{const id=idOf(sh);if(id)byId.set(lower(id),sh)});
 if(!isObj(state))return out;
 Object.keys(state).forEach(k=>{
  if(!/(?:ColliRef|ColliKey)$/i.test(k))return;
  const prefix=k.replace(/(?:Ref|Key)$/i,''),rowsKey=Object.keys(state).find(x=>lower(x)===lower(prefix+'Rows'));
  const rows=rowsKey&&Array.isArray(state[rowsKey])?state[rowsKey]:[];if(!meaningfulRows({rows}).length)return;
  const raw=cleanScalar(state[k]),direct=raw.toUpperCase(),linked=byId.get(lower(raw));const ref=/^[A-Z0-9]{6}$/.test(direct)?direct:refOf(linked);
  if(!ref)return;
  const e={ref,rows:clone(rows),_forensicEvidenceSource:'colli-cache:'+k};if(linked)Object.assign(e,{id:idOf(linked),customerId:linked.customerId,customerName:customerOf(linked),customerNumber:linked.customerNumber||linked.customerAccount,recipientAddress:linked.recipientAddress||linked.deliveryAddress||linked.destinationAddress,locationId:linked.locationId||linked.selectedLocationId});
  out.push(enrichEvidenceFromState(e,state));
 });
 return out;
}
function genericShipmentEvidence(state){
 const out=[];
 if(!isObj(state))return out;
 const keys=['salesSharedShipments','sharedShipments','shipmentArchive','archivedShipments','archive','shipmentBackups','backupShipments','sammelShipments','shipmentExports'];
 const walk=(value,source,depth)=>{
  if(depth>3||value==null)return;
  const parsed=parseEvidenceValue(value);if(parsed&&parsed!==value)return walk(parsed,source,depth+1);
  if(Array.isArray(value)){value.forEach(v=>walk(v,source,depth+1));return}
  if(!isObj(value))return;
  if(refOf(value)){const e=clone(value);e._forensicEvidenceSource=source;out.push(enrichEvidenceFromState(e,state));return}
  Object.values(value).slice(0,500).forEach(v=>walk(v,source,depth+1));
 };
 keys.forEach(k=>{if(state[k]!=null)walk(state[k],k,0)});
 return out;
}
function recoveryEvidenceShipmentSet(state){
 const out=[],seen=new Set(),base=bestShipmentSet(state);
 base.forEach(sh=>addEvidenceCandidate(out,seen,sh,'shipment',state));
 abdEvidence(state).forEach(sh=>addEvidenceCandidate(out,seen,sh,sh._forensicEvidenceSource||'abd-request',state));
 cachedColliEvidence(state,base).forEach(sh=>addEvidenceCandidate(out,seen,sh,sh._forensicEvidenceSource||'colli-cache',state));
 genericShipmentEvidence(state).forEach(sh=>addEvidenceCandidate(out,seen,sh,sh._forensicEvidenceSource||'linked-backup',state));
 linkedPartialEvidence(state).forEach(sh=>addEvidenceCandidate(out,seen,sh,sh._forensicEvidenceSource||'linked-partial',state));
 return out;
}
function browserEvidenceShipmentSet(list,state){
 const out=[];arr(list).forEach(raw=>{const v=parseEvidenceValue(raw)||raw;if(!isObj(v)||!refOf(v))return;const e=clone(v);e._forensicEvidenceSource=cleanScalar(e._forensicEvidenceSource)||'browser-state';out.push(enrichEvidenceFromState(e,state))});return out;
}
function locationEvidenceShipmentSet(list,state){
 const out=[],base=bestShipmentSet(state),byId=new Map();base.forEach(sh=>{const id=idOf(sh);if(id)byId.set(lower(id),sh)});
 arr(list).forEach(r=>{if(!isObj(r))return;let ref=cleanScalar(r.reference||r.ref||r.shipmentRef).toUpperCase(),linked=null;if(!/^[A-Z0-9]{6}$/.test(ref)){linked=byId.get(lower(r.shipmentId||r.id));ref=refOf(linked)}if(!ref)return;
  const e={ref,id:cleanScalar(r.shipmentId)||undefined,customerName:cleanScalar(r.customer),palletCount:num(r.palletCount),packageCount:num(r.packageCount),colliCount:num(r.colliCount||r.totalColli||r.expectedColliCount),totalColli:num(r.totalColli||r.colliCount),currentLocation:cleanScalar(r.currentLocation),warehouseLocation:cleanScalar(r.currentLocation),warehouseLocationCode:num(r.locationCode),warehousePrepared:r.prepared===true,warehouseMovedBy:cleanScalar(r.loaderName),loader:cleanScalar(r.loaderName),warehouseMovedAt:cleanScalar(r.bookedAt),bookedAt:cleanScalar(r.bookedAt),warehouseHistory:Array.isArray(r.history)?clone(r.history):undefined,_forensicEvidenceSource:'location-booking'};
  if(linked){e.customerId=linked.customerId;e.customerNumber=linked.customerNumber||linked.customerAccount}
  out.push(enrichEvidenceFromState(e,state));
 });return out;
}
function applyLocationEvidence(state,list){
 if(!isObj(state)||!arr(list).length)return {state:clone(state||{}),updatedRefs:[]};const out=clone(state),all=arr(out.shipments).concat(arr(out.savedShipments)),byRef=new Map(),byId=new Map();all.forEach(sh=>{const r=refOf(sh),id=idOf(sh);if(r)byRef.set(r,sh);if(id)byId.set(lower(id),sh)});const updated=[];
 arr(list).forEach(rec=>{if(!isObj(rec)||rec.collected===true)return;let sh=null,ref=cleanScalar(rec.reference||rec.ref||rec.shipmentRef).toUpperCase();if(/^[A-Z0-9]{6}$/.test(ref))sh=byRef.get(ref);if(!sh)sh=byId.get(lower(rec.shipmentId||rec.id));if(!sh)return;ref=refOf(sh);let changed=false;
  const cust=cleanScalar(rec.customer);if(cust&&!badCustomerValue(cust)&&!customerOf(sh)){sh.customerName=cust;changed=true}
  const textMap=[['warehouseLocation','currentLocation'],['currentLocation','currentLocation'],['warehouseMovedBy','loaderName'],['loader','loaderName'],['warehouseMovedAt','bookedAt']];textMap.forEach(([dst,src])=>{const v=cleanScalar(rec[src]);if(v&&!cleanScalar(sh[dst])){sh[dst]=v;changed=true}});
  const numMap=[['warehouseLocationCode','locationCode'],['palletCount','palletCount'],['packageCount','packageCount'],['colliCount','colliCount'],['totalColli','totalColli']];numMap.forEach(([dst,src])=>{const v=num(rec[src]);if(v>0&&num(sh[dst])<=0){sh[dst]=v;changed=true}});
  if(rec.prepared===true&&sh.warehousePrepared!==true){sh.warehousePrepared=true;changed=true}if(Array.isArray(rec.history)&&rec.history.length&&!Array.isArray(sh.warehouseHistory)){sh.warehouseHistory=clone(rec.history);changed=true}if(changed&&ref)updated.push(ref)
 });
 return {state:out,updatedRefs:Array.from(new Set(updated))};
}
function bestRecoveryEvidence(state,extraEvidence){
 const map=new Map(),sources=new Map(),all=recoveryEvidenceShipmentSet(state).concat(browserEvidenceShipmentSet(extraEvidence,state));
 all.forEach(sh=>{const ref=refOf(sh);if(!ref)return;const cur=map.get(ref),merged=cur?mergeHistoricalCopy(cur,sh):clone(sh);if(!cur||shipmentRichness(merged)>=shipmentRichness(cur)){map.set(ref,merged);const ss=new Set(sources.get(ref)||[]);ss.add(cleanScalar(sh._forensicEvidenceSource)||'unknown');sources.set(ref,Array.from(ss))}});
 return {map,sources};
}
function normalizedStatus(sh){
 const s=lower(sh&&(sh.status||sh.processStatus||sh.pickupStatus||''));
 if(/archiv/.test(s))return'archiviert';
 if(/storn|cancel/.test(s))return'storniert';
 if(/abgeschlossen|completed|erledigt|done/.test(s))return'abgeschlossen';
 if(/pod/.test(s))return'pod';
 if(/abgeholt|picked/.test(s))return'abgeholt';
 if(/vorbereit|prepared/.test(s))return'vorbereitet';
 if(/in bearbeitung|processing|bearbeit/.test(s))return'inbearbeitung';
 if(/bereit.*abhol/.test(s))return'bereit';
 if(/wartet.*abd/.test(s))return'wartetabd';
 if(/erstellt|created/.test(s))return'erstellt';
 if(/entwurf|draft/.test(s))return'entwurf';
 return s||'offen';
}
function stateOfDocument(doc){if(isObj(doc&&doc.state))return doc.state;if(isObj(doc)&&(Array.isArray(doc.shipments)||Array.isArray(doc.savedShipments)||isObj(doc.shipment)||isObj(doc.shipmentsById)))return doc;return {}}
function candidateStats(doc,knownRefs){
 const state=stateOfDocument(doc);
 const list=bestShipmentSet(state), known=new Set(arr(knownRefs).map(x=>String(x).toUpperCase()));
 let validCustomer=0,rich=0,coreComplete=0,suspect=0,knownHits=0,activeCount=0,activeValidCustomer=0,activeRich=0,activeCoreComplete=0,activeSuspect=0;
 const refs=[],activeRefs=[],statusCounts={};
 list.forEach(sh=>{
  const ref=refOf(sh);if(ref)refs.push(ref);
  const customerOk=!!customerOf(sh),richOk=shipmentRichness(sh)>=90,suspectFlag=recoveryFlagged(sh)||!customerOk;
  if(customerOk)validCustomer++;
  if(richOk)rich++;
  if(coreContentComplete(sh))coreComplete++;
  if(suspectFlag)suspect++;
  if(ref&&known.has(ref))knownHits++;
  const sk=normalizedStatus(sh);statusCounts[sk]=(statusCounts[sk]||0)+1;
  if(sk!=='archiviert'&&sk!=='storniert'){
   activeCount++;if(ref)activeRefs.push(ref);
   if(customerOk)activeValidCustomer++;
   if(richOk)activeRich++;
   if(coreContentComplete(sh))activeCoreComplete++;
   if(suspectFlag)activeSuspect++;
  }
 });
 const count=list.length, ratio=count?validCustomer/count:0,activeRatio=activeCount?activeValidCustomer/activeCount:0;
 return {count,activeCount,validCustomer,validCustomerRatio:ratio,activeValidCustomer,activeValidCustomerRatio:activeRatio,rich,activeRich,coreComplete,activeCoreComplete,suspect,activeSuspect,knownHits,refs,activeRefs,statusCounts};
}
function sourceDescriptor(item,teamBlobName){
 return {
  blobName:cleanScalar(item&&item.name)||teamBlobName||TEAM_BLOB_BASE,
  versionId:cleanScalar(item&&item.versionId),
  snapshot:cleanScalar(item&&item.snapshot),
  lastModified:item&&item.properties&&item.properties.lastModified?new Date(item.properties.lastModified).toISOString():null,
  clientVersion:item&&item.metadata&&cleanScalar(item.metadata.clientversion),
  isCurrentVersion:item&&item.isCurrentVersion===true,
  isBackup:!!(item&&item.name&&item.name!==(teamBlobName||TEAM_BLOB_BASE))
 };
}
function historyClient(container,source,teamBlobName){
 let b=container.getBlobClient(source&&source.blobName||teamBlobName||TEAM_BLOB_BASE);
 if(source&&source.versionId)b=b.withVersion(source.versionId);
 else if(source&&source.snapshot)b=b.withSnapshot(source.snapshot);
 return b;
}
async function listHistory(container,teamBlobName,recoveryPrefix,allowDiscovery){
 teamBlobName=cleanScalar(teamBlobName)||TEAM_BLOB_BASE;recoveryPrefix=cleanScalar(recoveryPrefix)||'recovery-backups/';allowDiscovery=allowDiscovery!==false;
 const out=[];
 try{
  for await(const item of container.listBlobsFlat({prefix:teamBlobName,includeVersions:true,includeSnapshots:true,includeMetadata:true,includeDeleted:true,includeDeletedWithVersions:true})){
   if(item.name!==teamBlobName)continue;
   const d=sourceDescriptor(item,teamBlobName);
   if(d.isCurrentVersion===true)continue;
   if(!d.versionId&&!d.snapshot)continue;
   out.push(d);
  }
 }catch(e){
  try{
   for await(const item of container.listBlobsFlat({prefix:teamBlobName,includeVersions:true,includeSnapshots:true,includeMetadata:true})){
    if(item.name!==teamBlobName)continue;
    const d=sourceDescriptor(item,teamBlobName);
    if(d.isCurrentVersion===true)continue;
    if(!d.versionId&&!d.snapshot)continue;
    out.push(d);
   }
  }catch(inner){throw error('RECOVERY_HISTORY_UNAVAILABLE','Azure konnte die Versionshistorie von '+teamBlobName+' nicht auflisten: '+(inner&&inner.message||e&&e.message||'Unbekannter Fehler'),500)}
 }
 try{
  for await(const item of container.listBlobsFlat({prefix:recoveryPrefix,includeMetadata:true})){
   if(!item||!item.name||!/\.json$/i.test(item.name))continue;
   out.push(sourceDescriptor(item,teamBlobName));
  }
 }catch(_){}
 /* RC634: discover additional genuine ExportHUB/team backup JSON blobs without treating auth/pickup/POD data as shipment backups. */
 if(allowDiscovery)try{
  let discovered=0;
  for await(const item of container.listBlobsFlat({prefix:'',includeMetadata:true})){
   if(!item||!item.name||item.name===teamBlobName||!/\.json$/i.test(item.name))continue;
   const name=lower(item.name);
   if(/auth|session|token|pickup|pod|loader|pin|location|warehouse|lock/.test(name))continue;
   if(!/(?:exporthub|team|state|backup|sammel|recovery|archive)/.test(name))continue;
   out.push(sourceDescriptor(item,teamBlobName));
   if(++discovered>=500)break;
  }
 }catch(_){}
 const seen=new Set(),unique=[];
 out.forEach(source=>{const key=[source.blobName||teamBlobName,source.versionId||'',source.snapshot||''].join('|');if(seen.has(key))return;seen.add(key);unique.push(source)});
 unique.sort((a,b)=>Date.parse(b.lastModified||0)-Date.parse(a.lastModified||0));
 return unique;
}
function safeCandidate(stats,targetCount){
 const target=Math.max(1,Number(targetCount)||RC614_TARGET_COUNT);
 return stats.activeCount>=target && stats.activeCount<=target+12 &&
        stats.activeValidCustomerRatio>=0.72 &&
        stats.activeRich>=Math.max(12,Math.floor(target*0.60)) &&
        stats.activeCoreComplete>=Math.max(12,Math.floor(target*0.60)) &&
        stats.activeSuspect<=Math.max(5,Math.floor(target*0.24)) &&
        (stats.knownHits>=3||stats.activeValidCustomer>=Math.max(20,Math.floor(target*0.82)));
}
async function inspectHistory(container,targetCount,knownRefs,maxVersions=70,teamBlobName,recoveryPrefix,allowDiscovery){
 const history=await listHistory(container,teamBlobName,recoveryPrefix,allowDiscovery), inspected=[];
 let bestSafe=null,bestScore=-1;
 const max=Math.max(1,Math.min(100,Number(maxVersions)||70)),priority=['PKC5WB','8DAXMV'];
 for(let i=0;i<history.length&&i<max;i++){
  const source=history[i];
  if(/^RC61[1-4]/i.test(cleanScalar(source.clientVersion)))continue;
  try{
   const d=await readJson(historyClient(container,source,teamBlobName),emptyTeam(),false);
   const doc=d.value||emptyTeam(),stats=candidateStats(doc,knownRefs);
   const item={source,stats,safe:safeCandidate(stats,targetCount),revision:Number(doc.revision||0),updatedAt:doc.updatedAt||source.lastModified||null,updatedBy:cleanScalar(doc.updatedBy),clientVersion:cleanScalar(doc.clientVersion||source.clientVersion)};
   inspected.push(item);
   if(item.safe){
    const refs=new Set(stats.refs||[]),priorityHits=priority.filter(r=>refs.has(r)).length;
    const score=priorityHits*10000+Number(stats.knownHits||0)*500+Number(stats.activeCoreComplete||0)*50+Number(stats.activeValidCustomer||0)*10-Number(stats.activeSuspect||0)*100;
    if(score>bestScore){bestScore=score;bestSafe=item}
    if(priorityHits===priority.length)return {candidate:item,inspected,historyCount:history.length};
    if(bestSafe&&i>=Math.min(max-1,49))break;
   }
  }catch(e){
   inspected.push({source,error:e&&e.message||'Historische Version konnte nicht gelesen werden.',safe:false});
  }
 }
 return {candidate:bestSafe,inspected,historyCount:history.length};
}
function historicalCore(sh){
 if(!isObj(sh))return {ok:false,customer:false,address:false,rows:0,rowScore:0};
 const customer=!!customerOf(sh),address=!!cleanScalar(sh.recipientAddress||sh.deliveryAddress||sh.destinationAddress||sh.address||(sh.locationData&&sh.locationData.address)||(sh.siteData&&sh.siteData.address)||(sh.location&&sh.location.address)),rows=meaningfulRows(sh),rowScore=rowDataScore(rows);
 return {ok:customer&&rows.length>0,customer,address,rows:rows.length,rowScore};
}
function syntheticHistoricalRecovery(sh){
 return !!(sh&&(sh.recoveryIncomplete===true||sh._recoveredFromLocationRecord===true||/location-booking|verified-location-evidence/i.test(lower(sh.recoverySource))));
}
function mergeHistoricalCopy(a,b){
 if(!isObj(a))return clone(b||{});if(!isObj(b))return clone(a||{});
 const primary=shipmentRichness(b)>shipmentRichness(a)?clone(b):clone(a),secondary=shipmentRichness(b)>shipmentRichness(a)?a:b;
 Object.keys(secondary).forEach(k=>{
  const pv=primary[k],sv=secondary[k];
  const missing=pv===undefined||pv===null||pv===false||(typeof pv==='string'&&!cleanScalar(pv))||(Array.isArray(pv)&&!pv.length)||(isObj(pv)&&!Object.keys(pv).length);
  if(missing&&sv!==undefined&&sv!==null&&sv!==false){
   if(typeof sv==='string'&&!cleanScalar(sv))return;
   if(Array.isArray(sv)&&!sv.length)return;
   if(isObj(sv)&&!Object.keys(sv).length)return;
   if(/customer|consigneeName|recipientName|companyName/i.test(k)&&badCustomerValue(typeof sv==='string'?sv:(sv&&sv.name)))return;
   primary[k]=clone(sv);
  }
 });
 const ar=meaningfulRows(a),br=meaningfulRows(b),aScore=rowDataScore(ar),bScore=rowDataScore(br),bestSource=bScore>aScore?b:a,bestRows=bScore>aScore?br:ar;
 if(bestRows.length){['rows','colli','collis','packages','packagingRows','shipmentRows','colliRows','items','lines'].forEach(k=>{if(Array.isArray(bestSource[k])&&bestSource[k].length)primary[k]=clone(bestSource[k])});if(!Array.isArray(primary.rows)||!meaningfulRows(primary).length)primary.rows=clone(bestRows)}
 ['podFiles','abdFiles','deliveryFiles','deliveryNotesFiles','lieferscheine','documents','generatedDocuments','files','attachments','invoiceFiles','mailAttachments'].forEach(k=>{if(Array.isArray(a[k])||Array.isArray(b[k]))primary[k]=mergeUniqueFiles(a[k],b[k])});
 return primary;
}
async function bestHistoricalPerShipment(container,refs,maxVersions=500,teamBlobName,recoveryPrefix,allowDiscovery){
 const wanted=new Set(arr(refs).map(v=>cleanScalar(v).toUpperCase()).filter(v=>/^[A-Z0-9]{6}$/.test(v))),history=await listHistory(container,teamBlobName,recoveryPrefix,allowDiscovery),map=new Map(),sources=new Map();
 const max=Math.max(1,Math.min(800,Number(maxVersions)||500));let scanned=0,readErrors=0;
 for(let i=0;i<history.length&&i<max;i++){
  const source=history[i];
  try{
   const d=await readJson(historyClient(container,source,teamBlobName),emptyTeam(),false),doc=d.value||emptyTeam();scanned++;
   recoveryEvidenceShipmentSet(stateOfDocument(doc)).forEach(sh=>{
    const ref=refOf(sh);if(!ref||(wanted.size&&!wanted.has(ref)))return;
    if(syntheticHistoricalRecovery(sh))return;
    const hasRows=meaningfulRows(sh).length>0,hasCustomer=!!customerOf(sh),hasAddress=!!cleanScalar(sh.recipientAddress||sh.deliveryAddress||sh.destinationAddress||sh.address||(sh.locationData&&sh.locationData.address)||(sh.siteData&&sh.siteData.address)||(sh.location&&sh.location.address));
    if(!hasRows&&!hasCustomer&&!hasAddress)return;
    const cur=map.get(ref),merged=cur?mergeHistoricalCopy(cur,sh):clone(sh);
    if(!cur||shipmentRichness(merged)>=shipmentRichness(cur)){map.set(ref,merged);sources.set(ref,source)}
   });
   if(wanted.size&&i>=24){let ready=0;wanted.forEach(ref=>{const hit=map.get(ref);if(hit&&meaningfulRows(hit).length>0)ready++});if(ready===wanted.size)break}
  }catch(_){readErrors++}
 }
 const complete=[],partial=[];
 map.forEach((sh,ref)=>{const core=historicalCore(sh),entry={ref,shipment:sh,source:sources.get(ref)||null,score:shipmentRichness(sh),core};(meaningfulRows(sh).length>0?complete:partial).push(entry)});
 return {historyCount:history.length,scanned,readErrors,complete,partial};
}
function mergeUniqueFiles(a,b){
 const out=[],seen=new Set();
 arr(a).concat(arr(b)).forEach((f,i)=>{
  if(!f)return;
  const k=lower(isObj(f)?(f.id||f.remoteId||f.name||f.fileName||f.filename||f.url||f.downloadUrl||('idx-'+i)):String(f));
  if(k&&seen.has(k))return;
  if(k)seen.add(k);
  out.push(clone(f));
 });
 return out;
}
function copyIfValid(target,current,field){
 if(!isObj(current))return;
 const v=current[field];
 if(v===undefined||v===null||typeof v==='boolean')return;
 if(typeof v==='string'&&!cleanScalar(v))return;
 if(/^customer(?:Name|Display)?$|^(?:consigneeName|recipientName|companyName)$/i.test(field)&&badCustomerValue(typeof v==='string'?v:(v&&v.name)))return;
 if(Array.isArray(v)&&!v.length)return;
 if(isObj(v)&&!Object.keys(v).length)return;
 target[field]=clone(v);
}
function mergeRestoredShipment(historical,current){
 const hist=clone(historical||{}),cur=isObj(current)?current:{};
 const out=hist;
 delete out.recoveryIncomplete;delete out._recoveredFromLocationRecord;delete out.recoverySource;delete out.recoveryReason;
 const currentCustomer=customerOf(cur),historicalCustomer=customerOf(hist);
 if(currentCustomer){
  ['customerId','customerAccount','customerNumber','customerName','customerDisplay','customer','recipientName','companyName','recipientAddress','destinationAddress','destinationCountry','recipientCountry','locationId','selectedLocationId','siteId','location','locationData','siteData','locationName','site','standort'].forEach(k=>copyIfValid(out,cur,k));
 }
 const curRows=meaningfulRows(cur),histRows=meaningfulRows(hist);
 if(curRows.length&&(!histRows.length||rowDataScore(curRows)>=rowDataScore(histRows))){
  ['rows','colli','collis','packages','packagingRows'].forEach(k=>{if(Array.isArray(cur[k])&&cur[k].length)out[k]=clone(cur[k])});
 }
 const operational=[
  'status','processStatus','pickupStatus','warehouseLocation','currentLocation','warehousePrepared','warehousePreparedAt','warehouseUpdatedAt',
  'pickupConfirmed','pickupConfirmedAt','qrPickupConfirmed','qrPickupConfirmedAt','pickupQrUsed','pickupQrUsedAt','pickupCompleted','pickupCompletedAt',
  'pickedUpAt','pickedUpAtDate','actualPickupDate','actualPickupAt','podStatus','podUploadedAt','podServerVerified','podServerVerifiedAt',
  'driverSignature','pickupDriverSignature','signatureDataUrl','pickupSignature','driverSignatureUrl','pickupDriverSignatureUrl','pickupSignatureUrl','signatureUrl',
  'remotePickupStatusLocked','pickupQrServerStatus','completed','done','completedAt','updatedAt','modifiedAt','_syncUpdatedAt',
  'warehouseLoader','loader','preparedBy','pickupDriverName','driverName','licensePlate','vehicleRegistration'
 ];
 operational.forEach(k=>copyIfValid(out,cur,k));
 ['podFiles','abdFiles','deliveryFiles','deliveryNotesFiles','lieferscheine','documents','generatedDocuments','files','attachments','invoiceFiles','mailAttachments'].forEach(k=>{
  if(Array.isArray(hist[k])||Array.isArray(cur[k]))out[k]=mergeUniqueFiles(hist[k],cur[k]);
 });
 if(!refOf(out)&&refOf(cur))out.ref=refOf(cur);
 if(!idOf(out)&&idOf(cur))out.id=idOf(cur);
 return out;
}
function removeShipmentTombstones(state,restored){
 if(!isObj(state)||!isObj(state._teamSyncMeta)||!Array.isArray(state._teamSyncMeta.tombstones))return 0;
 const ids=new Set();
 arr(restored).forEach(sh=>{const r=refOf(sh),id=idOf(sh);if(r)ids.add(r.toLowerCase());if(id)ids.add(id.toLowerCase())});
 const before=state._teamSyncMeta.tombstones.length;
 state._teamSyncMeta.tombstones=state._teamSyncMeta.tombstones.filter(t=>{
  if(!t||lower(t.collection)!=='shipments')return true;
  return ![t.id,t.ref,t.reference,t.shipmentId,t.shipmentRef].some(v=>ids.has(lower(v)));
 });
 return before-state._teamSyncMeta.tombstones.length;
}
function mergeHistoricalShipments(currentState,historicalState){
 const cur=isObj(currentState)?clone(currentState):{},hist=isObj(historicalState)?historicalState:{};
 const currentList=bestShipmentSet(cur),historyList=bestShipmentSet(hist),map=new Map();
 currentList.forEach(sh=>{const k=identityOf(sh);if(k)map.set(k,clone(sh))});
 let added=0,repaired=0,backfilled=0;
 const restored=[];
 historyList.forEach(h=>{
  const k=identityOf(h);if(!k)return;
  const c=map.get(k),historicalStatus=normalizedStatus(h);
  if(!c){
   if(historicalStatus==='archiviert'||historicalStatus==='storniert')return;
   const x=mergeRestoredShipment(h,null);map.set(k,x);restored.push(x);added++;return
  }
  const cBad=recoveryFlagged(c)||!customerOf(c)||shipmentRichness(c)<70;
  const hBetter=shipmentRichness(h)>shipmentRichness(c)+15;
  if(cBad||hBetter){const x=mergeRestoredShipment(h,c);map.set(k,x);restored.push(x);repaired++;return}
  let changed=false,x=clone(c);
  const fillFields=['customerId','customerAccount','customerNumber','customerName','customerDisplay','recipientName','recipientAddress','destinationAddress','destinationCountry','recipientCountry'];
  fillFields.forEach(f=>{const customerField=/customer|consigneeName|recipientName/i.test(f);if((!cleanScalar(x[f])||(customerField&&badCustomerValue(x[f])))&&cleanScalar(h[f])&&(!customerField||!badCustomerValue(h[f]))){x[f]=clone(h[f]);changed=true}});
  if(!rowList(x).length&&rowList(h).length){['rows','colli','collis','packages','packagingRows'].forEach(f=>{if(Array.isArray(h[f])&&h[f].length)x[f]=clone(h[f])});changed=true}
  if(changed){map.set(k,x);restored.push(x);backfilled++}
 });
 cur.shipments=Array.from(map.values());
 const savedMap=new Map();
 arr(cur.savedShipments).forEach(sh=>{const k=identityOf(sh);if(k)savedMap.set(k,clone(sh))});
 cur.shipments.forEach(sh=>{const k=identityOf(sh);if(k&&!savedMap.has(k))savedMap.set(k,clone(sh));else if(k&&shipmentRichness(sh)>shipmentRichness(savedMap.get(k)))savedMap.set(k,clone(sh))});
 if(savedMap.size)cur.savedShipments=Array.from(savedMap.values());
 const tombstonesRemoved=removeShipmentTombstones(cur,restored);
 return {state:cur,added,repaired,backfilled,tombstonesRemoved,restoredRefs:Array.from(new Set(restored.map(refOf).filter(Boolean)))};
}
async function safetyBackup(container,doc,label,recoveryPrefix){
 const stamp=now().replace(/[:.]/g,'-'),name=(cleanScalar(recoveryPrefix)||'recovery-backups/')+String(label||'team-state').replace(/[^A-Za-z0-9_.-]+/g,'-')+'-'+stamp+'.json';
 const raw=JSON.stringify(doc),blob=container.getBlockBlobClient(name);
 await blob.upload(raw,Buffer.byteLength(raw),{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions:{ifNoneMatch:'*'}});
 return name;
}
async function recoveryPreview(container,payload,teamBlobName,recoveryPrefix,allowDiscovery){
 const target=Math.max(1,Number(payload&&payload.targetCount)||RC614_TARGET_COUNT);
 const known=arr(payload&&payload.knownRefs).length?payload.knownRefs:RC614_EVIDENCE_REFS;
 const result=await inspectHistory(container,target,known,Math.min(80,Number(payload&&payload.maxVersions)||80),teamBlobName,recoveryPrefix,allowDiscovery);
 const deep=await bestHistoricalPerShipment(container,known,payload&&payload.deepMaxVersions||500);
 return {
  ok:true,recoveryPreview:true,targetCount:target,historyCount:Math.max(result.historyCount||0,deep.historyCount||0),
  candidate:result.candidate?{source:result.candidate.source,stats:result.candidate.stats,revision:result.candidate.revision,updatedAt:result.candidate.updatedAt,updatedBy:result.candidate.updatedBy,clientVersion:result.candidate.clientVersion,safe:true}:null,
  deepRecoveryPossible:deep.complete.length>0,deepRecoveredRefs:deep.complete.map(x=>x.ref),deepPartialRefs:deep.partial.map(x=>x.ref),deepScannedVersions:deep.scanned,
  inspected:result.inspected.slice(0,12).map(x=>({source:x.source,stats:x.stats||null,safe:x.safe===true,revision:x.revision||0,updatedAt:x.updatedAt||null,clientVersion:x.clientVersion||'',error:x.error||''}))
 };
}
async function recoverShipments(container,teamBlob,payload,user,teamBlobName,recoveryPrefix,allowDiscovery){
 const target=Math.max(1,Number(payload&&payload.targetCount)||RC614_TARGET_COUNT);
 const known=arr(payload&&payload.knownRefs).length?payload.knownRefs:RC614_EVIDENCE_REFS;
 const fresh=await readJson(teamBlob,emptyTeam(),false),current=fresh.value||emptyTeam();
 const locationApplied=applyLocationEvidence(current.state||{},payload&&payload.locationEvidence),currentBase=clone(current);currentBase.state=locationApplied.state;
 let source=isObj(payload&&payload.source)?payload.source:null,candidateDoc=null,candidateInfo=null;
 if(source&&(source.versionId||source.snapshot)){
  const d=await readJson(historyClient(container,source,teamBlobName),emptyTeam(),false);candidateDoc=d.value||emptyTeam();
  const stats=candidateStats(candidateDoc,known);
  if(safeCandidate(stats,target))candidateInfo={source,stats,revision:Number(candidateDoc.revision||0),updatedAt:candidateDoc.updatedAt||source.lastModified||null,clientVersion:cleanScalar(candidateDoc.clientVersion||source.clientVersion)};
  else{candidateDoc=null;candidateInfo=null}
 }
 const refs=new Set();
 bestShipmentSet(currentBase.state||{}).forEach(sh=>{const r=refOf(sh);if(r)refs.add(r)});
 arr(known).forEach(r=>{r=cleanScalar(r).toUpperCase();if(/^[A-Z0-9]{6}$/.test(r))refs.add(r)});
 const extraEvidence=arr(payload&&payload.browserEvidence).concat(locationEvidenceShipmentSet(payload&&payload.locationEvidence,currentBase.state||{})),currentEvidence=bestRecoveryEvidence(currentBase.state||{},extraEvidence),currentEvidenceRows=[];
 currentEvidence.map.forEach((sh,ref)=>{if(meaningfulRows(sh).length)currentEvidenceRows.push({ref,shipment:sh,sources:currentEvidence.sources.get(ref)||[]})});
 const currentRowRefs=new Set(currentEvidenceRows.map(x=>x.ref)),historyRefs=Array.from(refs).filter(ref=>!currentRowRefs.has(ref));
 const deep=historyRefs.length?await bestHistoricalPerShipment(container,historyRefs,payload&&payload.deepMaxVersions||500):{historyCount:0,scanned:0,readErrors:0,complete:[],partial:[]};
 if(!deep.complete.length&&!candidateInfo&&!currentEvidenceRows.length)throw error('NO_RECOVERABLE_SHIPMENT_HISTORY','In den vorhandenen ExportHUB-Datenquellen wurde für keine betroffene Sendungsreferenz ein echter Datensatz mit Packstückdaten gefunden. Es wurde nichts verändert.',409);
 let merged={state:clone(currentBase.state||{}),added:0,repaired:0,backfilled:0,tombstonesRemoved:0,restoredRefs:[]};
 if(currentEvidenceRows.length){
  const evMerged=mergeHistoricalShipments(merged.state,{shipments:currentEvidenceRows.map(x=>x.shipment)});
  merged={state:evMerged.state,added:merged.added+evMerged.added,repaired:merged.repaired+evMerged.repaired,backfilled:merged.backfilled+evMerged.backfilled,tombstonesRemoved:merged.tombstonesRemoved+evMerged.tombstonesRemoved,restoredRefs:Array.from(new Set(merged.restoredRefs.concat(evMerged.restoredRefs)))};
 }
 if(candidateInfo&&candidateDoc)merged=mergeHistoricalShipments(merged.state,stateOfDocument(candidateDoc));
 if(deep.complete.length){
  const deepState={shipments:deep.complete.map(x=>x.shipment)};
  const deepMerged=mergeHistoricalShipments(merged.state,deepState);
  merged={state:deepMerged.state,added:merged.added+deepMerged.added,repaired:merged.repaired+deepMerged.repaired,backfilled:merged.backfilled+deepMerged.backfilled,tombstonesRemoved:merged.tombstonesRemoved+deepMerged.tombstonesRemoved,restoredRefs:Array.from(new Set(merged.restoredRefs.concat(deepMerged.restoredRefs)))};
 }
 const beforeStats=candidateStats(current,known),afterStats=candidateStats({state:merged.state},known);
 const beforeRows=bestShipmentSet(current.state||{}).reduce((n,sh)=>n+meaningfulRows(sh).length,0),afterRows=bestShipmentSet(merged.state||{}).reduce((n,sh)=>n+meaningfulRows(sh).length,0);
 const rowImproved=afterRows>beforeRows,coreImproved=afterStats.coreComplete>beforeStats.coreComplete||afterStats.activeCoreComplete>beforeStats.activeCoreComplete;
 if(!rowImproved&&!coreImproved&&merged.added===0&&merged.repaired===0&&merged.backfilled===0)throw error('RECOVERY_NO_IMPROVEMENT','Historische Versionen wurden gefunden, aber sie enthalten keine besseren Sendungsdaten als der aktuelle Stand. Es wurde nichts verändert.',409);
 const backupName=await safetyBackup(container,current,'team-state-before-RC640-forensic-recovery',recoveryPrefix);
 const next=clone(current);
 next.schemaVersion=Math.max(3,Number(current.schemaVersion||3));
 next.revision=Number(current.revision||0)+1;
 next.updatedAt=now();
 next.updatedBy=text(user.name||user.user);
 next.updatedByUserId=text(user.id);
 next.clientVersion='RC640-forensic-recovery';
 next.state=merged.state;
 const finalStats=candidateStats(next,known),remainingIncomplete=bestShipmentSet(next.state||{}).filter(sh=>meaningfulRows(sh).length===0).map(refOf).filter(Boolean);
 next.recoveryAudit={at:next.updatedAt,by:next.updatedBy,source:candidateInfo&&candidateInfo.source||null,sourceRevision:candidateInfo&&candidateInfo.revision||0,sourceUpdatedAt:candidateInfo&&candidateInfo.updatedAt||null,backupBlob:backupName,added:merged.added,repaired:merged.repaired,backfilled:merged.backfilled,tombstonesRemoved:merged.tombstonesRemoved,restoredRefs:merged.restoredRefs,deepScannedVersions:deep.scanned,deepHistoryCount:deep.historyCount,deepReadErrors:deep.readErrors,deepRecoveredRefs:deep.complete.map(x=>x.ref),deepPartialRefs:deep.partial.map(x=>x.ref),currentEvidenceRefs:currentEvidenceRows.map(x=>x.ref),currentEvidenceSources:Object.fromEntries(currentEvidenceRows.map(x=>[x.ref,x.sources])),locationEvidenceUpdatedRefs:locationApplied.updatedRefs,browserEvidenceCount:arr(payload&&payload.browserEvidence).length,remainingIncompleteRefs:remainingIncomplete,beforeMeaningfulRows:beforeRows,afterMeaningfulRows:afterRows};
 try{await uploadJson(teamBlob,next,fresh.etag)}catch(e){if(e&&(e.statusCode===409||e.statusCode===412))throw error('CONCURRENT_UPDATE','Der Azure-Teamstand wurde während der Datenrettung gleichzeitig geändert. Die Wiederherstellung wurde sicher abgebrochen und kann erneut gestartet werden.',409);if(e&&e.statusCode>=500)throw error('STORAGE_UNREACHABLE','Azure Storage konnte den wiederhergestellten Sendungsstand nicht speichern: '+(e.message||'Serverfehler'),503);throw e}
 return {ok:true,recovered:true,revision:next.revision,updatedAt:next.updatedAt,backupBlob:backupName,source:candidateInfo&&candidateInfo.source||null,sourceRevision:candidateInfo&&candidateInfo.revision||0,sourceUpdatedAt:candidateInfo&&candidateInfo.updatedAt||null,sourceStats:candidateInfo&&candidateInfo.stats||null,added:merged.added,repaired:merged.repaired,backfilled:merged.backfilled,tombstonesRemoved:merged.tombstonesRemoved,restoredRefs:merged.restoredRefs,finalStats,deepScannedVersions:deep.scanned,deepHistoryCount:deep.historyCount,deepReadErrors:deep.readErrors,deepRecoveredRefs:deep.complete.map(x=>x.ref),deepPartialRefs:deep.partial.map(x=>x.ref),currentEvidenceRefs:currentEvidenceRows.map(x=>x.ref),currentEvidenceSources:Object.fromEntries(currentEvidenceRows.map(x=>[x.ref,x.sources])),locationEvidenceUpdatedRefs:locationApplied.updatedRefs,browserEvidenceCount:arr(payload&&payload.browserEvidence).length,remainingIncompleteRefs:remainingIncomplete,beforeMeaningfulRows:beforeRows,afterMeaningfulRows:afterRows};
}



function customerRecoveryValue(v){if(v===null||v===undefined)return false;if(typeof v==='string')return cleanScalar(v)!=='';if(Array.isArray(v))return v.length>0;if(isObj(v))return Object.keys(v).length>0;return true}
function customerRecoveryAliases(c){
 const out=[],seen=new Set();if(!isObj(c))return out;['id','customerId','account','customerNumber','kundennummer','customerAccount','number','name','customerName'].forEach(k=>{const v=lower(c[k]);if(v&&!seen.has(v)){seen.add(v);out.push(v)}});return out
}
function customerRecoveryScore(c){
 if(!isObj(c))return 0;let score=0;const weights={id:12,customerId:12,account:18,customerNumber:18,kundennummer:18,name:16,customerName:16,address:12,country:5,land:5,customerMail:8,customerEmail:8,email:6,carrierEmail:6,carrierMail:6,speditionMail:6,salesMail:6,salesEmail:6,salesPersonMail:6,salesPersonEmail:6,salesContactMail:6,salesContactEmail:6,rc385SalesMail:6,cc:4,mailCc:4,locations:12,sites:12,standorte:12,mailTemplates:18,customerMailTemplateDe:8,customerMailTemplateEn:8,carrierMailTemplateDe:8,carrierMailTemplateEn:8,ownMailTemplateDe:10,ownMailTemplateEn:10,rc385OwnTplDe:8,rc385OwnTplEn:8,rc543OwnTplDe:8,rc543OwnTplEn:8,portalName:4,portalUrl:4,processNotes:6};Object.keys(weights).forEach(k=>{if(customerRecoveryValue(c[k]))score+=weights[k]});return score
}
function customerSame(a,b){const aa=customerRecoveryAliases(a),bb=new Set(customerRecoveryAliases(b));return aa.some(v=>bb.has(v))}
function customerTombstoned(state,c){
 const ids=new Set(customerRecoveryAliases(c)),meta=isObj(state&&state._teamSyncMeta)?state._teamSyncMeta:{},list=arr(meta.tombstones);return list.some(t=>lower(t&&t.collection)==='customers'&&ids.has(lower(t&&t.id)))
}
function customerRecoveryFieldStamp(c,key){return String(c&&isObj(c._syncFields)&&c._syncFields[key]||'')}
function mergeMissingCustomerFields(target,source){
 if(!isObj(target)||!isObj(source))return false;let changed=false;Object.keys(source).forEach(k=>{if(k==='_syncFields'||k==='_syncUpdatedAt')return;const sv=source[k],tv=target[k];if(!customerRecoveryValue(sv))return;const targetStamp=customerRecoveryFieldStamp(target,k),sourceStamp=customerRecoveryFieldStamp(source,k);if(!customerRecoveryValue(tv)){if(targetStamp&&(!sourceStamp||targetStamp>=sourceStamp))return;target[k]=clone(sv);changed=true;return}if(isObj(tv)&&isObj(sv)&&!Array.isArray(tv)&&!Array.isArray(sv)){if(targetStamp&&sourceStamp&&targetStamp>=sourceStamp)return;if(mergeMissingCustomerFields(tv,sv))changed=true}});return changed
}
function collectCustomerCandidatesFromDoc(doc,source,out){
 const st=stateOfDocument(doc);arr(st&&st.customers).forEach(c=>{if(!isObj(c)||!customerRecoveryAliases(c).length)return;out.push({customer:clone(c),source,score:customerRecoveryScore(c)})})
}
async function scanHistoricalCustomers(container,maxVersions=500,teamBlobName,recoveryPrefix,allowDiscovery){
 const history=await listHistory(container,teamBlobName,recoveryPrefix,allowDiscovery),candidates=[],max=Math.max(1,Math.min(800,Number(maxVersions)||500));let scanned=0,readErrors=0;
 for(let i=0;i<history.length&&i<max;i++){
  const source=history[i];try{const d=await readJson(historyClient(container,source,teamBlobName),emptyTeam(),false),doc=d.value||emptyTeam();scanned++;collectCustomerCandidatesFromDoc(doc,source,candidates)}catch(_){readErrors++}
 }
 const best=[];candidates.sort((a,b)=>b.score-a.score);candidates.forEach(item=>{const hit=best.find(x=>customerSame(x.customer,item.customer));if(!hit)best.push(item);else if(item.score>hit.score){hit.customer=item.customer;hit.source=item.source;hit.score=item.score}});
 return {historyCount:history.length,scanned,readErrors,best}
}
async function previewCustomerRecovery(container,teamBlob,payload,teamBlobName,recoveryPrefix,allowDiscovery){
 const fresh=await readJson(teamBlob,emptyTeam(),false),current=fresh.value||emptyTeam(),state=clone(current.state||{});state.customers=arr(state.customers).map(clone);
 const history=await scanHistoricalCustomers(container,payload&&payload.maxVersions||500,teamBlobName,recoveryPrefix,allowDiscovery);let restorable=0,fillable=0;const restorableAccounts=[],fillableAccounts=[];
 history.best.forEach(item=>{const c=item.customer;if(customerRecoveryScore(c)<34)return;const hit=state.customers.find(x=>customerSame(x,c));if(hit){const trial=clone(hit);if(mergeMissingCustomerFields(trial,c)){fillable++;const acc=cleanScalar(hit.account||hit.customerNumber||hit.kundennummer||hit.name||hit.customerName);if(acc)fillableAccounts.push(acc)}return}if(customerTombstoned(state,c))return;restorable++;const acc=cleanScalar(c.account||c.customerNumber||c.kundennummer||c.name||c.customerName);if(acc)restorableAccounts.push(acc)});
 return {ok:true,preview:true,currentCount:state.customers.length,historyCount:history.historyCount,scanned:history.scanned,readErrors:history.readErrors,candidateCount:history.best.length,restorable,fillable,restorableAccounts,fillableAccounts,noImprovement:restorable===0&&fillable===0}
}

async function recoverCustomers(container,teamBlob,payload,user,teamBlobName,recoveryPrefix,allowDiscovery){
 const fresh=await readJson(teamBlob,emptyTeam(),false),current=fresh.value||emptyTeam(),state=clone(current.state||{});state.customers=arr(state.customers).map(clone);
 const history=await scanHistoricalCustomers(container,payload&&payload.maxVersions||500,teamBlobName,recoveryPrefix,allowDiscovery);let restored=0,filled=0;const restoredAccounts=[],restoredIds=[];
 history.best.forEach(item=>{const c=item.customer;if(customerRecoveryScore(c)<34)return;const hit=state.customers.find(x=>customerSame(x,c));if(hit){if(mergeMissingCustomerFields(hit,c))filled++;return}if(customerTombstoned(state,c))return;state.customers.push(clone(c));restored++;const acc=cleanScalar(c.account||c.customerNumber||c.kundennummer),id=cleanScalar(c.id||c.customerId);if(acc)restoredAccounts.push(acc);if(id)restoredIds.push(id)});
 if(!restored&&!filled)throw error('CUSTOMER_RECOVERY_NO_IMPROVEMENT','In der Azure-Historie wurden keine besseren Kundendaten oder Kundenvorlagen als im aktuellen Stand gefunden. Es wurde nichts verändert.',409);
 const backupName=await safetyBackup(container,current,'team-state-before-RC770-customer-recovery',recoveryPrefix),next=clone(current);next.schemaVersion=Math.max(3,Number(current.schemaVersion||3));next.revision=Number(current.revision||0)+1;next.updatedAt=now();next.updatedBy=text(user.name||user.user);next.updatedByUserId=text(user.id);next.clientVersion='RC770-customer-recovery';next.state=state;next.customerRecoveryAudit={at:next.updatedAt,by:next.updatedBy,backupBlob:backupName,historyCount:history.historyCount,scanned:history.scanned,readErrors:history.readErrors,restored,filled,restoredAccounts,restoredIds};
 try{await uploadJson(teamBlob,next,fresh.etag)}catch(e){if(e&&(e.statusCode===409||e.statusCode===412))throw error('CONCURRENT_UPDATE','Der Azure-Teamstand wurde während der Kundenrettung gleichzeitig geändert. Die Wiederherstellung wurde sicher abgebrochen und kann erneut gestartet werden.',409);if(e&&e.statusCode>=500)throw error('STORAGE_UNREACHABLE','Azure Storage konnte den wiederhergestellten Kundenstand nicht speichern: '+(e.message||'Serverfehler'),503);throw e}
 return {ok:true,recovered:true,revision:next.revision,updatedAt:next.updatedAt,backupBlob:backupName,historyCount:history.historyCount,scanned:history.scanned,readErrors:history.readErrors,restored,filled,restoredAccounts,restoredIds,state:next.state,users:next.users||current.users||[]}
}


module.exports=async function(context,req){
 const requestStarted=Date.now();
 if(req.method==='OPTIONS'){context.res={status:204,headers:{'Cache-Control':'no-store','Allow':'GET, POST, OPTIONS'},body:''};return}
 try{
  const payload=body(req),queryMode=req.query?lower(req.query.mode):'',mode=queryMode||lower(payload.action||payload.mode);
  if(mode==='ping'){const environment=requestedEnvironment(req,payload);context.res=json(200,{ok:true,service:'exporthub-state',version:API_VERSION,routeReachable:true,storageChecked:false,environment,blob:teamBlobForEnvironment(environment),time:now()});return}
  if(mode==='health'){
   const c=await clients(req,payload),authStarted=Date.now();
   let authReadable=true;try{await readJson(c.auth,emptyAuth(),true)}catch(e){authReadable=false;throw error('STORAGE_UNREACHABLE','ExportHUB kann den Auth-Blob im konfigurierten Azure-Speicher nicht lesen: '+(e&&e.message||'Unbekannter Speicherfehler'),503)}
   await ensureEnvironmentTeam(c);const authReadMs=Date.now()-authStarted,teamStarted=Date.now(),teamCheck=await readTeamResilient(c.container,c.team,c.teamBlobName,c.recoveryPrefix,c.allowGenericRecoveryDiscovery),teamReadMs=Date.now()-teamStarted;
   context.res=json(200,{ok:true,service:'exporthub-state',version:API_VERSION,storageConfigured:true,storageReachable:true,authBlobReadable:authReadable,teamStateReadable:true,teamStateRecoveredFromHistory:teamCheck.recoveredFromHistory===true,storageSource:connectionSource(),container:TEAM_CONTAINER,environment:c.environment,blob:c.teamBlobName,authReadMs,teamReadMs,totalMs:Date.now()-requestStarted,time:now()});return;
  }
  const c=await clients(req,payload),current=await validateSession(req,payload,c),blob=c.team;
  if(req.method==='GET'||(req.method==='POST'&&(mode==='read'||mode==='meta'))){
   if(mode==='meta'||(req.query&&String(req.query.meta||'')==='1')){context.res=json(200,Object.assign({ok:true,metaOnly:true,environment:c.environment,blob:c.teamBlobName},await metadataOnly(blob)));return}
   const client=sanitizeForClient(current.team||emptyTeam(),isAdmin(current.user));context.res=json(200,Object.assign({ok:true,serverVersion:API_VERSION,environment:c.environment,blob:c.teamBlobName,teamStateRecoveredFromHistory:current.teamRecoveredFromHistory===true,teamRecoverySource:current.teamRecoverySource||null},client));return
  }
  if(req.method==='POST'){
   if(mode==='recovery-preview'){
    if(!isAdmin(current.user))throw error('ADMIN_REQUIRED','Die Sendungswiederherstellung ist nur für globale Administratoren verfügbar.',403);
    context.res=json(200,await recoveryPreview(c.container,payload,c.teamBlobName,c.recoveryPrefix,c.allowGenericRecoveryDiscovery));return
   }
   if(mode==='recover-shipments'){
    if(!isAdmin(current.user))throw error('ADMIN_REQUIRED','Die Sendungswiederherstellung ist nur für globale Administratoren verfügbar.',403);
    context.res=json(200,await recoverShipments(c.container,blob,payload,current.user,c.teamBlobName,c.recoveryPrefix,c.allowGenericRecoveryDiscovery));return
   }
   if(mode==='recovery-preview-customers'){
    if(!isAdmin(current.user))throw error('ADMIN_REQUIRED','Die Kunden-Historienprüfung ist nur für globale Administratoren verfügbar.',403);
    context.res=json(200,await previewCustomerRecovery(c.container,blob,payload,c.teamBlobName,c.recoveryPrefix,c.allowGenericRecoveryDiscovery));return
   }
   if(mode==='recover-customers'){
    if(!isAdmin(current.user))throw error('ADMIN_REQUIRED','Die Kundenwiederherstellung ist nur für globale Administratoren verfügbar.',403);
    context.res=json(200,await recoverCustomers(c.container,blob,payload,current.user,c.teamBlobName,c.recoveryPrefix,c.allowGenericRecoveryDiscovery));return
   }
   if(mode&&mode!=='save')throw error('UNKNOWN_STATE_ACTION','Unbekannte Teamdatenaktion.',400);
   if(!hasAnyEditRight(current.user))throw error('WRITE_FORBIDDEN','Für Änderungen fehlen Bearbeitungsrechte.',403);
   let corruptBackup=null;if(current.teamRecoveredFromHistory===true&&current.teamCurrentCorrupt===true)corruptBackup=await safetyRawBackup(c.container,blob,'corrupt-team-state-before-RC855-save',c.recoveryPrefix);
   const saved=await saveMerged(blob,normalizeIncoming(payload),current.user,current.team,current.teamEtag),client=sanitizeForClient(saved,isAdmin(current.user));saved.dataEnvironment=c.environment;
   if(corruptBackup)saved.corruptBackup=corruptBackup;
   const serverMs=Date.now()-requestStarted,full=req.query&&String(req.query.full||'')==='1',ack=!full&&req.query&&(String(req.query.ack||'')==='1'||lower(req.query.mode)==='ack'||lower(req.query.mode)==='save');
   if(ack){const out={ok:true,ackOnly:true,schemaVersion:Number(saved.schemaVersion||3),revision:Number(saved.revision||0),updatedAt:saved.updatedAt||null,updatedBy:saved.updatedBy||null,concurrentMerge:saved.concurrentMerge===true,idempotentReplay:saved.idempotentReplay===true,serverVersion:API_VERSION,environment:c.environment,blob:c.teamBlobName,serverMs,corruptBackup:saved.corruptBackup||null};context.res=json(200,out);return}
   context.res=json(200,Object.assign({ok:true,environment:c.environment,blob:c.teamBlobName,serverMs},client));return
  }
  context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'GET, POST, OPTIONS'});
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('ExportHUB state API error',e&&e.code,e&&e.message)}catch(_){}
  context.res=json(e&&(e.status||e.statusCode)?Number(e.status||e.statusCode):500,{ok:false,code:e&&e.code?e.code:'SERVER_ERROR',message:e&&e.message?e.message:'Unbekannter Speicherfehler.'});
 }
};
