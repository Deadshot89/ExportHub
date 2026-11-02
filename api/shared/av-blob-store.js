'use strict';
// Independent, private Azure AV archive. Graph/OneDrive failures must not erase a
// valid uploaded AV or block its associated ExportHUB task.
const crypto=require('crypto');
const {BlobServiceClient}=require('@azure/storage-blob');
const CONTAINER=process.env.EXPORTHUB_DOCUMENT_CONTAINER||'exporthub-documents';
const MAX_FILES=500;
function text(value){return String(value==null?'':value).trim()}
function err(code,message,status=503){const e=new Error(message);e.code=code;e.status=status;return e}
function environment(value){return text(value).toLowerCase()==='testservice'?'testservice':'production'}
function refValue(value){const ref=text(value).toUpperCase();if(!/^[A-Z0-9]{6}$/.test(ref))throw err('INVALID_REFERENCE','Ungültige Sendungsreferenz.',400);return ref}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.EXPORTHUB_STORAGE_CONNECTION||process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
function client(){const cs=connectionString();if(!cs)throw err('STORAGE_NOT_CONFIGURED','Der ExportHUB-Dokumentenspeicher ist nicht konfiguriert.');return BlobServiceClient.fromConnectionString(cs).getContainerClient(CONTAINER)}
function prefix(ref,env){return 'av-v1/'+environment(env)+'/'+refValue(ref)+'/'}
function filename(name){const value=text(name);if(!value||value.length>180||/[\\/\r\n\x00-\x1f]/.test(value))throw err('AV_NAME_INVALID','Ungültiger AV-Dateiname.',400);return value}
function fileId(uuid){return 'avblob:'+uuid}
function idFromBlob(name,p){const n=name.slice(p.length);const m=n.match(/^([0-9a-f]{32})\//);return m?fileId(m[1]):''}
function fileFromBlob(blob,p){
 const id=idFromBlob(blob.name,p);if(!id)return null;
 const encoded=blob.name.slice(p.length+33);let name;
 try{name=decodeURIComponent(encoded)}catch(_){return null}
 if(!/^AV/i.test(name)||/^AVIS/i.test(name))return null;
 return{id,name,size:Number(blob.properties&&blob.properties.contentLength||0),mimeType:text(blob.properties&&blob.properties.contentType)||'application/octet-stream',createdDateTime:blob.properties&&blob.properties.createdOn||null,lastModifiedDateTime:blob.properties&&blob.properties.lastModified||null,storage:'azure-av',blobName:blob.name};
}
async function list(ref,env){
 const c=client(),p=prefix(ref,env),files=[];
 for await(const entry of c.listBlobsFlat({prefix:p})){
  const file=fileFromBlob(entry,p);
  if(!file)continue;
  if(files.length>=MAX_FILES)throw err('AV_ARCHIVE_LIMIT','Zu viele Ausgangsvermerke für eine vollständige Prüfung.');
  files.push(file);
 }
 return files;
}
async function save(ref,env,name,bytes,mimeType){
 const r=refValue(ref),n=filename(name),buffer=Buffer.from(bytes||[]);
 if(!buffer.length||buffer.length>15*1024*1024)throw err('AV_FILE_INVALID','Die AV-Datei ist leer oder zu groß.',400);
 const c=client();await c.createIfNotExists();
 const id=crypto.randomBytes(16).toString('hex'),blobName=prefix(r,env)+id+'/'+encodeURIComponent(n);
 const blob=c.getBlockBlobClient(blobName),hash=crypto.createHash('sha256').update(buffer).digest('hex');
 await blob.uploadData(buffer,{conditions:{ifNoneMatch:'*'},blobHTTPHeaders:{blobContentType:text(mimeType)||'application/octet-stream',blobCacheControl:'private, no-store'},metadata:{reference:r,environment:environment(env),kind:'av',sha256:hash}});
 // A server write is not accepted until bytes have independently round-tripped.
 const readback=Buffer.from(await blob.downloadToBuffer());
 if(readback.length!==buffer.length||crypto.createHash('sha256').update(readback).digest('hex')!==hash)
  throw err('AV_ARCHIVE_READBACK_FAILED','Der AV-Upload konnte im sicheren Dokumentenspeicher nicht bestätigt werden.',502);
 return{id:fileId(id),name:n,size:buffer.length,storage:'azure-av',blobName};
}
async function read(ref,env,id){
 if(!/^avblob:[0-9a-f]{32}$/.test(text(id)))throw err('AV_FILE_INVALID','Ungültige AV-Dateikennung.',400);
 const files=await list(ref,env),file=files.find(f=>f.id===id);
 if(!file)throw err('AV_FILE_NOT_FOUND','Ausgangsvermerk in dieser Sendung nicht gefunden.',404);
 const blob=client().getBlockBlobClient(file.blobName),bytes=Buffer.from(await blob.downloadToBuffer());
 if(bytes.length!==file.size)throw err('AV_FILE_READBACK_FAILED','Die gespeicherte AV-Datei ist unvollständig.',502);
 return{file,buffer:bytes};
}
module.exports={save,list,read,connectionString,refValue};
