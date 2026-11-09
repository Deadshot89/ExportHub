'use strict';

// RC1877: isolated FIX-to-registered-main-shipment binding ledger.
// The caller MUST authenticate the user and derive "proof" from the real
// server-side pickup registration, team state and FIX record. Never trust a
// browser-supplied proof object or write original shipment/QR/POD documents.
const crypto=require('node:crypto');
const {createBlobServiceClient}=require('./blob-rest');
const {key,date}=require('./pickup-transport-association-rules');
const CONTAINER=process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data';
function text(v){return String(v==null?'':v).trim()}
function error(code,message,status=409){const e=new Error(message);e.code=code;e.status=status;e.statusCode=status;return e}
function scope(input){
 const companyKey=key(input&&input.companyKey),environment=text(input&&input.environment);
 if(!companyKey||!['testservice','production'].includes(environment))throw error('BINDING_SCOPE_INVALID','Invalid binding scope',400);
 return {companyKey,environment};
}
function pathFor(input){
 const s=scope(input),hash=crypto.createHash('sha256').update(s.companyKey).digest('hex').slice(0,24);
 return (s.environment==='testservice'?'testservice/':'')+'pickup-transport-bindings/'+hash+'.json';
}
function empty(s){return {schemaVersion:1,...s,revision:0,updatedAt:null,bindings:[],audit:[]}}
function parseDoc(doc,s){
 if(!doc||doc.schemaVersion!==1||doc.companyKey!==s.companyKey||doc.environment!==s.environment||
    !Number.isSafeInteger(doc.revision)||doc.revision<0||!Array.isArray(doc.bindings)||!Array.isArray(doc.audit))
   throw error('BINDING_DOCUMENT_INVALID','Invalid stored binding document');
 const ids=new Set(),refs=new Set();
 for(const row of doc.bindings){
   if(!row||!text(row.shipmentId)||!text(row.reference)||!date(row.pickupDate)||!text(row.pickupTargetId)||
      row.companyKey!==s.companyKey||row.environment!==s.environment||
      ids.has(row.shipmentId)||refs.has(text(row.reference).toUpperCase()))
     throw error('BINDING_DOCUMENT_INVALID','Ambiguous stored binding document');
   ids.add(row.shipmentId);refs.add(text(row.reference).toUpperCase());
 }
 return doc;
}
async function load(input){
 const s=scope(input),cs=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||
   process.env.EXPORTHUB_STORAGE_CONNECTION||process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING||
   process.env.AzureWebJobsStorage;
 if(!cs)throw error('BINDING_STORAGE_UNAVAILABLE','Binding storage unavailable',503);
 const blob=createBlobServiceClient(cs).getContainerClient(CONTAINER).getBlockBlobClient(pathFor(s));
 try{
  const r=await blob.download(0),chunks=[];
  for await(const chunk of r.readableStreamBody)chunks.push(Buffer.from(chunk));
  let doc;try{doc=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch(_){throw error('BINDING_DOCUMENT_INVALID','Corrupt binding storage')}
  return {blob,etag:r.etag||null,scope:s,doc:parseDoc(doc,s)};
 }catch(e){if(Number(e&&e.statusCode)===404)return {blob,etag:null,scope:s,doc:empty(s)};throw e}
}
function view(doc,includeAudit){
 return {revision:doc.revision,environment:doc.environment,companyKey:doc.companyKey,
   bindings:doc.bindings.map(b=>({...b})),...(includeAudit?{audit:doc.audit.map(x=>({...x}))}:{})};
}
async function read(input,options={}){
 const loaded=await load(input);
 return view(loaded.doc,options.includeAudit===true);
}
function checkProof(proof,s,pickupTargetId){
 if(!proof||proof.registered!==true||proof.environment!==s.environment||
   proof.companyKey!==s.companyKey||!text(proof.id||proof.shipmentId)||
   text(proof.pickupTargetId)!==pickupTargetId||!date(proof.pickupDate)||
   !text(proof.reference))
   throw error('BINDING_PROOF_INVALID','Authoritative registration proof missing');
 return {shipmentId:text(proof.id||proof.shipmentId),reference:text(proof.reference).toUpperCase(),
   pickupDate:proof.pickupDate,pickupTargetId};
}
async function applyBinding({environment,companyKey,pickupTargetId,expectedRevision,actor,reason,proof,confirmOverride=false}={}){
 const loaded=await load({environment,companyKey}),s=loaded.scope,doc=loaded.doc;
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==doc.revision)
   throw error('BINDING_REVISION_CONFLICT','Binding revision changed');
 const target=text(pickupTargetId);
 const safe=checkProof(proof,s,target);
 const who=text(actor).slice(0,120),why=text(reason).slice(0,300);
 if(!who||why.length<8)throw error('BINDING_AUDIT_REQUIRED','Actor and meaningful reason are required',400);
 const old=doc.bindings.find(b=>b.shipmentId===safe.shipmentId),same=old&&
  old.pickupTargetId===target&&old.pickupDate===safe.pickupDate&&old.reference===safe.reference;
 if(old&&(!same||old.active===false)&&confirmOverride!==true)
   throw error('BINDING_OVERRIDE_CONFIRMATION_REQUIRED','Existing binding requires confirmation');
 if(same&&old.active===true)return {...view(doc),changed:false};
 if(doc.bindings.some(b=>b.reference===safe.reference&&b.shipmentId!==safe.shipmentId&&b.active!==false))
   throw error('BINDING_REFERENCE_CONFLICT','Shipment reference already belongs to another main shipment');
 const at=new Date().toISOString(),next=JSON.parse(JSON.stringify(doc));
 const row={...safe,...s,active:true,createdAt:old&&old.createdAt||at,createdBy:old&&old.createdBy||who,
   updatedAt:at,updatedBy:who};
 if(old)next.bindings[next.bindings.findIndex(b=>b.shipmentId===safe.shipmentId)]=row;
 else next.bindings.push(row);
 next.audit.push({id:'AUD-'+crypto.randomBytes(12).toString('hex'),at,by:who,reason:why,
   action:old?'rebind-main':'bind-main',shipmentId:safe.shipmentId,reference:safe.reference,
   oldPickupTargetId:old&&old.pickupTargetId||'',pickupTargetId:target,revision:doc.revision+1});
 next.revision=doc.revision+1;next.updatedAt=at;
 const raw=JSON.stringify(next);
 try{
  await loaded.blob.upload(raw,Buffer.byteLength(raw),{
   blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8',blobCacheControl:'no-store'},
   conditions:loaded.etag?{ifMatch:loaded.etag}:{ifNoneMatch:'*'},
   transportAttempts:1
  });
 }catch(e){if([409,412].includes(Number(e&&(e.statusCode||e.status))))
   throw error('BINDING_CONCURRENT_UPDATE','Concurrent binding update');throw e}
 return {...view(next),changed:true};
}
module.exports={pathFor,read,applyBinding};
