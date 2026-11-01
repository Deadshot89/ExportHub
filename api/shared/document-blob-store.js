'use strict';
const crypto=require('crypto');
const pdfReferences=require('./pdf-document-reference');

const DOCUMENT_CONTAINER=process.env.EXPORTHUB_DOCUMENT_CONTAINER||'exporthub-documents';
const DOCUMENT_FIELDS=['deliveryFiles','deliveryNotesFiles','podFiles','abdFiles','documents','generatedDocuments','files','attachments','invoiceFiles','mailAttachments','lieferscheine'];
// RC1663: RC1624 writes ABD files to sharedShipments as well. Always externalize
// those files before merging the incoming state, rather than leaving an inline PDF.
const ROOT_COLLECTIONS=['shipments','savedShipments','sharedShipments','abdRequests','packNotifications','packDrafts'];
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

function inlineCandidateStats(file){
 if(!file||typeof file!=='object'||Array.isArray(file)||file.storage==='blob')return{count:0,bytes:0};
 let count=0,bytes=0;
 for(const key of INLINE_FIELDS){
  const value=file[key];
  if(typeof value!=='string'||!value.trim())continue;
  const raw=value.trim(),isData=/^data:/i.test(raw),isPayloadField=/^(data|payload|content|base64)$/i.test(key);
  if(isData||(isPayloadField&&raw.length>1024)){count++;bytes+=Buffer.byteLength(raw)}
 }
 return{count,bytes};
}
function legacyDocumentInventory(state){
 const source=state&&typeof state==='object'?state:{};
 const target=source&&source.state&&typeof source.state==='object'&&!Array.isArray(source.state)?source.state:source;
 const entries=[];let found=0,skipped=0,inlineBytes=0,candidateCount=0,candidateBytes=0;
 for(const root of ROOT_COLLECTIONS){
  const rows=Array.isArray(target[root])?target[root]:[];
  for(let ri=0;ri<rows.length;ri++){
   const row=rows[ri];if(!row||typeof row!=='object')continue;
   for(const field of DOCUMENT_FIELDS){
    const files=Array.isArray(row[field])?row[field]:[];
    for(let fi=0;fi<files.length;fi++){
     const file=files[fi];
     if(file&&file.storage==='blob'&&file.blobName){skipped++;continue}
     const parsed=extractInlinePayload(file);
     if(parsed){
      found++;inlineBytes+=parsed.buffer.length;
      entries.push({root,rowIndex:ri,field,fileIndex:fi,files,fi,file,bytes:parsed.buffer.length});
      continue;
     }
     const candidate=inlineCandidateStats(file);
     candidateCount+=candidate.count;candidateBytes+=candidate.bytes;
    }
   }
  }
 }
 return{entries,found,skipped,inlineBytes,candidateCount,candidateBytes};
}
function stripInlineFields(file){const out=clone(file)||{};for(const key of INLINE_FIELDS)delete out[key];return out}
function rowIdentity(row,index,root){
 // RC1664: historical editor IDs may be shared across different shipment REFs.
 // Never reuse a blob from a different real shipment just because its ID matches.
 if(root==='shipments'||root==='savedShipments'||root==='sharedShipments'){
  const ref=text(row&&(row.ref||row.reference||row.shipmentRef||row.referenceNumber||row.referenceNo||row.refNo||row.refNr||row.sendungsnummer||row.exporthubRef||row.exportHubReference)).toUpperCase();
  if(ref)return'ref:'+ref;
 }
 return text(row&&(row.id||row.shipmentId||row.ref||row.reference||row.referenceNumber||row.abdRequestId))||('idx-'+index)
}
function fileIdentity(file,index){return text(file&&(file.id||file.fileId||file.remoteId||file.documentId))||[text(file&&(file.name||file.fileName||file.filename)),text(file&&file.size),text(file&&(file.uploadedAt||file.addedAt||file.createdAt)),index].join('|')}
function inlineFingerprint(file){const p=extractInlinePayload(file);return p?crypto.createHash('sha256').update(p.buffer).digest('hex'):''}
function existingDocumentMap(state){
 const map=new Map(),src=state&&typeof state==='object'?state:{};
 for(const root of ROOT_COLLECTIONS){const rows=Array.isArray(src[root])?src[root]:[];rows.forEach((row,ri)=>{const rid=rowIdentity(row,ri,root);for(const field of DOCUMENT_FIELDS){const files=Array.isArray(row&&row[field])?row[field]:[];files.forEach((file,fi)=>map.set([root,rid,field,fileIdentity(file,fi)].join('::'),clone(file)))}})}
 return map;
}
function incomingDocumentScan(state){
 const src=state&&typeof state==='object'?state:{};let scanned=0,hasInlineFields=false;
 for(const root of ROOT_COLLECTIONS){
  const rows=Array.isArray(src[root])?src[root]:[];
  for(const row of rows){
   if(!row||typeof row!=='object')continue;
   for(const field of DOCUMENT_FIELDS){
    const files=Array.isArray(row[field])?row[field]:[];
    for(const file of files){
     scanned++;
     if(!file||typeof file!=='object'||Array.isArray(file)||file.storage==='blob')continue;
     if(INLINE_FIELDS.some(key=>typeof file[key]==='string'&&file[key].trim())){hasInlineFields=true;return{scanned,hasInlineFields}}
    }
   }
  }
 }
 return{scanned,hasInlineFields};
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
  const code=text(e&&(e.code||e.details&&e.details.errorCode));
  // RC1665: a 409/412 is NOT proof that the expected PDF exists. A lease,
  // container or other Azure conflict must never create a dead ABD reference.
  if(![409,412].includes(status)||!/^(BlobAlreadyExists|ConditionNotMet)$/i.test(code))throw e;
  if(typeof blob.getProperties!=='function')throw e;
  let existing;
  try{existing=await blob.getProperties()}catch(_){throw e}
  const actualMeta=existing&&existing.metadata||{};
  const expectedHash=text(metadata&&metadata.sha256).toLowerCase();
  const actualHash=text(actualMeta.sha256).toLowerCase();
  const expectedEnv=normalizeEnvironment(metadata&&metadata.environment);
  const actualEnv=text(actualMeta.environment).toLowerCase();
  if(expectedHash&&actualHash===expectedHash&&actualEnv===expectedEnv&&
     Number(existing.contentLength)===buffer.length)return{alreadyExists:true,verifiedExisting:true};
  const conflict=new Error('Vorhandenes Dokument konnte nicht eindeutig verifiziert werden.');
  conflict.code='DOCUMENT_BLOB_CONFLICT_UNVERIFIED';conflict.status=409;throw conflict;
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
function normalizeInlineDocumentName(file,parsed){
 try{return pdfReferences.normalizePdfDocument(file,parsed.buffer,parsed.mimeType)}catch(_){return clone(file)}
}
// D365 SalesPackingSlip and most other generated PDFs use CID fonts (glyph ids
// plus a ToUnicode map), which the fast extractor cannot decode. Retry every
// PDF with the existing PDF engine, whatever the upload was called.
// Never infer document references from the technical filename's numeric fields.
async function normalizeInlineDocumentNameRobust(file,parsed,options={}){
 const first=normalizeInlineDocumentName(file,parsed);
 const name=text(file&&(file.name||file.fileName||file.filename));
 if(first.documentReference||!/\.pdf$/i.test(name)||parsed.mimeType!=='application/pdf')return first;
 const fastResult=pdfReferences.normalizedPdfName(name,pdfReferences.extractPdfText(parsed.buffer));
 if(fastResult.reason==='ambiguous')return first;
 try{
  const extractor=typeof options.pdfTextExtractor==='function'?options.pdfTextExtractor:
    require('./customer-avis-document-content').extractPdfText;
  const recognized=pdfReferences.normalizedPdfName(name,await extractor(parsed.buffer));
  if(!recognized.renamed||!recognized.reference)return first;
  return Object.assign({},first,{
   originalName:file.originalName||name,name:recognized.name,
   documentReference:recognized.reference,
   documentReferenceType:recognized.reason==='side'?'SIDE':'DNC'
  });
 }catch(_){return first}
}
async function verifiedStoreInlineDocument(file,options={}){
 const parsed=extractInlinePayload(file);if(!parsed)return clone(file);
 const normalizedFile=await normalizeInlineDocumentNameRobust(file,parsed,options);
 const environment=normalizeEnvironment(options.environment),container=options.container||createDocumentContainer();
 await ensureDocumentContainer(container);
 const hash=crypto.createHash('sha256').update(parsed.buffer).digest('hex'),blobName=`rc1059/${environment}/${hash.slice(0,2)}/${hash}`,blob=container.getBlockBlobClient(blobName);
 await uploadIdempotent(blob,parsed.buffer,parsed.mimeType,{sha256:hash,environment,kind:'exporthub-document'});
 const verified=await readBlobBuffer(blob),verifiedHash=crypto.createHash('sha256').update(verified).digest('hex');
 if(verified.length!==parsed.buffer.length||verifiedHash!==hash){const e=new Error('Blob-Verifikation fehlgeschlagen.');e.code='BLOB_VERIFY_FAILED';throw e}
 return Object.assign(stripInlineFields(normalizedFile),{storage:'blob',blobName,sha256:hash,size:parsed.buffer.length,mimeType:parsed.mimeType});
}
async function storeInlineDocument(file,options={}){
 const parsed=extractInlinePayload(file);if(!parsed)return clone(file);
 const normalizedFile=await normalizeInlineDocumentNameRobust(file,parsed,options);
 const environment=normalizeEnvironment(options.environment),container=options.container||createDocumentContainer();
 await ensureDocumentContainer(container);
 const hash=crypto.createHash('sha256').update(parsed.buffer).digest('hex'),blobName=`rc1059/${environment}/${hash.slice(0,2)}/${hash}`,blob=container.getBlockBlobClient(blobName);
 await uploadIdempotent(blob,parsed.buffer,parsed.mimeType,{sha256:hash,environment,kind:'exporthub-document'});
 return Object.assign(stripInlineFields(normalizedFile),{storage:'blob',blobName,sha256:hash,size:parsed.buffer.length,mimeType:parsed.mimeType});
}
async function externalizeDocumentCollections(state,options={}){
 const scan=incomingDocumentScan(state),stats={externalized:0,inlineBytes:0,scanned:scan.scanned,legacySkipped:0,blobReused:0,fastPath:!scan.hasInlineFields};
 if(!scan.hasInlineFields)return{state:state&&typeof state==='object'?state:{},stats};
 const out=clone(state)||{},existing=existingDocumentMap(options.currentState);stats.scanned=0;
 for(const root of ROOT_COLLECTIONS){
  const rows=Array.isArray(out[root])?out[root]:[];
  for(let ri=0;ri<rows.length;ri++){
   const row=rows[ri];if(!row||typeof row!=='object')continue;const rid=rowIdentity(row,ri,root);
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
 }
 return{state:out,stats};
}
async function migrateLegacyDocuments(state,options={}){
 const out=clone(state)||{},limit=Math.max(1,Math.min(10,Number(options.limit)||5));
 const inventory=legacyDocumentInventory(out);
 let migrated=0,failed=0,bytesMoved=0,attempted=0;
 for(const entry of inventory.entries){
  if(attempted>=limit)break;
  attempted++;
  try{
   const stored=await verifiedStoreInlineDocument(entry.file,options);
   entry.files[entry.fi]=stored;migrated++;bytesMoved+=entry.bytes;
  }catch(_){failed++;}
 }
 const remaining=inventory.found-migrated;
 return{state:out,found:inventory.found,migrated,skipped:inventory.skipped,failed,remaining,bytesMoved,done:remaining===0};
}


/**
 * Opt-in legacy metadata repair. No original PDF bytes or Blob paths change.
 * Never infer a DNC/SIDE from the opaque SalesPackingSlip filename.
 * Preview is the default; only an authorized caller can persist an apply result.
 */
async function repairLegacyBlobDocumentNames(state,options={}){
  const environment=normalizeEnvironment(options.environment);
  const apply=options.apply===true,limit=Math.max(1,Math.min(10,Math.floor(Number(options.limit)||5)));
  const maxBytes=10*1024*1024;
  const out=clone(state)||{};
  const body=out&&out.state&&typeof out.state==='object'&&!Array.isArray(out.state)?out.state:out;
  const candidates=[];
  for(const root of ROOT_COLLECTIONS){
    for(const row of Array.isArray(body[root])?body[root]:[]){
      if(!row||typeof row!=='object')continue;
      for(const field of DOCUMENT_FIELDS){
        for(const file of Array.isArray(row[field])?row[field]:[]){
          if(file&&typeof file==='object'&&file.storage==='blob'&&
             /^SalesPackingSlip[-_].*\.pdf$/i.test(text(file.name||file.fileName||file.filename)))
            candidates.push(file);
        }
      }
    }
  }
  const stats={state:out,found:candidates.length,examined:0,wouldRename:0,repaired:0,unresolved:0,invalid:0,oversized:0,failed:0,remaining:candidates.length,preview:!apply,done:false};
  if(!candidates.length){stats.done=true;return stats}
  const container=options.container||createDocumentContainer();
  for(const file of candidates.slice(0,limit)){
    stats.examined++;
    const match=text(file.blobName).match(/^rc1059\/(production|testservice)\/([a-f0-9]{2})\/([a-f0-9]{64})$/);
    if(!match||match[1]!==environment||match[2]!==match[3].slice(0,2)||
       (text(file.sha256)&&text(file.sha256).toLowerCase()!==match[3])){
      stats.invalid++;continue;
    }
    try{
      const blob=container.getBlockBlobClient(file.blobName);
      // Check metadata before downloading; large PDFs never enter the parser.
      if(typeof blob.getProperties!=='function'){stats.invalid++;continue}
      const properties=await blob.getProperties();
      const length=Number(properties&&properties.contentLength);
      if(!Number.isFinite(length)||length<5){stats.invalid++;continue}
      if(length>maxBytes){stats.oversized++;continue}
      const bytes=await readBlobBuffer(blob);
      if(bytes.length>maxBytes){stats.oversized++;continue}
      if(bytes.subarray(0,5).toString('ascii')!=='%PDF-'||
         crypto.createHash('sha256').update(bytes).digest('hex')!==match[3]){
        stats.invalid++;continue;
      }
      const renamed=await normalizeInlineDocumentNameRobust(file,{buffer:bytes,mimeType:'application/pdf'},options);
      if(!renamed.documentReference||renamed.name===file.name||
         (file.documentReference&&file.documentReference!==renamed.documentReference)){
        stats.unresolved++;continue;
      }
      stats.wouldRename++;
      if(apply){
        // Only metadata changes. Keep the document ID, visibility, Blob identity,
        // digest, customer access and original PDF bytes untouched.
        file.originalName=file.originalName||text(file.name||file.fileName||file.filename);
        file.name=renamed.name;
        file.documentReference=renamed.documentReference;
        file.documentReferenceType=renamed.documentReferenceType;
        stats.repaired++;
      }
    }catch(_){stats.failed++;}
  }
  stats.remaining=stats.found-stats.repaired;
  stats.done=apply&&stats.remaining===0&&stats.failed===0&&stats.invalid===0;
  return stats;
}

module.exports={DOCUMENT_CONTAINER,DOCUMENT_FIELDS,ROOT_COLLECTIONS,INLINE_FIELDS,normalizeEnvironment,extractInlinePayload,inlineCandidateStats,legacyDocumentInventory,storeInlineDocument,externalizeDocumentCollections,migrateLegacyDocuments,createDocumentContainer,ensureDocumentContainer,normalizeInlineDocumentName,normalizeInlineDocumentNameRobust,repairLegacyBlobDocumentNames};
