'use strict';

// RC1876: isolated, ETag-guarded ledger for concrete pickup/transport links.
// This is a backend building block, NOT an HTTP endpoint. Callers must first
// authenticate, authorize, and load shipment/task/transport evidence server-side.
const crypto=require('node:crypto');
const {createBlobServiceClient}=require('./blob-rest');
const rule=require('./pickup-transport-association-rules');
const CONTAINER=process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data';
const PREFIX=String(process.env.EXPORTHUB_PICKUP_TRANSPORT_LINKS_PREFIX||'pickup-transport-links').replace(/^\/+|\/+$/g,'');
function text(v){return String(v==null?'':v).trim()}
function fail(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;e.statusCode=status;throw e}
function scope(input){
 const environment=text(input&&input.environment).toLowerCase(),companyKey=rule.key(input&&input.companyKey);
 if(!companyKey||!['production','testservice'].includes(environment))fail('LINK_SCOPE_INVALID','Firma oder Umgebung ungültig');
 return {environment,companyKey};
}
function pathFor(input){
 const s=scope(input);
 const company=crypto.createHash('sha256').update(s.companyKey).digest('hex').slice(0,24);
 return (s.environment==='testservice'?'testservice/':'')+PREFIX+'/'+company+'.json';
}
function connection(){
 return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.EXPORTHUB_STORAGE_CONNECTION||
   process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||'';
}
function empty(s){return {schemaVersion:1,environment:s.environment,companyKey:s.companyKey,revision:0,updatedAt:null,links:[],audit:[]}}
function copy(v){return JSON.parse(JSON.stringify(v))}
function actorOf(value){const actor=text(value).replace(/[\x00-\x1f\x7f]/g,' ').slice(0,120);if(!actor)fail('LINK_ACTOR_REQUIRED','Ausführender Benutzer fehlt');return actor}
function revOf(value){if(!Number.isSafeInteger(value)||value<0)fail('LINK_REVISION_REQUIRED','Gültige erwartete Revision erforderlich',409);return value}
function dateOf(v){const d=rule.date(v);if(!d)fail('LINK_DATE_INVALID','Ungültiger Abholtag');return d}
function refOf(v){const ref=rule.ref(v);if(!ref||ref.length>120||!/^[A-Z0-9][A-Z0-9._:/-]*$/.test(ref))fail('LINK_REF_INVALID','Sendungsreferenz ungültig');return ref}
function idOf(v){const id=text(v);if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(id))fail('LINK_ID_INVALID','Transport- oder FIX-ID ungültig');return id}
function assertScopeRecord(record,s){
 if(rule.key(record&&(record.companyKey||record.companyId))!==s.companyKey)
  fail('LINK_COMPANY_MISMATCH','Datensatz gehört zu einer anderen Firma',403);
 if(record&&record.environment&&text(record.environment)!==s.environment)
  fail('LINK_ENVIRONMENT_MISMATCH','Datensatz gehört zu einer anderen Umgebung',403);
}
function cleanDoc(data,s){
 if(!data||typeof data!=='object'||Array.isArray(data)||
    data.schemaVersion!==1||data.environment!==s.environment||data.companyKey!==s.companyKey||
    !Number.isSafeInteger(data.revision)||data.revision<0||!Array.isArray(data.links)||!Array.isArray(data.audit))
    fail('LINK_DOCUMENT_INVALID','Gespeicherter Zuordnungsstand ist unvollständig oder fremd',409);
 const unique=new Set(),activeRefs=new Set();
 for(const item of data.links){
   const r=text(item&&item.ref).toUpperCase(),k=r+'|'+text(item&&item.pickupDate);
   if(!item||!rule.date(item.pickupDate)||!r||unique.has(k)||
      (item.active===true&&activeRefs.has(r)))
     fail('LINK_DOCUMENT_INVALID','Mehrdeutiger Zuordnungsstand',409);
   unique.add(k);
   if(item.active===true)activeRefs.add(r);
 }
 return data;
}
async function load(input){
 const s=scope(input),cs=connection();
 if(!cs)fail('LINK_STORAGE_UNAVAILABLE','ExportHUB-Speicher fehlt',503);
 const blob=createBlobServiceClient(cs).getContainerClient(CONTAINER).getBlockBlobClient(pathFor(s));
 try{
   const response=await blob.download(0);
   let raw='';for await(const chunk of response.readableStreamBody)raw+=Buffer.from(chunk).toString('utf8');
   let data;try{data=JSON.parse(raw)}catch(_){fail('LINK_DOCUMENT_INVALID','Beschädigter Zuordnungsstand',409)}
   return {scope:s,blob,etag:response.etag||null,document:cleanDoc(data,s)};
 }catch(e){
   if(Number(e&&(e.statusCode||e.status))===404)return {scope:s,blob,etag:null,document:empty(s)};
   throw e;
 }
}
function view(data,includeAudit=false){
 const d=data||{},out={environment:d.environment,companyKey:d.companyKey,revision:d.revision,
   links:copy((d.links||[]).filter(x=>x.active===true)),
   manualExclusions:copy((d.links||[]).filter(x=>x.manualLock===true&&x.active===false)
     .map(x=>({ref:x.ref,pickupDate:x.pickupDate})))};
 if(includeAudit)out.audit=copy(d.audit||[]);
 return out;
}
async function read(input,options={}){
 const loaded=await load(input);
 return view(loaded.document,options.includeAudit===true);
}
function guardRevision(doc,expected){if(doc.revision!==revOf(expected))fail('LINK_REVISION_CONFLICT','Der Zuordnungsstand wurde zwischenzeitlich geändert',409)}
function appendAudit(doc,action,oldLink,newLink,actor,reason,at){
 doc.audit.push({id:'AUD-'+crypto.randomBytes(12).toString('hex'),revision:doc.revision+1,at,
   by:actor,action,reason:text(reason).slice(0,300),
   ref:text((newLink||oldLink).ref),pickupDate:text((newLink||oldLink).pickupDate),
   oldTransportId:text(oldLink&&oldLink.transportId),newTransportId:text(newLink&&newLink.transportId)});
}
async function commit(loaded,next){
 next.revision=loaded.document.revision+1;next.updatedAt=new Date().toISOString();
 try{
   const raw=JSON.stringify(next);
   await loaded.blob.upload(raw,Buffer.byteLength(raw),{
     blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},
     conditions:loaded.etag?{ifMatch:loaded.etag}:{ifNoneMatch:'*'},transportAttempts:1
   });
 }catch(e){if([409,412].includes(Number(e&&(e.statusCode||e.status))))fail('LINK_CONCURRENT_UPDATE','Parallele Zuordnungsänderung erkannt',409);throw e}
 return view(next);
}
// Proposals must originate from the authenticated caller's authoritative
// server-side lists. No UI-provided "verified" flag bypasses validation.
async function applyAutomatic({environment,companyKey,pickupDate,expectedRevision,actor,transports,tasks,shipments}={}){
 const loaded=await load({environment,companyKey}),doc=loaded.document,s=loaded.scope;
 guardRevision(doc,expectedRevision);actor=actorOf(actor);
 const day=dateOf(pickupDate);
 const lists=[transports||[],tasks||[],shipments||[]];
 for(const list of lists){
   if(!Array.isArray(list))fail('LINK_EVIDENCE_INVALID','Ungültige serverseitige Quelldaten',409);
   for(const record of list){
     if(record&&record.environment&&text(record.environment)!==s.environment)
       fail('LINK_ENVIRONMENT_MISMATCH','Fremde Datenumgebung in Zuordnungsnachweis',403);
   }
 }
 const evidence={companyKey:s.companyKey,environment:s.environment,pickupDate:day,
   transports:lists[0],tasks:lists[1],shipments:lists[2],existingLinks:doc.links};
 const result=rule.propose(evidence),next=copy(doc),added=[],conflicts=[...result.conflicts],at=new Date().toISOString();
 for(const proposal of result.proposals){
   const r=refOf({reference:proposal.ref}),id=idOf(proposal.transportId),fixId=idOf(proposal.fixId);
   const old=next.links.find(x=>x.ref===r&&x.pickupDate===day);
   if(old){
     if(old.manualLock){conflicts.push({code:'MANUAL_UNLINK_PROTECTED',ref:r});continue}
     if(old.active&&old.transportId===id)continue;
     conflicts.push({code:'EXISTING_LINK_CONFLICT',ref:r});continue;
   }
   if(next.links.some(x=>x.ref===r&&x.active===true)){
     conflicts.push({code:'EXISTING_LINK_CONFLICT',ref:r});continue;
   }
   const row={ref:r,transportId:id,fixId,pickupDate:day,mode:'automatic',active:true,
     manualLock:false,createdAt:at,createdBy:actor,updatedAt:at,updatedBy:actor};
   next.links.push(row);appendAudit(next,'automatic-link',null,row,actor,'Rule-matched',at);added.push(r);
 }
 if(!added.length)return {...view(doc),added,conflicts};
 const saved=await commit(loaded,next);
 return {...saved,added,conflicts};
}
// Manual changes require authoritative shipment+transport objects from a
// server-side reader, including real company/date/status, not browser claims.
// The HTTP layer must require the specific plan-edit permission.
async function applyManual({environment,companyKey,expectedRevision,actor,reason,action,shipment,transport,pickupDate,confirmOverride=false}={}){
 const loaded=await load({environment,companyKey}),doc=loaded.document,s=loaded.scope;
 guardRevision(doc,expectedRevision);actor=actorOf(actor);
 const why=text(reason).replace(/[\x00-\x1f\x7f]/g,' ').slice(0,300);
 if(why.length<8)fail('LINK_REASON_REQUIRED','Begründung für manuelle Korrektur fehlt');
 if(!['link','unlink'].includes(action))fail('LINK_ACTION_INVALID','Unbekannte Link-Aktion');
 const day=dateOf(pickupDate),r=refOf(shipment);
 assertScopeRecord(shipment,s);
 if(rule.date(text(shipment&&(shipment.plannedPickupDate||shipment.pickupDate||shipment.pickdate)).slice(0,10))!==day)
   fail('LINK_DATE_MISMATCH','Sendung gehört nicht zu diesem Abholtag',409);
 if(rule.isCancelled(shipment))fail('LINK_SHIPMENT_CANCELLED','Stornierte Sendung darf nicht verknüpft werden',409);
 if(rule.isComplete(shipment)&&confirmOverride!==true)
   fail('LINK_SHIPMENT_LOCKED','Abgeholte Sendung erfordert bestätigten Eingriff',409);
 const next=copy(doc),old=next.links.find(x=>x.ref===r&&x.pickupDate===day)||null,at=new Date().toISOString();
 let row;
 if(action==='link'){
   if(!transport||transport.registered!==true)fail('LINK_TRANSPORT_UNVERIFIED','Haupttransport ist nicht bestätigt',409);
   assertScopeRecord(transport,s);
   if(rule.date(transport.pickupDate||transport.plannedPickupDate)!==day)
     fail('LINK_DATE_MISMATCH','Haupttransport gehört zu einem anderen Datum',409);
   if(rule.isCancelled(transport))fail('LINK_TRANSPORT_CANCELLED','Stornierter Haupttransport',409);
   const id=idOf(transport.id||transport.transportId),fixId=idOf(transport.pickupTargetId);
   if(old&&(old.transportId!==id||old.active===false)&&confirmOverride!==true)
     fail('LINK_OVERRIDE_CONFIRMATION_REQUIRED','Bestehende Zuordnung erfordert Bestätigung',409);
   if(next.links.some(x=>x.ref===r&&x.active===true&&x.pickupDate!==day))
     fail('LINK_EXISTING_OTHER_DATE','REF ist einem anderen Abholtag zugeordnet',409);
   if(old&&old.transportId===id&&old.active===true&&old.mode==='manual')
     return {...view(doc),changed:false};
   row={...(old||{}),ref:r,transportId:id,fixId,pickupDate:day,
     mode:'manual',active:true,manualLock:true,createdAt:old&&old.createdAt||at,
     createdBy:old&&old.createdBy||actor,updatedAt:at,updatedBy:actor};
 }else{
   row={...(old||{}),ref:r,transportId:text(old&&old.transportId),fixId:text(old&&old.fixId),
     pickupDate:day,mode:'manual',active:false,manualLock:true,
     createdAt:old&&old.createdAt||at,createdBy:old&&old.createdBy||actor,
     updatedAt:at,updatedBy:actor};
   if(old&&old.manualLock&&old.active===false)return {...view(doc),changed:false};
 }
 if(old)next.links[next.links.indexOf(next.links.find(x=>x.ref===r&&x.pickupDate===day))]=row;
 else next.links.push(row);
 appendAudit(next,action==='link'?'manual-link':'manual-unlink',old,row,actor,why,at);
 return {...await commit(loaded,next),changed:true};
}
module.exports={pathFor,read,applyAutomatic,applyManual};
