
'use strict';

const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');
const { mergeState, sanitizeState, pruneTombstones, clone } = require('../shared/merge');

const TEAM_CONTAINER = process.env.EXPORTHUB_STORAGE_CONTAINER || process.env.EXPORTHUB_CONTAINER || 'exporthub-data';
const TEAM_BLOB = process.env.EXPORTHUB_STORAGE_BLOB || process.env.EXPORTHUB_STATE_BLOB || 'team-state.json';
const AUTH_BLOB = process.env.EXPORTHUB_AUTH_BLOB || 'auth-sessions.json';
const MAX_RETRIES = 6;

function text(v){ return String(v == null ? '' : v).trim(); }
function lower(v){ return text(v).toLowerCase(); }
function now(){ return new Date().toISOString(); }
function error(code,message,status=400){ const e=new Error(message); e.code=code; e.status=status; return e; }
function json(status,body,headers={}){ return {status,headers:Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},headers),body:JSON.stringify(body)}; }
function body(req){ if(req&&req.body&&typeof req.body==='object')return req.body; try{return JSON.parse(req&&req.body||'{}')}catch(_){return {}} }
function connectionString(){ return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || ''; }
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
async function clients(){
 const cs=connectionString();
 if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);
 let service; try{service=BlobServiceClient.fromConnectionString(cs)}catch(e){throw error('STORAGE_NOT_CONFIGURED','Die Azure-Speicherverbindung ist ungültig.',503)}
 const container=service.getContainerClient(TEAM_CONTAINER);
 return {container,team:container.getBlockBlobClient(TEAM_BLOB),auth:container.getBlockBlobClient(AUTH_BLOB)};
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
  catch(e){if(repairAuth)return {value:clone(fallback),etag:r.etag||null,repairedInvalidJson:true};throw e}
 }catch(e){if(e&&e.statusCode===404)return {value:clone(fallback),etag:null};throw e}
}
async function uploadJson(blob,value,etag){
 const raw=JSON.stringify(value);
 return blob.upload(raw,Buffer.byteLength(raw),{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions:etag?{ifMatch:etag}:{ifNoneMatch:'*'},metadata:{schema:String(value.schemaVersion||3),revision:String(value.revision||0),updatedepoch:String(Date.parse(value.updatedAt||'')||Date.now()),clientversion:String(value.clientVersion||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)}});
}
function emptyTeam(){return {schemaVersion:3,revision:0,updatedAt:null,updatedBy:null,state:{},users:[]}}
function emptyAuth(){return {schemaVersion:1,updatedAt:null,sessions:[]}}
async function validateSession(req,payload,c){
 const token=bearer(req,payload);if(!token)throw error('AUTH_REQUIRED','ExportHUB-Anmeldung erforderlich.',401);
 const reads=await Promise.all([readJson(c.auth,emptyAuth(),true),readJson(c.team,emptyTeam(),false)]);
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
 return {token,session,user,team,teamEtag:teamDoc.etag,sessionSource:source};
}
function sanitizeForClient(document,adminView){
 const out=clone(document||emptyTeam());delete out.authBootstrap;out.users=publicUsers(out.users,adminView);out.state=out.state&&typeof out.state==='object'?out.state:{};out.state.users=clone(out.users);return out;
}
async function metadataOnly(blob){
 try{const p=await blob.getProperties(),m=p.metadata||{};if(m.revision!==undefined)return {schemaVersion:Number(m.schema||3),revision:Number(m.revision||0),updatedAt:m.updatedepoch?new Date(Number(m.updatedepoch)).toISOString():(p.lastModified||null),clientVersion:m.clientversion||null};
 const d=await readJson(blob,emptyTeam());const v=d.value||emptyTeam();return {schemaVersion:Number(v.schemaVersion||3),revision:Number(v.revision||0),updatedAt:v.updatedAt||null,clientVersion:v.clientVersion||null};}
 catch(e){if(e&&e.statusCode===404)return {schemaVersion:3,revision:0,updatedAt:null,clientVersion:null};throw e}
}
function normalizeIncoming(payload){const state=sanitizeState(payload.state||{});delete state.users;return {clientVersion:text(payload.clientVersion),baseRevision:Number(payload.baseRevision||0),deviceId:text(payload.deviceId),reason:text(payload.reason||'save'),state}}
async function saveMerged(blob,incoming,user,initialTeam,initialEtag){
 let d={value:initialTeam||emptyTeam(),etag:initialEtag||null};
 for(let attempt=0;attempt<MAX_RETRIES;attempt++){
  if(attempt>0)d=await readJson(blob,emptyTeam());
  const current=d.value||emptyTeam();
  const merged=pruneTombstones(mergeState(current.state||{},incoming.state||{}));delete merged.users;merged.users=publicUsers(current.users||[],false);
  const next={schemaVersion:3,revision:Number(current.revision||0)+1,updatedAt:now(),updatedBy:text(user.name||user.user),updatedByUserId:text(user.id),updatedByDevice:incoming.deviceId||null,clientVersion:incoming.clientVersion||null,state:merged,users:current.users||[],authBootstrap:current.authBootstrap&&typeof current.authBootstrap==='object'?clone(current.authBootstrap):undefined};
  try{await uploadJson(blob,next,d.etag);next.concurrentMerge=Number(incoming.baseRevision||0)!==Number(current.revision||0);next.baseRevision=Number(incoming.baseRevision||0);return next}catch(e){if(e&&e.statusCode===412&&attempt<MAX_RETRIES-1)continue;throw e}
 }
 throw error('CONCURRENT_UPDATE','Der Teamstand konnte nach mehreren Konfliktversuchen nicht gespeichert werden.',409);
}


/* RC614: administrative, non-destructive shipment recovery from Azure blob history. */
const RC614_TARGET_COUNT=25;
const RC614_EVIDENCE_REFS=[
 'PKC5WB','8DAXMV','W4MY9T','ECUFAU','BT7U4H','6ZQ6AT','94XD9K','CPZM5E',
 'KLQA2M','PWFB8E','UBF78K','D97W6U','ONIYV3','Y4ABSN','ASZ9JM','J84J2S'
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
 const vals=[sh.ref,sh.reference,sh.shipmentRef,sh.referenceNumber,sh.exporthubRef,sh.exportHubReference];
 for(const v of vals){const x=cleanScalar(v).toUpperCase();if(/^[A-Z0-9]{6}$/.test(x))return x}
 return '';
}
function idOf(sh){return cleanScalar(sh&&(sh.id||sh.shipmentId||sh._syncId))}
function identityOf(sh){return refOf(sh)||idOf(sh).toLowerCase()}
function customerOf(sh){
 if(!isObj(sh))return '';
 const vals=[sh.customerName,sh.customerDisplay,sh.consigneeName,sh.recipientName,sh.companyName];
 for(const v of vals){const x=cleanScalar(v);if(x)return x}
 if(typeof sh.customer==='string'){const x=cleanScalar(sh.customer);if(x)return x}
 if(isObj(sh.customer)){const x=cleanScalar(sh.customer.name||sh.customer.customerName||sh.customer.companyName);if(x)return x}
 return '';
}
function rowList(sh){return arr(sh&&(sh.rows||sh.colli||sh.collis||sh.packages||sh.packagingRows))}
function docCount(sh){
 if(!isObj(sh))return 0;
 const fields=['podFiles','abdFiles','deliveryFiles','deliveryNotesFiles','lieferscheine','documents','generatedDocuments','files','attachments','invoiceFiles','mailAttachments'];
 return fields.reduce((n,k)=>n+arr(sh[k]).length,0);
}
function recoveryFlagged(sh){
 return !!(sh&&(sh.recoveryIncomplete===true||sh._recoveredFromLocationRecord===true||lower(sh.recoverySource)==='location-booking'||lower(sh.customerName)==='false'||lower(sh.customer)==='false'));
}
function shipmentRichness(sh){
 if(!isObj(sh))return 0;
 let n=0;
 if(refOf(sh))n+=40;
 if(customerOf(sh))n+=50;
 if(cleanScalar(sh.customerId||sh.customerAccount||sh.customerNumber))n+=15;
 if(cleanScalar(sh.recipientAddress||sh.destinationAddress||sh.address))n+=15;
 const rows=rowList(sh);if(rows.length)n+=Math.min(60,rows.length*12);
 n+=Math.min(60,docCount(sh)*8);
 if(cleanScalar(sh.pickupDate||sh.plannedPickupDate||sh.actualPickupDate))n+=8;
 if(cleanScalar(sh.status||sh.processStatus))n+=5;
 if(recoveryFlagged(sh))n-=100;
 return n;
}
function bestShipmentSet(state){
 const map=new Map();
 arr(state&&state.shipments).concat(arr(state&&state.savedShipments)).forEach(sh=>{
  if(!isObj(sh))return;
  const k=identityOf(sh);if(!k)return;
  const cur=map.get(k);
  if(!cur||shipmentRichness(sh)>shipmentRichness(cur))map.set(k,clone(sh));
 });
 return Array.from(map.values());
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
function candidateStats(doc,knownRefs){
 const state=isObj(doc&&doc.state)?doc.state:{};
 const list=bestShipmentSet(state), known=new Set(arr(knownRefs).map(x=>String(x).toUpperCase()));
 let validCustomer=0,rich=0,suspect=0,knownHits=0,activeCount=0,activeValidCustomer=0,activeRich=0,activeSuspect=0;
 const refs=[],activeRefs=[],statusCounts={};
 list.forEach(sh=>{
  const ref=refOf(sh);if(ref)refs.push(ref);
  const customerOk=!!customerOf(sh),richOk=shipmentRichness(sh)>=90,suspectFlag=recoveryFlagged(sh)||!customerOk;
  if(customerOk)validCustomer++;
  if(richOk)rich++;
  if(suspectFlag)suspect++;
  if(ref&&known.has(ref))knownHits++;
  const sk=normalizedStatus(sh);statusCounts[sk]=(statusCounts[sk]||0)+1;
  if(sk!=='archiviert'&&sk!=='storniert'){
   activeCount++;if(ref)activeRefs.push(ref);
   if(customerOk)activeValidCustomer++;
   if(richOk)activeRich++;
   if(suspectFlag)activeSuspect++;
  }
 });
 const count=list.length, ratio=count?validCustomer/count:0,activeRatio=activeCount?activeValidCustomer/activeCount:0;
 return {count,activeCount,validCustomer,validCustomerRatio:ratio,activeValidCustomer,activeValidCustomerRatio:activeRatio,rich,activeRich,suspect,activeSuspect,knownHits,refs,activeRefs,statusCounts};
}
function sourceDescriptor(item){
 return {
  versionId:cleanScalar(item&&item.versionId),
  snapshot:cleanScalar(item&&item.snapshot),
  lastModified:item&&item.properties&&item.properties.lastModified?new Date(item.properties.lastModified).toISOString():null,
  clientVersion:item&&item.metadata&&cleanScalar(item.metadata.clientversion),
  isCurrentVersion:item&&item.isCurrentVersion===true
 };
}
function historyClient(container,source){
 let b=container.getBlobClient(TEAM_BLOB);
 if(source&&source.versionId)b=b.withVersion(source.versionId);
 else if(source&&source.snapshot)b=b.withSnapshot(source.snapshot);
 return b;
}
async function listHistory(container){
 const out=[];
 try{
  for await(const item of container.listBlobsFlat({prefix:TEAM_BLOB,includeVersions:true,includeSnapshots:true,includeMetadata:true,includeDeleted:true,includeDeletedWithVersions:true})){
   if(item.name!==TEAM_BLOB)continue;
   const d=sourceDescriptor(item);
   if(d.isCurrentVersion===true)continue;
   if(!d.versionId&&!d.snapshot)continue;
   out.push(d);
  }
 }catch(e){
  try{
   for await(const item of container.listBlobsFlat({prefix:TEAM_BLOB,includeVersions:true,includeSnapshots:true,includeMetadata:true})){
    if(item.name!==TEAM_BLOB)continue;
    const d=sourceDescriptor(item);
    if(d.isCurrentVersion===true)continue;
    if(!d.versionId&&!d.snapshot)continue;
    out.push(d);
   }
  }catch(inner){throw error('RECOVERY_HISTORY_UNAVAILABLE','Azure konnte die Versionshistorie von '+TEAM_BLOB+' nicht auflisten: '+(inner&&inner.message||e&&e.message||'Unbekannter Fehler'),500)}
 }
 out.sort((a,b)=>Date.parse(b.lastModified||0)-Date.parse(a.lastModified||0));
 return out;
}
function safeCandidate(stats,targetCount){
 const target=Math.max(1,Number(targetCount)||RC614_TARGET_COUNT);
 return stats.activeCount>=target && stats.activeCount<=target+12 &&
        stats.activeValidCustomerRatio>=0.72 &&
        stats.activeRich>=Math.max(12,Math.floor(target*0.60)) &&
        stats.activeSuspect<=Math.max(5,Math.floor(target*0.24)) &&
        (stats.knownHits>=3||stats.activeValidCustomer>=Math.max(20,Math.floor(target*0.82)));
}
async function inspectHistory(container,targetCount,knownRefs,maxVersions=70){
 const history=await listHistory(container), inspected=[];
 let bestSafe=null,bestScore=-1;
 const max=Math.max(1,Math.min(100,Number(maxVersions)||70)),priority=['PKC5WB','8DAXMV'];
 for(let i=0;i<history.length&&i<max;i++){
  const source=history[i];
  if(/^RC61[1-4]/i.test(cleanScalar(source.clientVersion)))continue;
  try{
   const d=await readJson(historyClient(container,source),emptyTeam(),false);
   const doc=d.value||emptyTeam(),stats=candidateStats(doc,knownRefs);
   const item={source,stats,safe:safeCandidate(stats,targetCount),revision:Number(doc.revision||0),updatedAt:doc.updatedAt||source.lastModified||null,updatedBy:cleanScalar(doc.updatedBy),clientVersion:cleanScalar(doc.clientVersion||source.clientVersion)};
   inspected.push(item);
   if(item.safe){
    const refs=new Set(stats.refs||[]),priorityHits=priority.filter(r=>refs.has(r)).length;
    const score=priorityHits*10000+Number(stats.knownHits||0)*500+Number(stats.activeValidCustomer||0)*10-Number(stats.activeSuspect||0)*100;
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
 if(Array.isArray(v)&&!v.length)return;
 if(isObj(v)&&!Object.keys(v).length)return;
 target[field]=clone(v);
}
function mergeRestoredShipment(historical,current){
 const hist=clone(historical||{}),cur=isObj(current)?current:{};
 const out=hist;
 delete out.recoveryIncomplete;delete out._recoveredFromLocationRecord;delete out.recoverySource;delete out.recoveryReason;
 const currentCustomer=customerOf(cur),historicalCustomer=customerOf(hist);
 if(currentCustomer&&(!historicalCustomer||shipmentRichness(cur)>=shipmentRichness(hist))){
  ['customerId','customerAccount','customerNumber','customerName','customerDisplay','customer','recipientName','companyName','recipientAddress','destinationAddress','destinationCountry','recipientCountry','locationId','selectedLocationId','siteId','location','locationData','siteData','locationName','site','standort'].forEach(k=>copyIfValid(out,cur,k));
 }
 const curRows=rowList(cur),histRows=rowList(hist);
 if(curRows.length&&(!histRows.length||shipmentRichness(cur)>=shipmentRichness(hist))){
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
  fillFields.forEach(f=>{if(!cleanScalar(x[f])&&cleanScalar(h[f])){x[f]=clone(h[f]);changed=true}});
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
async function safetyBackup(container,doc,label){
 const stamp=now().replace(/[:.]/g,'-'),name='recovery-backups/'+String(label||'team-state').replace(/[^A-Za-z0-9_.-]+/g,'-')+'-'+stamp+'.json';
 const raw=JSON.stringify(doc),blob=container.getBlockBlobClient(name);
 await blob.upload(raw,Buffer.byteLength(raw),{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions:{ifNoneMatch:'*'}});
 return name;
}
async function recoveryPreview(container,payload){
 const target=Math.max(1,Number(payload&&payload.targetCount)||RC614_TARGET_COUNT);
 const known=arr(payload&&payload.knownRefs).length?payload.knownRefs:RC614_EVIDENCE_REFS;
 const result=await inspectHistory(container,target,known,payload&&payload.maxVersions);
 return {
  ok:true,recoveryPreview:true,targetCount:target,historyCount:result.historyCount,
  candidate:result.candidate?{
   source:result.candidate.source,stats:result.candidate.stats,revision:result.candidate.revision,updatedAt:result.candidate.updatedAt,
   updatedBy:result.candidate.updatedBy,clientVersion:result.candidate.clientVersion,safe:true
  }:null,
  inspected:result.inspected.slice(0,12).map(x=>({source:x.source,stats:x.stats||null,safe:x.safe===true,revision:x.revision||0,updatedAt:x.updatedAt||null,clientVersion:x.clientVersion||'',error:x.error||''}))
 };
}
async function recoverShipments(container,teamBlob,payload,user){
 const target=Math.max(1,Number(payload&&payload.targetCount)||RC614_TARGET_COUNT);
 const known=arr(payload&&payload.knownRefs).length?payload.knownRefs:RC614_EVIDENCE_REFS;
 let source=isObj(payload&&payload.source)?payload.source:null,candidateDoc=null,candidateInfo=null;
 if(source&&(source.versionId||source.snapshot)){
  const d=await readJson(historyClient(container,source),emptyTeam(),false);candidateDoc=d.value||emptyTeam();
  const stats=candidateStats(candidateDoc,known);
  if(!safeCandidate(stats,target))throw error('RECOVERY_SOURCE_UNSAFE','Die gewählte historische Version ist nicht vollständig genug für eine sichere Wiederherstellung.',409);
  candidateInfo={source,stats,revision:Number(candidateDoc.revision||0),updatedAt:candidateDoc.updatedAt||source.lastModified||null,clientVersion:cleanScalar(candidateDoc.clientVersion||source.clientVersion)};
 }else{
  const found=await inspectHistory(container,target,known,payload&&payload.maxVersions);
  if(!found.candidate)throw error('NO_SAFE_RECOVERY_VERSION','Es wurde keine ausreichend vollständige historische Azure-Version gefunden. Es wurde nichts verändert.',409);
  candidateInfo=found.candidate;
  const d=await readJson(historyClient(container,candidateInfo.source),emptyTeam(),false);candidateDoc=d.value||emptyTeam();
 }
 const fresh=await readJson(teamBlob,emptyTeam(),false),current=fresh.value||emptyTeam();
 const backupName=await safetyBackup(container,current,'team-state-before-RC614-recovery');
 const merged=mergeHistoricalShipments(current.state||{},candidateDoc.state||{});
 const next=clone(current);
 next.schemaVersion=Math.max(3,Number(current.schemaVersion||3));
 next.revision=Number(current.revision||0)+1;
 next.updatedAt=now();
 next.updatedBy=text(user.name||user.user);
 next.updatedByUserId=text(user.id);
 next.clientVersion='RC614-recovery';
 next.state=merged.state;
 next.recoveryAudit={
  at:next.updatedAt,by:next.updatedBy,source:candidateInfo.source,sourceRevision:candidateInfo.revision,
  sourceUpdatedAt:candidateInfo.updatedAt,backupBlob:backupName,added:merged.added,repaired:merged.repaired,
  backfilled:merged.backfilled,tombstonesRemoved:merged.tombstonesRemoved,restoredRefs:merged.restoredRefs
 };
 await uploadJson(teamBlob,next,fresh.etag);
 return {
  ok:true,recovered:true,revision:next.revision,updatedAt:next.updatedAt,backupBlob:backupName,
  source:candidateInfo.source,sourceRevision:candidateInfo.revision,sourceUpdatedAt:candidateInfo.updatedAt,
  sourceStats:candidateInfo.stats,added:merged.added,repaired:merged.repaired,backfilled:merged.backfilled,
  tombstonesRemoved:merged.tombstonesRemoved,restoredRefs:merged.restoredRefs,
  finalStats:candidateStats(next,known)
 };
}


module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{'Cache-Control':'no-store','Allow':'GET, POST, OPTIONS'},body:''};return}
 try{
  const payload=body(req),c=await clients(),current=await validateSession(req,payload,c),blob=c.team;
  const queryMode=req.query?lower(req.query.mode):'',mode=queryMode||lower(payload.action||payload.mode);
  if(req.method==='GET'||(req.method==='POST'&&(mode==='read'||mode==='meta'))){
   if(mode==='meta'||(req.query&&String(req.query.meta||'')==='1')){context.res=json(200,Object.assign({ok:true,metaOnly:true},await metadataOnly(blob)));return}
   const client=sanitizeForClient(current.team||emptyTeam(),isAdmin(current.user));context.res=json(200,Object.assign({ok:true},client));return
  }
  if(req.method==='POST'){
   if(mode==='recovery-preview'){
    if(!isAdmin(current.user))throw error('ADMIN_REQUIRED','Die Sendungswiederherstellung ist nur für globale Administratoren verfügbar.',403);
    context.res=json(200,await recoveryPreview(c.container,payload));return
   }
   if(mode==='recover-shipments'){
    if(!isAdmin(current.user))throw error('ADMIN_REQUIRED','Die Sendungswiederherstellung ist nur für globale Administratoren verfügbar.',403);
    context.res=json(200,await recoverShipments(c.container,blob,payload,current.user));return
   }
   if(mode&&mode!=='save')throw error('UNKNOWN_STATE_ACTION','Unbekannte Teamdatenaktion.',400);
   if(!hasAnyEditRight(current.user))throw error('WRITE_FORBIDDEN','Für Änderungen fehlen Bearbeitungsrechte.',403);
   const saved=await saveMerged(blob,normalizeIncoming(payload),current.user,current.team,current.teamEtag),client=sanitizeForClient(saved,isAdmin(current.user));
   const ack=req.query&&(String(req.query.ack||'')==='1'||lower(req.query.mode)==='ack'||lower(req.query.mode)==='save');
   if(ack){const out={ok:true,ackOnly:true,schemaVersion:Number(saved.schemaVersion||3),revision:Number(saved.revision||0),updatedAt:saved.updatedAt||null,updatedBy:saved.updatedBy||null,concurrentMerge:saved.concurrentMerge===true};if(saved.concurrentMerge){out.state=client.state;out.users=client.users}context.res=json(200,out);return}
   context.res=json(200,Object.assign({ok:true},client));return
  }
  context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'GET, POST, OPTIONS'});
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('ExportHUB state API error',e&&e.code,e&&e.message)}catch(_){}
  context.res=json(e&&e.status?e.status:500,{ok:false,code:e&&e.code?e.code:'SERVER_ERROR',message:e&&e.message?e.message:'Unbekannter Speicherfehler.'});
 }
};
