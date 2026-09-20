'use strict';

const crypto=require('crypto');
const CONTAINER=process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data';
const BASE_BLOB=process.env.EXPORTHUB_CUSTOMER_PORTAL_BLOB||'customer-portal-credentials.json';
const MAX_RETRIES=6;

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function now(){return new Date().toISOString()}
function error(code,message,status=400){const e=new Error(message||code);e.code=code;e.status=status;e.statusCode=status;return e}
function environment(v){return lower(v)==='testservice'?'testservice':'production'}
function blobName(env){return environment(env)==='testservice'?'testservice/'+BASE_BLOB.replace(/^\/+/, ''):BASE_BLOB.replace(/^\/+/, '')}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
function keyConfigured(){return text(process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY).length>=32}
function key(){
 const configured=text(process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY);
 if(!keyConfigured())throw error('CUSTOMER_PORTAL_KEY_NOT_CONFIGURED','Kundenportal-Verschlüsselung ist serverseitig nicht konfiguriert.',503);
 return crypto.createHash('sha256').update('ExportHUB/customer-portal/v1|'+configured).digest();
}
function encryptSecret(value,secretKey){
 const plain=Buffer.from(String(value==null?'':value),'utf8'),iv=crypto.randomBytes(12),k=secretKey||key();
 const cipher=crypto.createCipheriv('aes-256-gcm',k,iv),ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]),tag=cipher.getAuthTag();
 return{v:1,alg:'aes-256-gcm',iv:iv.toString('base64url'),tag:tag.toString('base64url'),ciphertext:ciphertext.toString('base64url')};
}
function decryptSecret(value,secretKey){
 try{
  if(!value||value.v!==1||value.alg!=='aes-256-gcm')throw new Error('format');
  const decipher=crypto.createDecipheriv('aes-256-gcm',secretKey||key(),Buffer.from(value.iv,'base64url'));
  decipher.setAuthTag(Buffer.from(value.tag,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext,'base64url')),decipher.final()]).toString('utf8');
 }catch(cause){throw error('SECRET_DECRYPT_FAILED','Gespeicherte Kundenportal-Zugangsdaten konnten nicht sicher entschlüsselt werden.',500)}
}
function customerKey(v){const k=text(v);if(!k||k.length>120)throw error('CUSTOMER_ID_INVALID','Kunde besitzt keine gültige Kennung.',400);return k}
function portalId(){return'PORTAL-'+crypto.randomBytes(12).toString('hex')}
function cleanUrl(v){
 const raw=text(v);let u;try{u=new URL(raw)}catch(_){throw error('PORTAL_URL_INVALID','Bitte eine gültige HTTPS-Adresse für das Kundenportal angeben.',400)}
 if(u.protocol!=='https:')throw error('PORTAL_URL_INVALID','Kundenportal-Adressen müssen HTTPS verwenden.',400);
 u.username='';u.password='';return u.toString();
}
function cleanPortalInput(input,existing){
 const src=input&&typeof input==='object'?input:{},old=existing||{};
 const name=text(src.name!==undefined?src.name:old.name).slice(0,120);
 const url=cleanUrl(src.url!==undefined?src.url:old.url);
 if(!name)throw error('PORTAL_NAME_REQUIRED','Portalname fehlt.',400);
 const note=text(src.note!==undefined?src.note:old.note).slice(0,500);
 return{name,url,note,active:src.active===undefined?old.active!==false:src.active!==false};
}
function metadata(row){
 return{id:text(row&&row.id),name:text(row&&row.name),url:text(row&&row.url),note:text(row&&row.note),active:row&&row.active!==false,
  hasUsername:!!(row&&row.usernameEncrypted&&row.usernameEncrypted.ciphertext),hasPassword:!!(row&&row.passwordEncrypted&&row.passwordEncrypted.ciphertext),
  createdAt:row&&row.createdAt||null,createdBy:text(row&&row.createdBy),updatedAt:row&&row.updatedAt||null,updatedBy:text(row&&row.updatedBy)};
}
function empty(){return{schemaVersion:1,updatedAt:null,customers:{}}}
async function client(env){
 const {BlobServiceClient}=require('@azure/storage-blob');
 const cs=connectionString();if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);
 const service=BlobServiceClient.fromConnectionString(cs),container=service.getContainerClient(CONTAINER);
 return container.getBlockBlobClient(blobName(env));
}
async function read(blob){
 try{
  const res=await blob.download(0),chunks=[];for await(const c of res.readableStreamBody)chunks.push(Buffer.from(c));
  const raw=Buffer.concat(chunks).toString('utf8').trim(),value=raw?JSON.parse(raw):empty();
  if(!value.customers||typeof value.customers!=='object'||Array.isArray(value.customers))value.customers={};
  return{value,etag:res.etag||null};
 }catch(e){if(e&&e.statusCode===404)return{value:empty(),etag:null};throw e}
}
async function write(blob,value,etag){
 const raw=JSON.stringify(value);return blob.upload(raw,Buffer.byteLength(raw),{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8',blobCacheControl:'no-store'},conditions:etag?{ifMatch:etag}:{ifNoneMatch:'*'}});
}
async function mutate(env,fn){
 const blob=await client(env);
 for(let i=0;i<MAX_RETRIES;i++){
  const current=await read(blob),doc=current.value||empty(),result=await fn(doc);
  doc.schemaVersion=1;doc.updatedAt=now();
  try{await write(blob,doc,current.etag);return result}catch(e){if(e&&e.statusCode===412&&i<MAX_RETRIES-1)continue;throw e}
 }
 throw error('CONCURRENT_UPDATE','Kundenportal-Daten wurden parallel geändert. Bitte erneut versuchen.',409);
}
async function listMetadata(env,customerId){
 const blob=await client(env),doc=(await read(blob)).value,k=customerKey(customerId);
 return(Array.isArray(doc.customers[k])?doc.customers[k]:[]).map(metadata);
}
async function create(env,customerId,input,actor){
 const k=customerKey(customerId),username=text(input&&input.username),password=String(input&&input.password||'');
 if(!password)throw error('PORTAL_PASSWORD_REQUIRED','Portalpasswort fehlt.',400);
 return mutate(env,doc=>{
  const base=cleanPortalInput(input),stamp=now(),row={id:portalId(),...base,
   usernameEncrypted:encryptSecret(username),passwordEncrypted:encryptSecret(password),
   createdAt:stamp,createdBy:text(actor)||'System',updatedAt:stamp,updatedBy:text(actor)||'System'};
  const list=Array.isArray(doc.customers[k])?doc.customers[k]:[];list.push(row);doc.customers[k]=list;return metadata(row);
 });
}
async function update(env,customerId,id,input,actor){
 const k=customerKey(customerId),pid=text(id);if(!pid)throw error('PORTAL_ID_REQUIRED','Portal-ID fehlt.',400);
 return mutate(env,doc=>{
  const list=Array.isArray(doc.customers[k])?doc.customers[k]:[],row=list.find(x=>text(x&&x.id)===pid);
  if(!row)throw error('PORTAL_NOT_FOUND','Kundenportal wurde nicht gefunden.',404);
  Object.assign(row,cleanPortalInput(input,row));
  if(input&&Object.prototype.hasOwnProperty.call(input,'username')&&String(input.username)!=='')row.usernameEncrypted=encryptSecret(text(input.username));
  if(input&&Object.prototype.hasOwnProperty.call(input,'password')&&String(input.password)!=='')row.passwordEncrypted=encryptSecret(String(input.password));
  row.updatedAt=now();row.updatedBy=text(actor)||'System';return metadata(row);
 });
}
async function remove(env,customerId,id){
 const k=customerKey(customerId),pid=text(id);if(!pid)throw error('PORTAL_ID_REQUIRED','Portal-ID fehlt.',400);
 return mutate(env,doc=>{
  const list=Array.isArray(doc.customers[k])?doc.customers[k]:[],idx=list.findIndex(x=>text(x&&x.id)===pid);
  if(idx<0)throw error('PORTAL_NOT_FOUND','Kundenportal wurde nicht gefunden.',404);
  const row=list[idx];list.splice(idx,1);if(list.length)doc.customers[k]=list;else delete doc.customers[k];return metadata(row);
 });
}
async function reveal(env,customerId,id){
 const blob=await client(env),doc=(await read(blob)).value,k=customerKey(customerId),pid=text(id),list=Array.isArray(doc.customers[k])?doc.customers[k]:[];
 const row=list.find(x=>text(x&&x.id)===pid);if(!row)throw error('PORTAL_NOT_FOUND','Kundenportal wurde nicht gefunden.',404);
 return{portal:metadata(row),username:decryptSecret(row.usernameEncrypted),password:decryptSecret(row.passwordEncrypted)};
}
module.exports={error,environment,blobName,keyConfigured,encryptSecret,decryptSecret,metadata,cleanUrl,cleanPortalInput,listMetadata,create,update,remove,reveal};
