'use strict';
const crypto=require('crypto');
const {BlobServiceClient}=require('@azure/storage-blob');
const access=require('../shared/public-access-store');
const auth=require('../shared/fast-auth-store');
const {DOCUMENT_CONTAINER}=require('../shared/document-blob-store');
const pdfSecurity=require('../shared/customer-avis-pdf-security');
const contentCheck=require('../shared/customer-avis-document-content');
const avisSlots=require('../shared/customer-avis-slots');
const graphMail=require('../shared/graph-mail');

const TEAM_CONTAINER=process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data';
const TEAM_BLOB_BASE=process.env.EXPORTHUB_STORAGE_BLOB||process.env.EXPORTHUB_STATE_BLOB||'team-state.json';
const TEST_TEAM_BLOB=process.env.EXPORTHUB_TEST_STORAGE_BLOB||('testservice/'+String(TEAM_BLOB_BASE).replace(/^\/+/,''));
const MAX_RETRIES=8;
const AVIS_QUARANTINE_CONTAINER=process.env.EXPORTHUB_AVIS_QUARANTINE_CONTAINER||'exporthub-avis-quarantine';
const MAX_CUSTOMER_PDF_FILES=10;
const MAX_PENDING_PDF_FILES=3;
const MAX_UPLOADS_PER_HOUR=8;
const AVIS_UPLOAD_NOTIFICATION_TO=process.env.EXPORTHUB_AVIS_UPLOAD_NOTIFICATION_TO||'DespatchNettetal@essentra.onmicrosoft.com';
let teamContainer=null;
let teamContainerReadyPromise=null;
let documentContainer=null;
let quarantineContainer=null;
let quarantineContainerReadyPromise=null;
function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function upper(v){return text(v).toUpperCase()}
function arr(v){return Array.isArray(v)?v:[]}
function obj(v){return!!v&&typeof v==='object'&&!Array.isArray(v)}
function num(v){const n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n:0}
function now(){return new Date().toISOString()}
function elapsed(start){return Math.max(0,Date.now()-start)}
function timingHeaders(timing){return{'Server-Timing':['auth;dur='+timing.authMs,'team-blob;dur='+timing.teamBlobMs,'team-read;dur='+timing.teamReadMs,'flag-write;dur='+timing.flagWriteMs,'token-issue;dur='+timing.tokenIssueMs,'total;dur='+timing.totalMs].join(', ')}}
function error(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e}
function json(status,body,headers={}){return access.json(status,body,headers)}
function body(req){return access.body(req)}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
function isConflict(e){return!!(e&&(Number(e.statusCode||e.status)===412||['ConditionNotMet','TargetConditionNotMet'].includes(String(e.code||''))))}
function teamBlobName(environment){return environment==='testservice'?TEST_TEAM_BLOB:TEAM_BLOB_BASE}
async function ensureTeamContainerReady(){if(teamContainerReadyPromise)return teamContainerReadyPromise;const cs=connectionString();if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);teamContainer=BlobServiceClient.fromConnectionString(cs).getContainerClient(TEAM_CONTAINER);teamContainerReadyPromise=Promise.resolve(teamContainer);return teamContainerReadyPromise}
async function teamBlob(environment){const c=await ensureTeamContainerReady();return c.getBlockBlobClient(teamBlobName(environment))}
async function ensureDocumentContainerReady(){if(documentContainer)return documentContainer;const cs=connectionString();if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);documentContainer=BlobServiceClient.fromConnectionString(cs).getContainerClient(DOCUMENT_CONTAINER);return documentContainer}
async function ensureQuarantineContainerReady(){if(quarantineContainerReadyPromise)return quarantineContainerReadyPromise;const cs=connectionString();if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);quarantineContainer=BlobServiceClient.fromConnectionString(cs).getContainerClient(AVIS_QUARANTINE_CONTAINER);quarantineContainerReadyPromise=Promise.resolve().then(async()=>{if(typeof quarantineContainer.createIfNotExists==='function')await quarantineContainer.createIfNotExists();return quarantineContainer}).catch(e=>{quarantineContainerReadyPromise=null;throw e});return quarantineContainerReadyPromise}
async function readTeam(blob){try{const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));const raw=Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,'').trim();return{value:raw?JSON.parse(raw):{schemaVersion:3,revision:0,state:{}},etag:r.etag||null}}catch(e){if(e&&e.statusCode===404)return{value:{schemaVersion:3,revision:0,state:{}},etag:null};throw e}}
async function writeTeam(blob,value,etag){const raw=JSON.stringify(value);return blob.upload(raw,Buffer.byteLength(raw),{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8',blobCacheControl:'no-store'},conditions:etag?{ifMatch:etag}:{ifNoneMatch:'*'}})}
function sid(sh){return text(sh&&(sh.id||sh.shipmentId||sh.uuid||sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber))}
function sref(sh){return upper(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.referenceNo||sh.id||sh.shipmentId))}
function shipmentIdentityValues(sh){if(!obj(sh))return[];return['id','shipmentId','uuid','ref','reference','shipmentRef','referenceNumber','referenceNo'].map(k=>text(sh[k])).filter(Boolean)}
function sameShipment(sh,subjectId,reference){const i=text(subjectId),r=upper(reference),ids=shipmentIdentityValues(sh),refs=ids.map(upper);return!!((i&&ids.includes(i))||(r&&refs.includes(r)))}
function shipmentCopies(state){const out=[];function add(v){if(obj(v)&&out.indexOf(v)<0)out.push(v)}['shipments','savedShipments','salesSharedShipments','sharedShipments','shipmentArchive','archivedShipments','archive'].forEach(k=>arr(state&&state[k]).forEach(add));['shipment','currentShipment','selectedShipment'].forEach(k=>add(state&&state[k]));return out}
function findCopies(state,subjectId,reference){return shipmentCopies(state).filter(sh=>sameShipment(sh,subjectId,reference))}
function stamp(sh){const n=Date.parse(text(sh&&(sh._syncUpdatedAt||sh.updatedAt||sh.modifiedAt||sh.createdAt)));return Number.isFinite(n)?n:0}
function findShipment(state,subjectId,reference){return findCopies(state,subjectId,reference).sort((a,b)=>stamp(b)-stamp(a))[0]||null}
function safeDraftText(v,max=300){if(v==null||typeof v==='object'||typeof v==='boolean')return'';return text(v).replace(/[\r\n\t]+/g,' ').slice(0,max)}
function sanitizeDraftRows(raw){
 const source=[raw&&raw.rows,raw&&raw.colli,raw&&raw.collis,raw&&raw.packages,raw&&raw.packagingRows].find(Array.isArray)||[];
 return source.slice(0,100).map((r,i)=>{
  r=obj(r)?r:{};
  const type=safeDraftText(r.type||r.packaging||r.verpackung||r.name,120);
  const count=Math.max(0,Math.min(9999,Math.round(num(r.count||r.qty||r.quantity||r.anzahl))));
  const weight=Math.max(0,Math.min(100000,num(r.weight||r.gewicht)));
  const ldm=Math.max(0,Math.min(1000,num(r.ldm||r.loadingMeter)));
  const length=Math.max(0,Math.min(5000,num(r.l||r.length)));
  const width=Math.max(0,Math.min(5000,num(r.w||r.width)));
  const height=Math.max(0,Math.min(5000,num(r.h||r.height)));
  return{position:i+1,type,count,weight,ldm,length,width,height}
 }).filter(r=>r.type||r.count||r.weight||r.ldm||r.length||r.width||r.height)
}

function sanitizeDraftSnapshot(raw,subjectId,reference){
 raw=obj(raw)?raw:{};
 const ref=upper(reference||raw.reference||raw.ref).replace(/[^A-Z0-9]/g,'').slice(0,6);
 if(!/^[A-Z0-9]{6}$/.test(ref))throw error('REFERENCE_INVALID','Für den Lieferavis wird eine gültige sechsstellige Referenz benötigt.',400);
 const id=safeDraftText(subjectId||raw.id||raw.shipmentId||ref,120)||ref,stamp=now(),out={id,shipmentId:id,ref,reference:ref,status:'Entwurf',createdAt:stamp,updatedAt:stamp,_syncUpdatedAt:stamp};
 const limits={recipientAddress:1000,deliveryAddress:1000,destinationAddress:1000,senderAddress:1000,goodsDescription:1000,description:1000,warenbeschreibung:1000,remark:1500,remarks:1500,bemerkung:1500,comments:1500,comment:1500,note:1500,notes:1500,shipmentRemark:1500};
 const fields=['customerName','customerNumber','customerAccount','customerNo','customerReference','customerRef','orderReference','purchaseOrder','poNumber','salesOrder','salesOrderNumber','orderNumber','recipientName','destinationName','recipientAddress','deliveryAddress','destinationAddress','recipientCountry','country','selectedLocationId','locationId','siteId','destinationId','deliveryLocationId','shipToLocationId','recipientLocationId','senderName','senderAddress','shipDate','shippingDate','shipmentDate','dispatchDate','incoterm','incoterms','carrier','carrierName','spedition','goodsDescription','description','warenbeschreibung','remark','remarks','bemerkung','comments','comment','note','notes','shipmentRemark','status','shipmentStatus'];
 for(const key of fields){const value=safeDraftText(raw[key],limits[key]||300);if(value)out[key]=value}
 const rows=sanitizeDraftRows(raw);if(rows.length)out.rows=rows;
 out.status=safeDraftText(raw.status||raw.shipmentStatus,80)||'Entwurf';
 return out
}
function ensureDraftShipment(state,subjectId,reference,snapshot){
 let existing=findShipment(state,subjectId,reference);if(existing)return existing;
 const draft=sanitizeDraftSnapshot(snapshot,subjectId,reference),name=safeDraftText(draft.customerName,300),location=safeDraftText(draft.selectedLocationId||draft.locationId||draft.siteId||draft.destinationId||draft.deliveryLocationId||draft.shipToLocationId||draft.recipientLocationId,300);
 if(!name)throw error('CUSTOMER_REQUIRED','Bitte zuerst einen Kunden auswählen.',400);
 if(!location)throw error('LOCATION_REQUIRED','Bitte zuerst einen Standort auswählen.',400);
 if(!Array.isArray(state.shipments))state.shipments=[];
 state.shipments.push(draft);
 return draft
}
function avisEnabled(sh){return!!(sh&&(sh.customerAvisEnabled===true||sh.avisEnabled===true))}
function avisManuallyDisabled(sh){return!!text(sh&&(sh.customerAvisDisabledAt||sh.avisDisabledAt))}
function rowsOf(sh){const lists=[sh&&sh.rows,sh&&sh.colli,sh&&sh.collis,sh&&sh.packages,sh&&sh.packagingRows].filter(Array.isArray).sort((a,b)=>b.length-a.length);return lists[0]||[]}
function dateTimeOf(sh){return text(sh&&(sh.pickupConfirmedAt||sh.qrPickupConfirmedAt||sh.pickupCompletedAt||sh.pickedUpAt||sh.actualPickupAt||sh.actualPickupDate||sh.podServerVerifiedAt))}
function pickupCarrierOf(sh){return text(sh&&(sh.pickupCarrierName||sh.pickupSpeditionName||sh.carrierName||sh.speditionName||sh.carrier||sh.spedition))}
function pickupPlateOf(sh){return text(sh&&(sh.pickupLicensePlate||sh.licensePlate||sh.vehicleLicensePlate||sh.kennzeichen))}
function pickupDriverOf(sh){return text(sh&&(sh.pickupDriverName||sh.driverName||sh.confirmedBy))}
function publicStatus(sh){const raw=text(sh&&(sh.status||sh.processStatus||sh.pickupStatus));if(/abgeholt|picked/i.test(raw)||dateTimeOf(sh))return'Abgeholt';return raw||'Erstellt'}
function fileName(f,fallback){return text(f&&(f.name||f.filename||f.fileName||f.title||f.label))||fallback||'Dokument'}
function fileMime(f){return text(f&&(f.mimeType||f.contentType||f.type))||'application/octet-stream'}
function fileSource(f){return text(f&&(f.data||f.dataUrl||f.content||f.url||f.downloadUrl||f.href||f.contentUrl))}
function blobNameOf(f){const name=text(f&&f.storage==='blob'&&f.blobName);return /^rc1059\/(production|testservice)\/[a-f0-9]{2}\/[a-f0-9]{64}$/.test(name)?name:''}
function safeExternalUrl(raw){try{const u=new URL(raw);if(u.protocol!=='https:')return'';const h=u.hostname.toLowerCase();if(/(^|\.)sharepoint\.com$/.test(h)||/(^|\.)blob\.core\.windows\.net$/.test(h)||h==='1drv.ms')return u.href;return''}catch(_){return''}}
function parseDataUrl(raw,mimeHint){if(!/^data:/i.test(raw))return null;const p=raw.indexOf(',');if(p<0)return null;const meta=raw.slice(5,p),payload=raw.slice(p+1),parts=meta.split(';'),mime=text(parts[0])||mimeHint||'application/octet-stream',is64=parts.some(x=>lower(x)==='base64');try{return{mime,bytes:is64?Buffer.from(payload,'base64'):Buffer.from(decodeURIComponent(payload),'utf8')}}catch(_){return null}}
function categoryFor(field,f,fallback){const raw=upper([text(f&&f.category),text(f&&f.documentType),fileName(f,'')].filter(Boolean).join(' '));if(/POD|ABLIEFERNACHWEIS/.test(raw)||field==='podFiles')return'POD';if(/\bABD\b|AUSFUHRBEGLEIT/.test(raw)||field==='abdFiles')return'ABD';if(/CMR/.test(raw))return'CMR';if(/LIEFERSCHEIN|\bLS\b/.test(raw)||['deliveryFiles','deliveryNotesFiles','lieferscheine'].includes(field))return'Lieferschein';if(/LADELISTE|\bL1\b/.test(raw))return'Ladeliste';if(/\bL2\b/.test(raw))return'L2';if(/DECKBLATT/.test(raw))return'Deckblatt';return fallback||'Dokument'}
function generatedDocumentPublic(f){if(!obj(f)||f.customerAvisVisible===false)return false;if(f.customerAvisVisible===true)return true;const n=upper([fileName(f,''),text(f.category),text(f.documentType)].filter(Boolean).join(' '));return /CMR|DECKBLATT|LADELISTE|\bL1\b|\bL2\b|LIEFERSCHEIN|\bABD\b|AUSFUHRBEGLEIT/.test(n)}
function addDocument(out,seen,field,category,f,i,explicitOnly){if(!obj(f)||f.placeholder||f.fallback||f.customerAvisVisible===false)return;if(explicitOnly&&f.customerAvisVisible!==true)return;if(field==='generatedDocuments'&&!generatedDocumentPublic(f))return;const source=fileSource(f),inline=parseDataUrl(source,fileMime(f)),external=inline?'':safeExternalUrl(source),blobName=blobNameOf(f);if(!inline&&!external&&!blobName)return;const name=fileName(f,category+' '+(i+1)),id=text(f.id||f.remoteId||f.fileId||f.documentId)||Buffer.from(field+'|'+name+'|'+i).toString('base64url').slice(0,80),finalCategory=categoryFor(field,f,category),uniq=finalCategory+'|'+id;if(seen.has(uniq))return;seen.add(uniq);out.push({id,name,mime:fileMime(f),size:Number(f.size||inline&&inline.bytes.length||0)||0,category:finalCategory,inline,external,blobName})}
function documentRecords(sh){
 const out=[],seen=new Set(),publicLists=[['deliveryFiles','Lieferschein'],['deliveryNotesFiles','Lieferschein'],['lieferscheine','Lieferschein'],['abdFiles','ABD'],['podFiles','POD'],['generatedDocuments','Dokument']],explicitLists=[['documents','Dokument'],['files','Dokument'],['attachments','Anhang'],['invoiceFiles','Rechnung'],['mailAttachments','Anhang']];
 publicLists.forEach(([field,category])=>arr(sh&&sh[field]).forEach((f,i)=>addDocument(out,seen,field,category,f,i,false)));
 explicitLists.forEach(([field,category])=>arr(sh&&sh[field]).forEach((f,i)=>addDocument(out,seen,field,category,f,i,true)));
 return out
}
function podAvailable(sh){return!!(sh&&(sh.podAvailable===true||sh.podConfirmed===true||sh.signatureAvailable===true||documentRecords(sh).some(d=>d.category==='POD')))}
function contentDisposition(name){return'attachment; filename*=UTF-8\'\''+encodeURIComponent(fileName({name},'Dokument'))}
function berlinDateKey(value){const d=value instanceof Date?value:new Date(value);if(!Number.isFinite(d.getTime()))return'';try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),o={};parts.forEach(p=>o[p.type]=p.value);return o.year+'-'+o.month+'-'+o.day}catch(_){return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')}}
function addCalendarDays(key,count){const m=text(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return'';const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),12));d.setUTCDate(d.getUTCDate()+Math.max(0,Number(count)||0));return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')}
function avisExpiresOn(sh){const picked=berlinDateKey(dateTimeOf(sh));return picked?addCalendarDays(picked,14):''}
function avisExpired(sh){const until=avisExpiresOn(sh),today=berlinDateKey(new Date());return!!(until&&today&&today>until)}
function assertAvisWindow(sh){if(avisExpired(sh))throw error('AVIS_EXPIRED','Der Lieferavis ist 14 Tage nach der Abholung abgelaufen.',410);return avisExpiresOn(sh)}
async function readDocumentBlob(blobName,environment){if(!blobNameOf({storage:'blob',blobName})||!blobName.startsWith('rc1059/'+environment+'/'))throw error('DOCUMENT_BLOB_INVALID','Die Dokumentreferenz ist ungültig.',400);const container=await ensureDocumentContainerReady(),blob=container.getBlockBlobClient(blobName);try{const r=await blob.download(0),chunks=[];for await(const part of r.readableStreamBody)chunks.push(Buffer.from(part));return{bytes:Buffer.concat(chunks),mime:text(r.contentType)||'application/octet-stream'}}catch(e){if(Number(e&&e.statusCode||e&&e.status)===404)throw error('DOCUMENT_NOT_FOUND','Das Dokument ist nicht mehr verfügbar.',404);throw e}}
function customerUploadScope(sessionInfo){const r=sessionInfo&&sessionInfo.record||{};return text(r.subjectId)+'|'+upper(r.reference)}
function customerUploadQueue(sh){return arr(sh&&sh.customerAvisDocumentUploads)}
function customerUploadAttachments(sh){return arr(sh&&sh.attachments).filter(f=>obj(f)&&f.source==='customer-avis-upload'&&/^[a-f0-9]{64}$/.test(text(f.sha256)))}
function customerUploadFile(sh,id){return customerUploadAttachments(sh).find(f=>text(f.sha256)===text(id))||null}
function customerUploadQueueEntry(sh,id){return customerUploadQueue(sh).find(x=>obj(x)&&text(x.id)===text(id))||null}
function publicCustomerUploads(sh){return customerUploadQueue(sh).slice(-20).map(x=>({id:text(x.id),name:text(x.name),size:Number(x.size||0)||0,status:text(x.status)||'scanning',documentType:text(x.documentType),uploadedAt:text(x.uploadedAt),completedAt:text(x.completedAt),message:text(x.message),scanResult:text(x.scanResult),scanTime:text(x.scanTime),contentCode:text(x.contentCode),contentMatched:arr(x.contentMatched)}))}
function assertCustomerUploadQuota(sh){
 const queue=customerUploadQueue(sh),saved=customerUploadAttachments(sh).length,pending=queue.filter(x=>text(x&&x.status)==='scanning').length,cutoff=Date.now()-60*60*1000,recent=queue.filter(x=>{const t=Date.parse(text(x&&x.uploadedAt));return Number.isFinite(t)&&t>=cutoff}).length;
 if(saved>=MAX_CUSTOMER_PDF_FILES)throw error('CUSTOMER_PDF_LIMIT','Für diese Sendung wurden bereits '+MAX_CUSTOMER_PDF_FILES+' Kundendokumente gespeichert.',409);
 if(pending>=MAX_PENDING_PDF_FILES)throw error('CUSTOMER_PDF_PENDING_LIMIT','Es werden bereits '+MAX_PENDING_PDF_FILES+' PDF-Dateien geprüft. Bitte warten Sie den Abschluss der Prüfung ab.',429);
 if(recent>=MAX_UPLOADS_PER_HOUR)throw error('CUSTOMER_PDF_RATE_LIMIT','Zu viele PDF-Uploads in kurzer Zeit. Bitte versuchen Sie es später erneut.',429)
}
function safeUploadEntry(entry){return{id:text(entry.id),name:pdfSecurity.safeFileName(entry.name),size:Number(entry.size||0)||0,status:text(entry.status)||'scanning',documentType:text(entry.documentType),uploadedAt:text(entry.uploadedAt)||now(),completedAt:text(entry.completedAt),message:text(entry.message).slice(0,320),scanResult:text(entry.scanResult).slice(0,120),scanTime:text(entry.scanTime).slice(0,80),contentCode:text(entry.contentCode).slice(0,80),contentMatched:arr(entry.contentMatched).map(x=>text(x).slice(0,80)).slice(0,8),provider:'Microsoft Defender for Storage'}}
function updateQueueOnShipment(sh,entry){const queue=customerUploadQueue(sh).filter(x=>obj(x)&&text(x.id)!==text(entry.id));queue.push(safeUploadEntry(entry));sh.customerAvisDocumentUploads=queue.slice(-20)}
function addCustomerUploadNotification(state,sh,file,entry){
 if(!obj(state)||!obj(sh)||!obj(file)||!text(file.sha256))return null;
 const id='avis-upload-'+text(file.sha256),list=arr(state.notifications).slice(),existing=list.find(x=>obj(x)&&text(x.id)===id);
 if(existing)return existing;
 const reference=sref(sh),customer=text(sh.customerName||(sh.customer&&sh.customer.name))||'Kunde',documentName=fileName(file,'Kunden-Dokument.pdf'),createdAt=text(entry&&entry.completedAt)||text(file.uploadedAt)||now();
 const notice={id,type:'customer-avis-document',source:'customer-avis-upload',title:'Neues AVIS-Dokument',message:customer+' hat '+documentName+' für Sendung '+reference+' hochgeladen.',createdAt,read:false,route:'notifications',shipmentId:sid(sh),shipmentRef:reference,customerName:customer,documentId:text(file.id),documentName,documentSha256:text(file.sha256),documentBlobName:text(file.blobName),documentMimeType:text(file.mimeType||file.type)||'application/pdf'};
 list.push(notice);state.notifications=list.slice(-200);return notice
}
function avisUploadMailSubject(sh,file){
 const reference=sref(sh)||'ohne Referenz',customer=text(sh&&sh.customerName||(sh&&sh.customer&&sh.customer.name))||'Kunde';
 return 'Neues AVIS-Dokument · '+reference+' · '+customer
}
function avisUploadMailBody(sh,file,entry){
 const reference=sref(sh)||'–',customer=text(sh&&sh.customerName||(sh&&sh.customer&&sh.customer.name))||'Kunde',name=fileName(file,'Kunden-Dokument.pdf'),documentType=text(file&&file.category||entry&&entry.documentType)||'Dokument',completed=text(entry&&entry.completedAt)||text(file&&file.uploadedAt)||now();
 return [
  'Ein Kunde hat über den ExportHUB-AVIS-Link ein neues Dokument hochgeladen.',
  '',
  'Sendungsreferenz: '+reference,
  'Kunde: '+customer,
  'Dokument: '+name,
  'Dokumentart: '+documentType,
  'Geprüft und gespeichert: '+completed,
  '',
  'Die Datei hat die Virenprüfung und die fachliche Sendungszuordnung bestanden.',
  'Bitte ExportHUB → Benachrichtigungen öffnen und „PDF öffnen / drucken“ auswählen.'
 ].join('\n')
}
async function notifyDespatchCustomerUpload(environment,sh,file,entry){
 if(environment!=='production')return{ok:true,skipped:true,reason:'non-production'};
 const recipient=text(AVIS_UPLOAD_NOTIFICATION_TO);
 if(!recipient)return{ok:true,skipped:true,reason:'recipient-disabled'};
 try{
  const sent=await graphMail.sendTextMail({to:recipient,subject:avisUploadMailSubject(sh,file),body:avisUploadMailBody(sh,file,entry)});
  return{ok:true,to:recipient,attempts:Number(sent&&sent.attempts||1)}
 }catch(e){
  return{ok:false,to:recipient,code:text(e&&e.code)||'AVIS_UPLOAD_MAIL_FAILED'}
 }
}
async function readBlobBytes(blob){const r=await blob.download(0),chunks=[];for await(const part of r.readableStreamBody)chunks.push(Buffer.from(part));return Buffer.concat(chunks)}
function blobExistsConflict(e){const status=Number(e&&e.statusCode||e&&e.status||0);return status===409||status===412||/BlobAlreadyExists|ConditionNotMet/i.test(String(e&&e.code||''))}
async function uploadQuarantinePdf(sessionInfo,session,validated){
 const container=await ensureQuarantineContainerReady(),name=pdfSecurity.quarantineBlobName(sessionInfo.environment,customerUploadScope(sessionInfo),validated.sha256),blob=container.getBlockBlobClient(name),uploadedAt=now();
 try{
  const options={blobHTTPHeaders:{blobContentType:'application/pdf',blobCacheControl:'private, no-store'},metadata:{kind:'customer-avis-pdf-quarantine',environment:sessionInfo.environment,sha256:validated.sha256,name64:pdfSecurity.encodeNameMetadata(validated.name),uploadedat:uploadedAt},conditions:{ifNoneMatch:'*'}};
  if(typeof blob.uploadData==='function')await blob.uploadData(validated.buffer,options);else await blob.upload(validated.buffer,validated.buffer.length,options)
 }catch(e){if(!blobExistsConflict(e))throw e}
 return{blob,name,uploadedAt}
}
async function savePendingCustomerUpload(teamBlob,sessionInfo,session,entry,firstRead){
 for(let i=0;i<MAX_RETRIES;i++){
  const d=i===0&&firstRead?firstRead:await readTeam(teamBlob),team=d.value||{},state=obj(team.state)?team.state:{},target=findShipment(state,sessionInfo.record.subjectId,sessionInfo.record.reference);
  if(!target)throw error('SHIPMENT_NOT_FOUND','Sendung wurde nicht gefunden.',404);
  if(dateTimeOf(target))throw error('AVIS_CLOSED','Der Lieferavis ist nach der Abholung geschlossen. Dokumente können nicht mehr hochgeladen werden.',410);
  const existing=customerUploadQueueEntry(target,entry.id);if(!existing)assertCustomerUploadQuota(target);
  findCopies(state,sessionInfo.record.subjectId,sessionInfo.record.reference).forEach(sh=>{updateQueueOnShipment(sh,entry);sh.updatedAt=now();sh._syncUpdatedAt=sh.updatedAt});
  team.state=state;team.revision=Number(team.revision||0)+1;team.updatedAt=now();team.updatedBy='Kunden-Avis PDF-Upload';team.updatedByUserId='customer-avis';team.clientVersion='RC1129';
  try{await writeTeam(teamBlob,team,d.etag);return publicShipment(findShipment(state,sessionInfo.record.subjectId,sessionInfo.record.reference),session,state)}catch(e){if(isConflict(e)&&i<MAX_RETRIES-1){await wait(80+i*100);continue}throw e}
 }
 throw error('STATE_CONFLICT','PDF-Prüfung konnte nicht vorgemerkt werden.',409)
}
async function updateCustomerUploadOutcome(teamBlob,sessionInfo,session,entry,file){
 for(let i=0;i<MAX_RETRIES;i++){
  const d=await readTeam(teamBlob),team=d.value||{},state=obj(team.state)?team.state:{},copies=findCopies(state,sessionInfo.record.subjectId,sessionInfo.record.reference);
  if(!copies.length)throw error('SHIPMENT_NOT_FOUND','Sendung wurde nicht gefunden.',404);
  copies.forEach(sh=>{
   updateQueueOnShipment(sh,entry);
   if(file){
    const files=arr(sh.attachments).slice(),exists=files.some(f=>obj(f)&&f.source==='customer-avis-upload'&&text(f.sha256)===text(file.sha256));
    if(!exists)files.push(Object.assign({},file));
    sh.attachments=files
   }
   sh.updatedAt=now();sh._syncUpdatedAt=sh.updatedAt
  });
  if(file)addCustomerUploadNotification(state,copies[0],file,entry);
  team.state=state;team.revision=Number(team.revision||0)+1;team.updatedAt=now();team.updatedBy=file?'Kunden-Avis Dokument gespeichert':'Kunden-Avis Dokument blockiert';team.updatedByUserId='customer-avis';team.clientVersion='RC1133';
  try{await writeTeam(teamBlob,team,d.etag);return publicShipment(findShipment(state,sessionInfo.record.subjectId,sessionInfo.record.reference),session,state)}catch(e){if(isConflict(e)&&i<MAX_RETRIES-1){await wait(80+i*100);continue}throw e}
 }
 throw error('STATE_CONFLICT','PDF-Prüfergebnis konnte nicht gespeichert werden.',409)
}
async function promoteCleanCustomerPdf(teamBlob,sessionInfo,session,quarantineBlob,uploadId,scan,shipmentForCheck,queueEntry){
 const props=typeof quarantineBlob.getProperties==='function'?await quarantineBlob.getProperties():{},metadata=props&&props.metadata||{},name=pdfSecurity.decodeNameMetadata(metadata.name64),bytes=await readBlobBytes(quarantineBlob),validated=pdfSecurity.validatePdfUpload({name,type:'application/pdf',base64:bytes.toString('base64')});
 if(validated.sha256!==uploadId)throw error('PDF_HASH_MISMATCH','Die PDF-Datei hat die Integritätsprüfung nicht bestanden.',409);
 const docType=contentCheck.documentType(queueEntry&&queueEntry.documentType||'other'),content=await contentCheck.validateShipmentDocument(bytes,shipmentForCheck,docType);
 if(!content.ok){
  try{if(typeof quarantineBlob.deleteIfExists==='function')await quarantineBlob.deleteIfExists()}catch(_){}
  const blocked=await updateCustomerUploadOutcome(teamBlob,sessionInfo,session,{id:uploadId,name,size:bytes.length,status:'blocked',documentType:docType,uploadedAt:text(queueEntry&&queueEntry.uploadedAt)||text(metadata.uploadedat),completedAt:now(),message:content.message,scanResult:text(scan.result),scanTime:text(scan.scanTime),contentCode:content.code,contentMatched:content.matched},null);
  return{ok:false,status:'blocked',code:content.code,message:content.message,upload:{id:uploadId,name,size:bytes.length,status:'blocked',documentType:docType,contentCode:content.code,contentMatched:content.matched},shipment:blocked}
 }
 const container=await ensureDocumentContainerReady(),blobName=pdfSecurity.finalBlobName(sessionInfo.environment,uploadId),targetBlob=container.getBlockBlobClient(blobName),uploadedAt=now();
 try{
  const options={blobHTTPHeaders:{blobContentType:'application/pdf',blobCacheControl:'private, no-store'},metadata:{sha256:uploadId,environment:sessionInfo.environment,kind:'customer-avis-upload',scanprovider:'defender-for-storage',scanresult:'clean'},conditions:{ifNoneMatch:'*'}};
  if(typeof targetBlob.uploadData==='function')await targetBlob.uploadData(bytes,options);else await targetBlob.upload(bytes,bytes.length,options)
 }catch(e){if(!blobExistsConflict(e))throw e}
 const file={id:'customer-avis-'+uploadId.slice(0,20),name,category:content.documentTypeLabel||'Anhang',documentType:docType,mimeType:'application/pdf',type:'application/pdf',size:bytes.length,storage:'blob',blobName,sha256:uploadId,customerAvisVisible:true,source:'customer-avis-upload',uploadedAt,uploadedBy:'Kunde via Lieferavis',malwareScan:{provider:'Microsoft Defender for Storage',result:'No threats found',scanTime:text(scan.scanTime)},businessValidation:{result:'matched',code:content.code,matched:content.matched}};
 const completedEntry={id:uploadId,name,size:bytes.length,status:'saved',documentType:docType,uploadedAt:text(queueEntry&&queueEntry.uploadedAt)||text(metadata.uploadedat),completedAt:uploadedAt,message:'Virenprüfung und fachliche Sendungszuordnung erfolgreich. PDF gespeichert.',scanResult:text(scan.result),scanTime:text(scan.scanTime),contentCode:content.code,contentMatched:content.matched};
 const shipment=await updateCustomerUploadOutcome(teamBlob,sessionInfo,session,completedEntry,file);
 const mailNotification=await notifyDespatchCustomerUpload(sessionInfo.environment,shipmentForCheck,file,completedEntry);
 try{if(typeof quarantineBlob.deleteIfExists==='function')await quarantineBlob.deleteIfExists()}catch(_){}
 return{ok:true,status:'saved',upload:{id:uploadId,name,size:bytes.length,status:'saved',documentType:docType,scanResult:text(scan.result),scanTime:text(scan.scanTime),contentCode:content.code,contentMatched:content.matched},shipment,mailNotification}
}
async function blockCustomerPdf(teamBlob,sessionInfo,session,quarantineBlob,uploadId,scan,queueEntry){
 const code=scan.status==='malicious'?'PDF_MALWARE_DETECTED':scan.status==='not-scanned'?'PDF_NOT_SCANNED':'PDF_SCAN_FAILED';
 const message=scan.status==='malicious'?'Die PDF-Datei wurde als schädlich erkannt und nicht gespeichert.':scan.status==='not-scanned'?'Die PDF-Datei konnte nicht sicher auf Schadsoftware geprüft werden und wurde nicht gespeichert.':'Die Virenprüfung konnte nicht erfolgreich abgeschlossen werden. Die Datei wurde nicht gespeichert.';
 try{if(typeof quarantineBlob.deleteIfExists==='function')await quarantineBlob.deleteIfExists()}catch(_){}
 const shipment=await updateCustomerUploadOutcome(teamBlob,sessionInfo,session,{id:uploadId,name:text(queueEntry&&queueEntry.name)||'Kunden-Dokument.pdf',size:Number(queueEntry&&queueEntry.size||0)||0,status:'blocked',uploadedAt:text(queueEntry&&queueEntry.uploadedAt),completedAt:now(),message,scanResult:text(scan.result),scanTime:text(scan.scanTime)},null);
 return{ok:false,status:'blocked',code,message,upload:{id:uploadId,status:'blocked',scanResult:text(scan.result),scanTime:text(scan.scanTime)},shipment}
}
async function customerPdfScanStatus(teamBlob,sessionInfo,session,sh,uploadId,state){
 if(!/^[a-f0-9]{64}$/.test(uploadId))throw error('UPLOAD_ID_INVALID','Upload-ID ist ungültig.',400);
 const saved=customerUploadFile(sh,uploadId);if(saved)return{ok:true,status:'saved',upload:{id:uploadId,name:fileName(saved,'Kunden-Dokument.pdf'),size:Number(saved.size||0)||0,status:'saved'},shipment:publicShipment(sh,session,state)};
 const queueEntry=customerUploadQueueEntry(sh,uploadId);if(queueEntry&&text(queueEntry.status)==='blocked')return{ok:false,status:'blocked',code:'PDF_SCAN_BLOCKED',message:text(queueEntry.message)||'Die Datei wurde nicht gespeichert.',upload:queueEntry,shipment:publicShipment(sh,session,state)};
 const container=await ensureQuarantineContainerReady(),qName=pdfSecurity.quarantineBlobName(sessionInfo.environment,customerUploadScope(sessionInfo),uploadId),qBlob=container.getBlockBlobClient(qName);
 let tagsResponse;try{tagsResponse=await qBlob.getTags()}catch(e){if(Number(e&&e.statusCode||e&&e.status)===404)throw error('UPLOAD_NOT_FOUND','Die PDF-Datei befindet sich nicht mehr in der Prüfwarteschlange.',404);throw e}
 const scan=pdfSecurity.scanResultFromTags(tagsResponse&&tagsResponse.tags||tagsResponse||{});
 if(scan.status==='clean')return promoteCleanCustomerPdf(teamBlob,sessionInfo,session,qBlob,uploadId,scan,sh,queueEntry);
 if(scan.status==='malicious'||scan.status==='not-scanned'||scan.status==='error')return blockCustomerPdf(teamBlob,sessionInfo,session,qBlob,uploadId,scan,queueEntry);
 let ageMs=0;try{const props=await qBlob.getProperties(),created=props&&props.createdOn?new Date(props.createdOn).getTime():Date.parse(text(props&&props.metadata&&props.metadata.uploadedat));if(Number.isFinite(created))ageMs=Math.max(0,Date.now()-created)}catch(_){}
 if(ageMs>30*60*1000)return blockCustomerPdf(teamBlob,sessionInfo,session,qBlob,uploadId,{status:'error',result:'Scan timeout',scanTime:''},queueEntry);
 return{ok:true,status:'scanning',upload:{id:uploadId,name:text(queueEntry&&queueEntry.name)||'Kunden-Dokument.pdf',size:Number(queueEntry&&queueEntry.size||0)||0,status:'scanning',provider:'Microsoft Defender for Storage'},shipment:publicShipment(sh,session,state)}
}
function publicShipment(sh,session,state){
 const actual=dateTimeOf(sh),autoExpiresOn=avisExpiresOn(sh),docs=documentRecords(sh).map(d=>({id:d.id,name:d.name,mime:d.mime,size:d.size,category:d.category,downloadUrl:'/api/customer-avis?action=document&id='+encodeURIComponent(d.id)+'&session='+encodeURIComponent(session)})),podDocs=docs.filter(d=>d.category==='POD'),rows=rowsOf(sh).map((r,i)=>({position:i+1,type:text(r.type||r.packaging||r.verpackung),count:Math.max(0,Math.round(num(r.count||r.qty||r.quantity||r.anzahl))),weight:num(r.weight||r.gewicht),ldm:num(r.ldm||r.loadingMeter),length:num(r.l||r.length),width:num(r.w||r.width),height:num(r.h||r.height)})),totals=rows.reduce((a,r)=>{a.count+=r.count;a.weight+=r.weight;a.ldm+=r.count*r.ldm;return a},{count:0,weight:0,ldm:0});
 if(actual)return{ok:true,closed:true,status:'Abgeholt',reference:sref(sh),customerName:text(sh.customerName||(sh.customer&&sh.customer.name)),totals:{count:totals.count},actualPickupAt:actual,pickup:{carrier:pickupCarrierOf(sh),licensePlate:pickupPlateOf(sh),driverName:pickupDriverOf(sh)},documents:docs,customerUploads:publicCustomerUploads(sh),pod:{available:podAvailable(sh),status:text(sh.podStatus)||(podAvailable(sh)?'POD vorhanden':'Noch nicht vorhanden'),documents:podDocs},avis:{enabled:true,closed:true,singleUse:false,session:true,autoExpiresOn,postPickupDays:14},lastUpdatedAt:text(sh.updatedAt||sh._syncUpdatedAt||sh.modifiedAt)};
 const planned=text(sh.customerAvisPickupDate||sh.avisPickupDate||sh.plannedPickupDate||sh.pickupDate),from=text(sh.customerAvisPickupTimeFrom||sh.avisPickupTimeFrom),to=text(sh.customerAvisPickupTimeTo||sh.avisPickupTimeTo),slotAvailability=planned&&state?avisSlots.availabilityForDate(shipmentCopies(state),planned,{subjectId:sid(sh),reference:sref(sh)}):null;
 return{ok:true,closed:false,reference:sref(sh),shipmentId:sid(sh),sender:{name:text(sh.senderName||(sh.sender&&sh.sender.name))||'Essentra Components GmbH',address:text(sh.senderAddress||(sh.sender&&[sh.sender.street,sh.sender.city,sh.sender.country].filter(Boolean).join(', ')))||'Montel-Allee 3, 41334 Nettetal, Deutschland'},customerName:text(sh.customerName||(sh.customer&&sh.customer.name)),customerNumber:text(sh.customerNumber||sh.customerAccount||sh.customerNo),customerReference:text(sh.customerReference||sh.customerRef||sh.orderReference||sh.purchaseOrder||sh.poNumber),salesOrder:text(sh.salesOrder||sh.salesOrderNumber||sh.orderNumber),recipientName:text(sh.recipientName||sh.destinationName||sh.customerName),recipientAddress:text(sh.recipientAddress||sh.deliveryAddress||sh.destinationAddress),country:text(sh.recipientCountry||sh.country),shipDate:text(sh.shipDate||sh.shippingDate||sh.shipmentDate||sh.dispatchDate),incoterm:text(sh.incoterm||sh.incoterms),carrier:text(sh.carrier||sh.carrierName||sh.spedition),status:publicStatus(sh),goodsDescription:text(sh.goodsDescription||sh.description||sh.warenbeschreibung),remark:text(sh.remark||sh.remarks||sh.bemerkung||sh.comments||sh.comment||sh.note||sh.notes||sh.shipmentRemark),rows,totals,documents:docs,customerUploads:publicCustomerUploads(sh),appointment:{date:planned,timeFrom:from,timeTo:to,plate:text(sh.customerAvisPickupPlate||sh.avisPickupPlate),reference:sref(sh),note:text(sh.customerAvisPickupNote||sh.avisPickupNote),submittedAt:text(sh.customerAvisResponseAt||sh.avisResponseAt)},slotAvailability,actualPickupAt:'',pod:{available:podAvailable(sh),status:text(sh.podStatus)||(podAvailable(sh)?'POD vorhanden':'Noch nicht vorhanden'),documents:podDocs},avis:{enabled:true,singleUse:false,session:true,securityVersion:1013,autoExpiresOn,postPickupDays:14},lastUpdatedAt:text(sh.updatedAt||sh._syncUpdatedAt||sh.modifiedAt)}
}
function validateTime(v){return!v||/^([01]\d|2[0-3]):[0-5]\d$/.test(v)}
function validateAppointment(payload){const date=text(payload.pickupDate),from=text(payload.timeFrom),to=text(payload.timeTo),plate=text(payload.plate).replace(/[\r\n]+/g,' ').slice(0,40);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw error('PICKUP_DATE_REQUIRED','Bitte ein gültiges Abholdatum angeben.',400);if(!validateTime(from)||!validateTime(to))throw error('TIME_INVALID','Bitte eine gültige Abholzeit angeben.',400);if(!avisSlots.isValidSlot(from,to))throw error('PICKUP_SLOT_INVALID','Bitte ein freies 2-Stunden-Zeitfenster zwischen 08:30 und 16:00 auswählen.',400);return{date,from,to,plate,note:text(payload.note).slice(0,1000)}}
function appointmentSnapshot(sh){return{date:text(sh&&(sh.customerAvisPickupDate||sh.avisPickupDate||sh.plannedPickupDate||sh.pickupDate)),timeFrom:text(sh&&(sh.customerAvisPickupTimeFrom||sh.avisPickupTimeFrom)),timeTo:text(sh&&(sh.customerAvisPickupTimeTo||sh.avisPickupTimeTo)),plate:text(sh&&(sh.customerAvisPickupPlate||sh.avisPickupPlate)),note:text(sh&&(sh.customerAvisPickupNote||sh.avisPickupNote))}}
function sameAppointment(a,b){return['date','timeFrom','timeTo','plate','note'].every(k=>text(a&&a[k])===text(b&&b[k]))}
function appointmentLabel(first){return first?'Abholtermin vom Kunden gemeldet':'Abholtermin vom Kunden geändert'}
function addAppointmentNotification(state,target,event){if(!event||!obj(state)||!obj(target))return;const after=event.details&&event.details.after||{},reference=sref(target),customer=text(target.customerName||(target.customer&&target.customer.name))||'Kunde',id='avis-appointment-'+event.id,list=arr(state.notifications).slice();if(list.some(x=>obj(x)&&text(x.id)===id))return;list.push({id,type:'customer-avis-appointment',source:'customer-avis',title:'Lieferavis · Abholtermin',message:customer+' hat für Sendung '+reference+' den Abholtermin '+text(after.date)+' · '+text(after.timeFrom)+'–'+text(after.timeTo)+' gebucht.',createdAt:event.at,read:false,route:'notifications',shipmentId:sid(target),shipmentRef:reference,customerName:customer,pickupDate:text(after.date),timeFrom:text(after.timeFrom),timeTo:text(after.timeTo)});state.notifications=list.slice(-200)}
function appendAppointmentHistory(sh,event){const list=arr(sh&&sh.shipmentHistory).slice();if(!list.some(x=>text(x&&x.id)===event.id))list.push(event);sh.shipmentHistory=list.slice(-500);const revisions=arr(sh&&sh.customerAvisAppointmentHistory).slice();if(!revisions.some(x=>text(x&&x.id)===event.id))revisions.push({id:event.id,at:event.at,actor:'Kunden-Avis',before:event.details.before,after:event.details.after});sh.customerAvisAppointmentHistory=revisions.slice(-100)}
function applyAppointment(state,target,payload){const v=validateAppointment(payload),stamp=now(),reference=sref(target),prior=appointmentSnapshot(target),first=!text(target&&(target.customerAvisResponseAt||target.avisResponseAt)),before=first?{date:'',timeFrom:'',timeTo:'',plate:'',note:''}:prior,after={date:v.date,timeFrom:v.from,timeTo:v.to,plate:v.plate,note:v.note},changed=first||!sameAppointment(before,after),values={customerAvisPickupDate:v.date,avisPickupDate:v.date,customerAvisPickupTimeFrom:v.from,avisPickupTimeFrom:v.from,customerAvisPickupTimeTo:v.to,avisPickupTimeTo:v.to,customerAvisPickupPlate:v.plate,avisPickupPlate:v.plate,customerAvisShipmentNumber:reference,avisShipmentNumber:reference,customerAvisPickupNote:v.note,avisPickupNote:v.note,customerAvisResponseAt:stamp,avisResponseAt:stamp,customerAvisResponseReference:reference,avisResponseReference:reference,customerAvisResponseStatus:'bestätigt',avisResponseStatus:'bestätigt',customerConfirmed:true,customerConfirmedAt:stamp,customerConfirmedVia:'customer-avis',plannedPickupDate:v.date,pickupDate:v.date,updatedAt:stamp,_syncUpdatedAt:stamp},event=changed?{id:'AVIS-APPT-'+crypto.randomBytes(10).toString('hex'),at:stamp,type:'avis',label:appointmentLabel(first),actor:{name:'Kunden-Avis',role:'Kunde'},details:{reference,before,after,oldDate:before.date,newDate:after.date,oldTimeFrom:before.timeFrom,oldTimeTo:before.timeTo,newTimeFrom:after.timeFrom,newTimeTo:after.timeTo,oldPlate:before.plate,newPlate:after.plate}}:null;findCopies(state,sid(target),reference).forEach(sh=>{Object.assign(sh,values);if(event)appendAppointmentHistory(sh,event)});if(event)addAppointmentNotification(state,target,event);return{values,event}}
async function setAvisFlags(blob,subjectId,reference,enabled,actor,firstRead){for(let i=0;i<MAX_RETRIES;i++){const d=i===0&&firstRead?firstRead:await readTeam(blob),team=d.value||{},state=obj(team.state)?team.state:{},copies=findCopies(state,subjectId,reference);if(!copies.length)throw error('SHIPMENT_NOT_FOUND','Sendung wurde nicht gefunden.',404);const stamp=now(),values=enabled?{customerAvisEnabled:true,avisEnabled:true,customerAvisEnabledAt:stamp,avisEnabledAt:stamp,customerAvisSecurityVersion:1013,avisSecurityVersion:1013,customerAvisDisabledAt:'',avisDisabledAt:'',updatedAt:stamp,_syncUpdatedAt:stamp}:{customerAvisEnabled:false,avisEnabled:false,customerAvisDisabledAt:stamp,avisDisabledAt:stamp,customerAvisSecurityVersion:0,avisSecurityVersion:0,updatedAt:stamp,_syncUpdatedAt:stamp};copies.forEach(sh=>Object.assign(sh,values));team.state=state;team.revision=Number(team.revision||0)+1;team.updatedAt=stamp;team.updatedBy=actor||'Kunden-Avis';team.updatedByUserId='customer-avis';team.clientVersion='RC1129';try{await writeTeam(blob,team,d.etag);return findShipment(state,subjectId,reference)}catch(e){if(isConflict(e)&&i<MAX_RETRIES-1){await wait(60+i*80);continue}throw e}}throw error('STATE_CONFLICT','Kunden-Avis konnte nicht gespeichert werden.',409)}
async function saveAppointment(blob,sessionInfo,session,payload,firstRead){for(let i=0;i<MAX_RETRIES;i++){const d=i===0&&firstRead?firstRead:await readTeam(blob),team=d.value||{},state=obj(team.state)?team.state:{},target=findShipment(state,sessionInfo.record.subjectId,sessionInfo.record.reference)||((sessionInfo.record&&obj(sessionInfo.record.snapshot))?ensureDraftShipment(state,sessionInfo.record.subjectId,sessionInfo.record.reference,sessionInfo.record.snapshot):null);if(!target)throw error('SHIPMENT_NOT_FOUND','Sendung wurde nicht gefunden.',404);if(dateTimeOf(target))throw error('AVIS_CLOSED','Der Lieferavis ist nach der Abholung geschlossen. Änderungen sind nicht mehr möglich.',410);const checked=validateAppointment(payload),slot=avisSlots.slotState(shipmentCopies(state),checked.date,checked.from,checked.to,{subjectId:sid(target),reference:sref(target)});if(!slot)throw error('PICKUP_SLOT_INVALID','Bitte ein freies 2-Stunden-Zeitfenster zwischen 08:30 und 16:00 auswählen.',400);if(!slot.available)throw error('PICKUP_SLOT_FULL','Dieses Zeitfenster ist inzwischen ausgebucht. Bitte wählen Sie einen anderen freien Slot.',409);applyAppointment(state,target,payload);team.state=state;team.revision=Number(team.revision||0)+1;team.updatedAt=now();team.updatedBy='Kunden-Avis';team.updatedByUserId='customer-avis';team.clientVersion='RC1224';try{await writeTeam(blob,team,d.etag);return publicShipment(findShipment(state,sessionInfo.record.subjectId,sessionInfo.record.reference),session,state)}catch(e){if(isConflict(e)&&i<MAX_RETRIES-1){await wait(80+i*100);continue}throw e}}throw error('STATE_CONFLICT','Avis-Bestätigung konnte nicht gespeichert werden.',409)}
function sessionFromRequest(req,payload){const h=req&&req.headers||{};return text(h['x-exporthub-avis-session']||h['X-ExportHUB-Avis-Session']||(payload&&payload.session)||(req&&req.query&&req.query.session))}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{'Cache-Control':'no-store','Allow':'GET, POST, OPTIONS','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff'},body:''};return}
 try{
  const requestStarted=Date.now(),payload=body(req),action=lower(payload.action);
  if(req.method==='POST'&&action==='draft-sync'){
   const authStarted=Date.now(),internal=await auth.validateSession(req),authMs=elapsed(authStarted);if(!auth.hasAnyEditRight(internal.user))throw auth.error('WRITE_FORBIDDEN','Für Kunden-Avis fehlen Bearbeitungsrechte.',403);
   const subjectId=text(payload.shipmentId||payload.id||payload.reference||payload.ref),reference=upper(payload.reference||payload.ref),snapshot=sanitizeDraftSnapshot(payload.shipmentSnapshot,subjectId,reference),syncStarted=Date.now();
   const result=await access.updateSubjectSnapshot(req,'avis',subjectId,snapshot,internal.user.name||internal.user.user||'ExportHUB',payload);
   const timing={authMs,teamBlobMs:0,teamReadMs:0,flagWriteMs:0,tokenIssueMs:0,draftSyncMs:elapsed(syncStarted),teamWriteMs:0,totalMs:elapsed(requestStarted)};
   context.res=json(200,{ok:true,synced:true,shipmentId:subjectId,reference:snapshot.reference,updated:Number(result&&result.updated||0),timing,version:'RC1069'},timingHeaders(timing));return
  }
  if(req.method==='POST'&&(action==='issue'||action==='disable')){
   const authStarted=Date.now(),internal=await auth.validateSession(req),authMs=elapsed(authStarted);if(!auth.hasAnyEditRight(internal.user))throw auth.error('WRITE_FORBIDDEN','Für Kunden-Avis fehlen Bearbeitungsrechte.',403);
   const env=access.environment(req,payload),teamBlobStarted=Date.now(),blob=await teamBlob(env),teamBlobMs=elapsed(teamBlobStarted),canReuseAuthTeam=env==='production'&&internal&&internal.teamDoc&&obj(internal.teamDoc.value)&&text(auth.TEAM_CONTAINER)===TEAM_CONTAINER&&text(auth.TEAM_BLOB)===TEAM_BLOB_BASE,readStarted=Date.now(),d=canReuseAuthTeam?internal.teamDoc:await readTeam(blob),team=d.value||{},state=obj(team.state)?team.state:{};if(!obj(team.state))team.state=state;
   const timing={authMs,teamBlobMs,teamReadMs:elapsed(readStarted),flagWriteMs:0,tokenIssueMs:0,totalMs:0};
   const subjectId=text(payload.shipmentId||payload.id||payload.reference||payload.ref),reference=upper(payload.reference||payload.ref);let target=findShipment(state,subjectId,reference),draftOnly=false;
   if(!target&&payload.shipmentSnapshot){target=sanitizeDraftSnapshot(payload.shipmentSnapshot,subjectId,reference);draftOnly=true}
   if(!target)throw error('SHIPMENT_NOT_FOUND','Sendung wurde nicht gefunden.',404);
   const actualSubject=sid(target)||subjectId,actualRef=sref(target),snapshot=sanitizeDraftSnapshot(target,actualSubject,actualRef);
   if(action==='disable'){await access.revokeSubject(req,'avis',actualSubject,'disabled',internal.user.name||internal.user.user||'ExportHUB',payload);if(!draftOnly){const flagStarted=Date.now();await setAvisFlags(blob,actualSubject,actualRef,false,internal.user.name||internal.user.user,d);timing.flagWriteMs=elapsed(flagStarted)}timing.totalMs=elapsed(requestStarted);context.res=json(200,{ok:true,disabled:true,shipmentId:actualSubject,reference:actualRef,timing,version:'RC1129'},timingHeaders(timing));return}
   const actor=internal.user.name||internal.user.user||'ExportHUB',tokenStarted=Date.now(),needsFlagWrite=!draftOnly&&avisManuallyDisabled(target);let issued;
   if(needsFlagWrite){const flagStarted=Date.now(),flagPromise=setAvisFlags(blob,actualSubject,actualRef,true,actor,d).finally(()=>{timing.flagWriteMs=elapsed(flagStarted)}),tokenPromise=access.issue(req,'avis',{subjectId:actualSubject,shipmentId:actualSubject,reference:actualRef,actor,snapshot},null,payload).finally(()=>{timing.tokenIssueMs=elapsed(tokenStarted)});const pair=await Promise.all([flagPromise,tokenPromise]);issued=pair[1]}
   else{issued=await access.issue(req,'avis',{subjectId:actualSubject,shipmentId:actualSubject,reference:actualRef,actor,snapshot},null,payload);timing.tokenIssueMs=elapsed(tokenStarted)}
   timing.totalMs=elapsed(requestStarted);context.res=json(200,{ok:true,issued:true,token:issued.token,shipmentId:actualSubject,reference:actualRef,expiresAt:issued.expiresAt,url:'/customer-avis.html?token='+encodeURIComponent(issued.token)+'&environment='+encodeURIComponent(env),oneTime:false,timing,version:'RC1129'},timingHeaders(timing));return
  }
  if(req.method==='POST'&&action==='authorize'){
   const raw=text(payload.token),resolved=await access.resolve(req,'avis',raw,{allowUsed:true},payload),blob=await teamBlob(resolved.environment),d=await readTeam(blob),state=obj(d.value&&d.value.state)?d.value.state:{},sh=findShipment(state,resolved.record.subjectId,resolved.record.reference)||(obj(resolved.record&&resolved.record.snapshot)?resolved.record.snapshot:null),reference=upper(payload.reference);if(!sh)throw error('SHIPMENT_NOT_FOUND','Sendung wurde nicht gefunden.',404);assertAvisWindow(sh);if(!reference||reference!==sref(sh)){const failed=await access.registerFailure(resolved.environment,'avis',resolved.tokenHash,'reference');if(failed.lockedUntil)throw error('ACCESS_LOCKED','Zu viele falsche Referenzeingaben. Der Zugriff ist vorübergehend gesperrt.',429);await wait(300);throw error('AVIS_ACCESS_DENIED','Die Referenznummer ist nicht korrekt.',403)}const cleared=await access.clearFailures(resolved.environment,'avis',resolved.tokenHash),sessionInfo=access.issueSession(cleared),response=publicShipment(sh,sessionInfo.session,state);response.session=sessionInfo.session;response.sessionExpiresAt=sessionInfo.expiresAt;response.rawLinkConsumed=false;context.res=json(200,response);return
  }
  const session=sessionFromRequest(req,payload);if(!session)throw error('AVIS_SESSION_REQUIRED','Bitte den Kunden-Avis-Link erneut öffnen.',401);const sessionInfo=await access.resolveSession(session,'avis'),blob=await teamBlob(sessionInfo.environment),d=await readTeam(blob),state=obj(d.value&&d.value.state)?d.value.state:{},sh=findShipment(state,sessionInfo.record.subjectId,sessionInfo.record.reference)||(obj(sessionInfo.record&&sessionInfo.record.snapshot)?sessionInfo.record.snapshot:null);if(!sh)throw error('SHIPMENT_NOT_FOUND','Sendung wurde nicht gefunden.',404);assertAvisWindow(sh);
  if(req.method==='GET'){
   const getAction=lower(req.query&&req.query.action);if(getAction==='document'){const id=text(req.query&&req.query.id),doc=documentRecords(sh).find(x=>x.id===id);if(!doc)throw error('DOCUMENT_NOT_FOUND','Das Dokument ist nicht mehr verfügbar.',404);if(doc.inline){context.res={status:200,isRaw:true,headers:{'Content-Type':doc.inline.mime||doc.mime||'application/octet-stream','Content-Disposition':contentDisposition(doc.name),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'},body:doc.inline.bytes};return}if(doc.blobName){const stored=await readDocumentBlob(doc.blobName,sessionInfo.environment);context.res={status:200,isRaw:true,headers:{'Content-Type':stored.mime||doc.mime||'application/octet-stream','Content-Disposition':contentDisposition(doc.name),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'},body:stored.bytes};return}if(doc.external){context.res={status:302,headers:{Location:doc.external,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'},body:''};return}throw error('DOCUMENT_NOT_FOUND','Das Dokument ist nicht mehr verfügbar.',404)}context.res=json(200,publicShipment(sh,session,state));return
  }
  if(req.method==='POST'){
   const postAction=lower(payload.action||'appointment');
   if(postAction==='availability'){const date=text(payload.pickupDate);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw error('PICKUP_DATE_REQUIRED','Bitte zuerst einen gültigen Abholtag auswählen.',400);context.res=json(200,{ok:true,availability:avisSlots.availabilityForDate(shipmentCopies(state),date,{subjectId:sid(sh),reference:sref(sh)})});return}
   if(postAction==='upload-document'){
    if(dateTimeOf(sh))throw error('AVIS_CLOSED','Der Lieferavis ist nach der Abholung geschlossen. Dokumente können nicht mehr hochgeladen werden.',410);
    const docType=contentCheck.documentType(payload.documentType),validated=pdfSecurity.validatePdfUpload(payload.file),already=customerUploadFile(sh,validated.sha256),queued=customerUploadQueueEntry(sh,validated.sha256);
    if(already){context.res=json(200,{ok:true,status:'saved',upload:{id:validated.sha256,name:fileName(already,validated.name),size:Number(already.size||validated.size),status:'saved'},shipment:publicShipment(sh,session,state)});return}
    if(queued&&text(queued.status)==='scanning'){context.res=json(202,{ok:true,status:'scanning',upload:queued,shipment:publicShipment(sh,session,state)});return}
    assertCustomerUploadQuota(sh);
    const quarantine=await uploadQuarantinePdf(sessionInfo,session,validated);
    try{
     const shipment=await savePendingCustomerUpload(blob,sessionInfo,session,{id:validated.sha256,name:validated.name,size:validated.size,status:'scanning',documentType:docType,uploadedAt:quarantine.uploadedAt,message:'PDF wird auf Schadsoftware geprüft. Danach wird die Sendungszuordnung fachlich geprüft.'},d);
     context.res=json(202,{ok:true,status:'scanning',upload:{id:validated.sha256,name:validated.name,size:validated.size,status:'scanning',documentType:docType,provider:'Microsoft Defender for Storage'},shipment});return
    }catch(e){try{if(typeof quarantine.blob.deleteIfExists==='function')await quarantine.blob.deleteIfExists()}catch(_){}throw e}
   }
   if(postAction==='document-upload-status'){
    context.res=json(200,await customerPdfScanStatus(blob,sessionInfo,session,sh,lower(payload.uploadId),state));return
   }
   if(postAction!=='appointment')throw error('UNKNOWN_ACTION','Unbekannte Avis-Aktion.',400);
   context.res=json(200,await saveAppointment(blob,sessionInfo,session,payload,d));return
  }
  context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'GET, POST, OPTIONS'});
 }catch(e){context.log&&context.log.error&&context.log.error('customer-avis RC1224',e&&e.code,e&&e.message);context.res=json(e.status||e.statusCode||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Kunden-Avis ist vorübergehend nicht verfügbar.'})}
};