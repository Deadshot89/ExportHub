'use strict';
const crypto=require('crypto');

const DOCUMENT_CONTAINER=process.env.EXPORTHUB_DOCUMENT_CONTAINER||'exporthub-documents';
const DOCUMENT_FIELDS=['deliveryFiles','deliveryNotesFiles','podFiles','abdFiles','documents','generatedDocuments','files','attachments','invoiceFiles','mailAttachments','lieferscheine'];
const ROOT_COLLECTIONS=['shipments','savedShipments','abdRequests'];
const INLINE_FIELDS=['data','dataUrl','payload','content','base64'];
const CONTAINER_READY=new WeakMap();

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function text(v){return String(v==null?'':v).trim()}
function normalizeEnvironment(value){return text(value).toLowerCase()==='testservice'?'testservice':'production'}
function cleanMime(value){const v=text(value).toLowerCase();return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(v)?v:'application/octet-stream'}
function base64Buffer(value){
 const raw=String(value||'').replace(/\s+/g,'');
 if(!raw||raw.length%4===1||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw))return null;
 try{
  const buffer=Buffer.from(raw,'base64');
  if(!buffer.length)return null;
  const normalized=buffer.toString('base64').replace(/=+$/,'');
  if(normalized!==raw.replace(/=+$/,''))return null;
  return buffer;
 }catch(_){return null}
}
function extractInlinePayload(file){
 if(!file||typeof file!=='object'||Array.isArray(file)||file.storage==='blob')return null;
 for(const key of INLINE_FIELDS){
  const value=file[key];
  if(typeof value!=='string'||!value.trim())continue;
  const valueText=value.trim();
  const m=valueText.match(/^data:([^;,]+)?;base64,([A-Za-z0-9+/=\s]+)$/i);
  if(m){const buffer=base64Buffer(m[2]);if(buffer)return{buffer,mimeType:cleanMime(m[1]||file.mimeType||file.type),sourceField:key}}
  if(key==='base64'||key==='payload'||key==='content'){
   const buffer=base64Buffer(valueText);
   if(buffer)return{buffer,mimeType:cleanMime(file.mimeType||file.type),sourceField:key};
  }
 }
 return null;
}
function stripInlineFields(file){const out=clone(file)||{};for(const key of INLINE_FIELDS)delete out[key];return out}
function rowIdentity(row,index){return text(row&&(row.id||row.shipmentId||row.ref||row.reference||row.referenceNumber||row.abdRequestId))||('idx-'+index)}
function fileIdentity(file,index){return text(file&&(file.id||file.fileId||file.remoteId||file.documentId))||[text(file&&(file.name||file.fileName||file.filename)),text(file&&file.size),text(file&&(file.uploadedAt||file.addedAt||file.createdAt)),index].join('|')}
function inlineFingerprint(file){const p=extractInlinePayload(file);return p?crypto.createHash('sha256').update(p.buffer).digest('hex'):''}
function existingDocumentMap(state){
 const map=new Map(),src=state&&typeof state==='object'?state:{};
 for(const root of ROOT_COLLECTIONS){const rows=Array.isArray(src[root])?src[root]:[];rows.forEach((row,ri)=>{const rid=rowIdentity(row,ri);for(const field of DOCUMENT_FIELDS){const files=Array.isArray(row&&row[field])?row[field]:[];files.forEach((file,fi)=>map.set([root,rid,field,fileIdentity(file,fi)].join('::'),clone(file)))}})}
 return map;
}
function blobMetadataFromExisting(existing,incoming){
 const out=Object.assign({},clone(existing)||{},stripInlineFields(incoming)||{});
 ['storage','blobName','sha256','size','mimeType'].forEach(k=>{if(existing&&existing[k]!==undefined)out[k]=existing[k]});
 return out;
}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
function createDocumentContainer(){
 const cs=connectionString();
 if(!cs){const e=new Error('App-Einstellung EXPORTHUB_STORAGE_CONNECTION_STRING fehlt.');e.code='STORAGE_NOT_CONFIGURED';e.status=503;throw e}
 const {BlobServiceClient}=require('@azure/storage-blob');
 return BlobServiceClient.fromConnectionString(cs).getContainerClient(DOCUMENT_CONTAINER);
}
async function ensureDocumentContainer(container){
 if(!container||typeof container.createIfNotExists!=='function')return false;
 let ready=CONTAINER_READY.get(container);
 if(!ready){
  ready=Promise.resolve().then(()=>container.createIfNotExists()).catch(e=>{CONTAINER_READY.delete(container);throw e});
  CONTAINER_READY.set(container,ready);
 }
 await ready;return true;
}
async function uploadIdempotent(blob,buffer,mimeType,metadata){
 const options={blobHTTPHeaders:{blobContentType:mimeType,blobCacheControl:'private, no-store'},metadata,conditions:{ifNoneMatch:'*'}};
 try{
  if(typeof blob.uploadData==='function')return await blob.uploadData(buffer,options);
  return await blob.upload(buffer,buffer.length,options);
 }catch(e){
  const status=Number(e&&e.statusCode||e&&e.status||0);
  if(status===409||status===412||/BlobAlreadyExists|ConditionNotMet/i.test(String(e&&e.code||'')))return{alreadyExists:true};
  throw e;
 }
}
async function readBlobBuffer(blob){
 if(typeof blob.downloadToBuffer==='function')return Buffer.from(await blob.downloadToBuffer());
 if(typeof blob.download==='function'){
  const response=await blob.download(0);
  if(response&&response.readableStreamBody){
   const chunks=[];
   for await(const chunk of response.readableStreamBody)chunks.push(Buffer.from(chunk));
   return Buffer.concat(chunks);
  }
 }
 const e=new Error('Blob-Verifikation wird vom Client nicht unterstützt.');e.code='BLOB_VERIFY_UNSUPPORTED';throw e;
}
async function verifiedStoreInlineDocument(file,options={}){
 const parsed=extractInlinePayload(file);if(!parsed)return clone(file);
 const environment=normalizeEnvironment(options.environment),container=options.container||createDocumentContainer();
 await ensureDocumentContainer(container);
 const hash=crypto.createHash('sha256').update(parsed.buffer).digest('hex'),blobName=`rc1059/${environment}/${hash.slice(0,2)}/${hash}`,blob=container.getBlockBlobClient(blobName);
 await uploadIdempotent(blob,parsed.buffer,parsed.mimeType,{sha256:hash,environment,kind:'exporthub-document'});
 const verified=await readBlobBuffer(blob),verifiedHash=crypto.createHash('sha256').update(verified).digest('hex');
 if(verified.length!==parsed.buffer.length||verifiedHash!==hash){const e=new Error('Blob-Verifikation fehlgeschlagen.');e.code='BLOB_VERIFY_FAILED';throw e}
 return Object.assign(stripInlineFields(file),{storage:'blob',blobName,sha256:hash,size:parsed.buffer.length,mimeType:parsed.mimeType});
}
async function storeInlineDocument(file,options={}){
 const parsed=extractInlinePayload(file);if(!parsed)return clone(file);
 const environment=normalizeEnvironment(options.environment),container=options.container||createDocumentContainer();
 await ensureDocumentContainer(container);
 const hash=crypto.createHash('sha256').update(parsed.buffer).digest('hex'),blobName=`rc1059/${environment}/${hash.slice(0,2)}/${hash}`,blob=container.getBlockBlobClient(blobName);
 await uploadIdempotent(blob,parsed.buffer,parsed.mimeType,{sha256:hash,environment,kind:'exporthub-document'});
 return Object.assign(stripInlineFields(file),{storage:'blob',blobName,sha256:hash,size:parsed.buffer.length,mimeType:parsed.mimeType});
}
async function externalizeDocumentCollections(state,options={}){
 const out=clone(state)||{},existing=existingDocumentMap(options.currentState),stats={externalized:0,inlineBytes:0,scanned:0,legacySkipped:0,blobReused:0};
 for(const root of ROOT_COLLECTIONS){
  const rows=Array.isArray(out[root])?out[root]:[];
  for(let ri=0;ri<rows.length;ri++){
   const row=rows[ri];if(!row||typeof row!=='object')continue;const rid=rowIdentity(row,ri);
   for(const field of DOCUMENT_FIELDS){
    const files=Array.isArray(row[field])?row[field]:[];
    for(let i=0;i<files.length;i++){
     const file=files[i],key=[root,rid,field,fileIdentity(file,i)].join('::'),prior=existing.get(key),parsed=extractInlinePayload(file);stats.scanned++;
     if(prior&&prior.storage==='blob'&&prior.blobName){files[i]=blobMetadataFromExisting(prior,file);stats.blobReused++;continue}
     if(!parsed)continue;
     if(prior&&inlineFingerprint(prior)===crypto.createHash('sha256').update(parsed.buffer).digest('hex')){stats.legacySkipped++;continue}
     const stored=await storeInlineDocument(file,options);files[i]=stored;stats.externalized++;stats.inlineBytes+=parsed.buffer.length;
    }
   }
 }
 return{state:out,stats};
}
async function migrateLegacyDocuments(state,options={}){
 const out=clone(state)||{},limit=Math.max(1,Math.min(10,Number(options.limit)||5));
 let found=0,migrated=0,skipped=0,failed=0,bytesMoved=0,attempted=0;
 const inlineEntries=[];
 for(const root of ROOT_COLLECTIONS){
  const rows=Array.isArray(out[root])?out[root]:[];
  for(let ri=0;ri<rows.length;ri++){
   const row=rows[ri];if(!row||typeof row!=='object')continue;
   for(const field of DOCUMENT_FIELDS){
    const files=Array.isArray(row[field])?row[field]:[];
    for(let fi=0;fi<files.length;fi++){
     const file=files[fi];
     if(file&&file.storage==='blob'&&file.blobName){skipped++;continue}
     const parsed=extractInlinePayload(file);
     if(parsed){found++;inlineEntries.push({files,fi,file,bytes:parsed.buffer.length});}
    }
   }
  }
 }
 for(const entry of inlineEntries){
  if(attempted>=limit)break;
  attempted++;
  try{
   const stored=await verifiedStoreInlineDocument(entry.file,options);
   entry.files[entry.fi]=stored;migrated++;bytesMoved+=entry.bytes;
  }catch(_){failed++;}
 }
 const remaining=found-migrated;
 return{state:out,found,migrated,skipped,failed,remaining,bytesMoved,done:remaining===0};
}

module.exports={DOCUMENT_CONTAINER,DOCUMENT_FIELDS,ROOT_COLLECTIONS,INLINE_FIELDS,normalizeEnvironment,extractInlinePayload,storeInlineDocument,externalizeDocumentCollections,migrateLegacyDocuments,createDocumentContainer,ensureDocumentContainer};
