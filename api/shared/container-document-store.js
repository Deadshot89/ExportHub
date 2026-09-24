'use strict';
const referenceFolder=require('./reference-folder-upload');

const DOCUMENT_CONTAINER=process.env.EXPORTHUB_DOCUMENT_CONTAINER||'exporthub-documents';
const KINDS=Object.freeze({
  loaded:{label:'Geladener Container',prefix:'01_Geladener_Container'},
  number:{label:'Container-Nummer von innen',prefix:'02_Containernummer_Innen'},
  sealed:{label:'Versiegelter Container · Siegel/Kennzeichen/Papiere',prefix:'03_Versiegelt_Siegel_Kennzeichen_Papiere'}
});

function text(v){return String(v==null?'':v).trim()}
function normalizeEnvironment(v){return text(v).toLowerCase()==='testservice'?'testservice':'production'}
function safeRef(v){
 const out=text(v).toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,40);
 if(!out){const e=new Error('Sendungsreferenz fehlt.');e.code='REFERENCE_REQUIRED';e.status=400;throw e}
 return out;
}
function kindOf(v){
 const key=text(v).toLowerCase();
 if(!Object.prototype.hasOwnProperty.call(KINDS,key)){const e=new Error('Ungültige Containerfoto-Art.');e.code='CONTAINER_PHOTO_KIND_INVALID';e.status=400;throw e}
 return key;
}
function parseImage(dataUrl){
 const raw=String(dataUrl||''),m=raw.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
 if(!m){const e=new Error('Bitte ein gültiges Foto im Format JPEG, PNG oder WEBP aufnehmen.');e.code='CONTAINER_PHOTO_INVALID';e.status=400;throw e}
 const type=m[1].toLowerCase()==='jpg'?'jpeg':m[1].toLowerCase(),buffer=Buffer.from(m[2].replace(/\s+/g,''),'base64');
 if(buffer.length<1024){const e=new Error('Das Foto ist leer oder zu klein.');e.code='CONTAINER_PHOTO_EMPTY';e.status=400;throw e}
 if(buffer.length>4*1024*1024){const e=new Error('Das Foto ist zu groß. Maximal 4 MB pro Bild.');e.code='CONTAINER_PHOTO_TOO_LARGE';e.status=413;throw e}
 return{buffer,mimeType:'image/'+type,extension:type==='jpeg'?'jpg':type};
}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
function containerClient(){
 const cs=connectionString();
 if(!cs){const e=new Error('App-Einstellung EXPORTHUB_STORAGE_CONNECTION_STRING fehlt.');e.code='STORAGE_NOT_CONFIGURED';e.status=503;throw e}
 const {BlobServiceClient}=require('@azure/storage-blob');
 return BlobServiceClient.fromConnectionString(cs).getContainerClient(DOCUMENT_CONTAINER);
}
function fileName(reference,kind,extension){
 const ref=safeRef(reference),k=kindOf(kind),ext=text(extension).toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
 return KINDS[k].prefix+'_'+ref+'.'+ext;
}
function blobName(environment,reference,kind,extension){
 const env=normalizeEnvironment(environment),ref=safeRef(reference);
 return env+'/'+ref+'/Containerdokumentation/'+fileName(ref,kind,extension);
}
async function savePhoto({environment,reference,kind,dataUrl,shipmentId,subShipmentId}){
 const env=normalizeEnvironment(environment),ref=safeRef(reference),k=kindOf(kind),parsed=parseImage(dataUrl),container=containerClient();
 await container.createIfNotExists();
 const name=fileName(ref,k,parsed.extension),path=blobName(env,ref,k,parsed.extension),blob=container.getBlockBlobClient(path),iso=new Date().toISOString();
 await blob.uploadData(parsed.buffer,{
  blobHTTPHeaders:{blobContentType:parsed.mimeType,blobCacheControl:'private, no-store'},
  metadata:{reference:ref,kind:k,shipmentid:text(shipmentId).slice(0,120),subshipmentid:text(subShipmentId).slice(0,120),uploadedat:iso}
 });
 const referenceFile=await referenceFolder.upload(ref,name,parsed.buffer,parsed.mimeType);
 return{id:'container-'+k,kind:k,label:KINDS[k].label,name,type:parsed.mimeType,size:parsed.buffer.length,uploadedAt:iso,blobName:path,storage:'blob',reference:ref,referenceFolderSaved:true,referenceFolderItemId:text(referenceFile.id),referenceFolderPath:text(referenceFile.folderPath),referenceFolderWebUrl:text(referenceFile.webUrl)};
}
async function readPhoto(photo){
 const path=text(photo&&photo.blobName);
 if(!path){const e=new Error('Containerfoto besitzt keinen Speicherpfad.');e.code='CONTAINER_PHOTO_NOT_STORED';e.status=404;throw e}
 const container=containerClient(),blob=container.getBlobClient(path);
 try{
  const res=await blob.download(0),chunks=[];
  for await(const chunk of res.readableStreamBody)chunks.push(Buffer.from(chunk));
  return{buffer:Buffer.concat(chunks),contentType:text(res.contentType)||text(photo.type)||'image/jpeg'};
 }catch(e){
  if(Number(e&&e.statusCode||0)===404){const x=new Error('Containerfoto wurde im Speicher nicht gefunden.');x.code='CONTAINER_PHOTO_NOT_FOUND';x.status=404;throw x}
  throw e;
 }
}
function publicPhoto(photo){
 if(!photo||typeof photo!=='object')return null;
 return{id:text(photo.id),kind:text(photo.kind),label:text(photo.label)||KINDS[text(photo.kind)]&&KINDS[text(photo.kind)].label||'',name:text(photo.name),type:text(photo.type),size:Math.max(0,Number(photo.size)||0),uploadedAt:text(photo.uploadedAt),referenceFolderSaved:photo.referenceFolderSaved===true};
}
function completePhotos(list){
 const kinds=new Set((Array.isArray(list)?list:[]).map(x=>text(x&&x.kind).toLowerCase()).filter(Boolean));
 return Object.keys(KINDS).every(k=>kinds.has(k));
}
module.exports={DOCUMENT_CONTAINER,KINDS,text,normalizeEnvironment,safeRef,kindOf,parseImage,fileName,blobName,savePhoto,readPhoto,publicPhoto,completePhotos};
