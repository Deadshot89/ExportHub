'use strict';

// RC1577: read-only POD quality report for the admin "POD-Prüfung" in the app.
// It never writes: regeneration happens in the admin's browser (current loading-list layout) and the
// "Abgeholt" review flag is set there too, both only after the admin confirmed the report.

const store=require('./pickup-store');
const podArchive=require('./pod-archive');
const integrity=require('./pod-integrity-audit');

const VERSION='RC1577';
const MAX_LIMIT=25;
const MAX_REFERENCES=50;

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function refOf(sh){return text(sh&&(sh.ref||sh.reference||sh.referenceNumber||sh.shipmentRef||sh.id||sh.shipmentId)).toUpperCase()}
function tokenOf(sh){return text(sh&&(sh.pickupToken||sh.pickupQrToken||sh.qrToken||sh.pickupCode))}
function subCount(sh){return Array.isArray(sh&&sh.subShipments)?sh.subShipments.length:0}
function isManualUpload(file){return !!file&&(file.manualUpload===true||/manual-upload/.test(lower(file.source)))}
function podFiles(sh){
 return(Array.isArray(sh&&sh.podFiles)?sh.podFiles:[]).filter(file=>file&&lower(file.kind)!=='scan-confirmation'&&!file.placeholder&&!file.syntheticFallback&&!/deleted|gelöscht|replaced|ersetzt/.test(lower(file.status)))
}
function relevant(sh){return integrity.statusIsPod(sh)||(sh&&sh.podReviewRequired===true)}

function inlineBuffer(file){
 const raw=text(file&&(file.dataUrl||file.data)),m=raw.match(/^data:[^;,]*;base64,(.+)$/i);
 if(!m)return null;
 try{return Buffer.from(m[1],'base64')}catch(_){return null}
}

// facts: {files:[{readable,renderLayout,manualUpload}], signatureStored, hasToken}
function classify(sh,facts){
 facts=facts||{};
 if(sh&&sh.podReviewRequired===true)return{verdict:'flagged',reason:'REVIEW_FLAGGED'};
 if(subCount(sh)>=2)return{verdict:'manual',reason:'MULTI_TRUCK'};
 const files=Array.isArray(facts.files)?facts.files:[];
 const readable=files.length>0&&files.every(file=>file.readable===true);
 const generated=files.filter(file=>!file.manualUpload);
 const current=generated.every(file=>file.renderLayout===podArchive.POD_RENDER_LAYOUT);
 if(readable&&current)return{verdict:'ok',reason:generated.length?'CURRENT_LAYOUT':'MANUAL_UPLOAD'};
 const reason=!files.length?'NO_POD_FILE':(!readable?'POD_NOT_READABLE':'OLD_LAYOUT');
 if(facts.signatureStored===true&&facts.hasToken===true)return{verdict:'regenerate',reason};
 return{verdict:'review',reason,missing:facts.signatureStored===true?'PICKUP_TOKEN_MISSING':'SIGNATURE_NOT_STORED'};
}

async function fileFacts(clients,file){
 const out={name:text(file.name||file.fileName||file.filename),uploadedAt:text(file.uploadedAt),renderLayout:podArchive.renderLayoutOf(file.renderLayout),manualUpload:isManualUpload(file),readable:false};
 const inline=inlineBuffer(file);
 if(inline){out.readable=integrity.looksLikePodBuffer(inline,file);return out}
 const read=await integrity.readStoredPod(clients,file);
 out.readable=read.ok===true;
 if(!read.ok)out.error=text(read.code).slice(0,60);
 return out
}
async function signatureStored(sh,environment){
 for(const key of integrity.accessKeysOf(sh,environment)){
  try{
   const record=(await store.getRecord(key,environment)).record||{};
   if(text(record.signatureBlobName)&&text(record.confirmedAt))return true
  }catch(_){}
 }
 return false
}
async function inspect(sh,state,clients,environment){
 const files=[];
 for(const file of podFiles(sh))files.push(await fileFacts(clients,file));
 const facts={files,hasToken:!!tokenOf(sh),signatureStored:await signatureStored(sh,environment)};
 const verdict=classify(sh,facts);
 return Object.assign({
  reference:refOf(sh),
  shipmentId:text(sh&&(sh.id||sh.shipmentId)),
  customer:integrity.customerNameValue(sh,state),
  status:text(sh&&(sh.status||sh.processStatus)),
  confirmedAt:text(sh&&(sh.pickupConfirmedAt||sh.pickedUpAt)),
  reviewReason:text(sh&&sh.podReviewReason),
  files
 },verdict)
}

async function report(environment,options){
 options=options||{};
 environment=store.normalizeEnvironment(environment);
 const clients=await store.clients(environment);
 const read=await store.readJson(clients.team.getBlockBlobClient(store.teamBlobName(environment)),{state:{}});
 const state=(read.value&&read.value.state)||{},shipments=Array.isArray(state.shipments)?state.shipments:[];
 const references=(Array.isArray(options.references)?options.references:[]).map(v=>text(v).toUpperCase()).filter(Boolean).slice(0,MAX_REFERENCES);
 const start=Math.max(0,Math.round(Number(options.cursor)||0)),limit=Math.min(MAX_LIMIT,Math.max(1,Math.round(Number(options.limit)||10)));
 const selected=[];let scan=start;
 if(references.length){
  const wanted=new Set(references);
  shipments.forEach(sh=>{if(wanted.has(refOf(sh))&&relevant(sh))selected.push(sh)});
  scan=shipments.length
 }else{
  while(scan<shipments.length&&selected.length<limit){if(relevant(shipments[scan]))selected.push(shipments[scan]);scan++}
 }
 const rows=[];
 for(const sh of selected)rows.push(await inspect(sh,state,clients,environment));
 return{ok:true,version:VERSION,environment,layout:podArchive.POD_RENDER_LAYOUT,cursor:start,nextCursor:scan<shipments.length?scan:null,totalShipments:shipments.length,rows}
}

module.exports={VERSION,POD_RENDER_LAYOUT:podArchive.POD_RENDER_LAYOUT,classify,podFiles,relevant,report};
