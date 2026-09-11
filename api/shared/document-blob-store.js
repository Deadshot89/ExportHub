'use strict';
const crypto=require('crypto');

const DOCUMENT_CONTAINER=process.env.EXPORTHUB_DOCUMENT_CONTAINER||'exporthub-documents';
const DOCUMENT_FIELDS=['deliveryFiles','deliveryNotesFiles','podFiles','abdFiles','documents','generatedDocuments','files','attachments','invoiceFiles','mailAttachments','lieferscheine'];
const ROOT_COLLECTIONS=['shipments','savedShipments','abdRequests'];
const INLINE_FIELDS=['data','payload','content','base64'];

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function normalizeEnvironment(value){return String(value||'').trim().toLowerCase()==='testservice'?'testservice':'production'}
function cleanMime(value){const v=String(value||'').trim().toLowerCase();return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(v)?v:'application/octet-stream'}
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
  const text=value.trim();
  const m=text.match(/^data:([^;,]+)?;base64,([A-Za-z0-9+/=\s]+)$/i);
  if(m){const buffer=base64Buffer(m[2]);if(buffer)return{buffer,mimeType:cleanMime(m[1]||file.mimeType||file.type),sourceField:key}}
  if(key==='base64'||key==='payload'||key==='content'){
   const buffer=base64Buffer(text);
   if(buffer)return{buffer,mimeType:cleanMime(file.mimeType||file.type),sourceField:key};
  }
 }
 return null;
}
function stripInlineFields(file){const out=clone(file)||{};for(const key of INLINE_FIELDS)delete out[key];return out}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
function createDocumentContainer(){
 const cs=connectionString();
 if(!cs){const e=new Error('App-Einstellung EXPORTHUB_STORAGE_CONNECTION_STRING fehlt.');e.code='STORAGE_NOT_CONFIGURED';e.status=503;throw e}
 const {BlobServiceClient}=require('@azure/storage-blob');
 return BlobServiceClient.fromConnectionString(cs).getContainerClient(DOCUMENT_CONTAINER);
}
async function uploadIdempotent(blob,buffer,mimeType,metadata){
 const options={blobHTTPHeaders:{blobContentType:mimeType,blobCacheControl:'private, no-store'},metadata,conditions:{ifNoneMatch:'*'}};
 try{
  if(typeof blob.uploadData==='function')return await blob.uploadData(buffer,options);
  return await blob.upload(buffer,buffer.length,options);
 }catch(e){
  if(Number(e&&e.statusCode||e&&e.status||0)===409||Number(e&&e.statusCode||e&&e.status||0)===412||/BlobAlreadyExists|ConditionNotMet/i.test(String(e&&e.code||'')))return{alreadyExists:true};
  throw e;
 }
}
async function storeInlineDocument(file,options={}){
 const parsed=extractInlinePayload(file);if(!parsed)return clone(file);
 const environment=normalizeEnvironment(options.environment),container=options.container||createDocumentContainer(),hash=crypto.createHash('sha256').update(parsed.buffer).digest('hex'),blobName=`rc1059/${environment}/${hash.slice(0,2)}/${hash}`,blob=container.getBlockBlobClient(blobName);
 await uploadIdempotent(blob,parsed.buffer,parsed.mimeType,{sha256:hash,environment,kind:'exporthub-document'});
 return Object.assign(stripInlineFields(file),{storage:'blob',blobName,sha256:hash,size:parsed.buffer.length,mimeType:parsed.mimeType});
}
async function externalizeDocumentCollections(state,options={}){
 const out=clone(state)||{},stats={externalized:0,inlineBytes:0,scanned:0};
 for(const root of ROOT_COLLECTIONS){
  const rows=Array.isArray(out[root])?out[root]:[];
  for(const row of rows){
   if(!row||typeof row!=='object')continue;
   for(const field of DOCUMENT_FIELDS){
    const files=Array.isArray(row[field])?row[field]:[];
    for(let i=0;i<files.length;i++){
     const parsed=extractInlinePayload(files[i]);stats.scanned++;
     if(!parsed)continue;
     const stored=await storeInlineDocument(files[i],options);
     files[i]=stored;stats.externalized++;stats.inlineBytes+=parsed.buffer.length;
    }
   }
  }
 }
 return{state:out,stats};
}

module.exports={DOCUMENT_CONTAINER,DOCUMENT_FIELDS,ROOT_COLLECTIONS,INLINE_FIELDS,normalizeEnvironment,extractInlinePayload,storeInlineDocument,externalizeDocumentCollections,createDocumentContainer};
