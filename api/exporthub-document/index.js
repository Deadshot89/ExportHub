'use strict';
const auth=require('../shared/fast-auth-store');
const {createBlobServiceClient}=require('../shared/blob-rest');
const {DOCUMENT_CONTAINER}=require('../shared/document-blob-store');

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function json(status,body,headers={}){return{status,headers:Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},headers),body:JSON.stringify(body)}}
function error(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.EXPORTHUB_STORAGE_CONNECTION||process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
function requestEnvironment(req){
 const h=req&&req.headers||{},host=lower(h['x-forwarded-host']||h['X-Forwarded-Host']||h['x-original-host']||h['X-Original-Host']||h.host||h.Host||''),query=lower(req&&req.query&&req.query.environment||'');
 const hostTest=/-testservice\./i.test(host),hostAzure=/\.azurestaticapps\.net(?:[:/]|$)/i.test(host),hostProd=hostAzure&&!hostTest;
 if(query&&query!=='production'&&query!=='testservice')throw error('ENVIRONMENT_INVALID','Unbekannte ExportHUB-Datenumgebung.',400);
 if(hostTest){if(query&&query!=='testservice')throw error('ENVIRONMENT_MISMATCH','Ein Testservice-Aufruf darf keine Produktionsdaten anfordern.',409);return'testservice'}
 if(hostProd){if(query&&query!=='production')throw error('ENVIRONMENT_MISMATCH','Die Produktionsseite darf keine Testservice-Daten anfordern.',409);return'production'}
 return query||'production';
}
function validBlobName(value){return /^rc1059\/(production|testservice)\/[a-f0-9]{2}\/[a-f0-9]{64}$/.test(text(value))}
function blobEnvironment(name){const m=text(name).match(/^rc1059\/(production|testservice)\//);return m?m[1]:''}
async function readBuffer(blob){const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));return{buffer:Buffer.concat(chunks),contentType:text(r.contentType)||'application/octet-stream'} }

module.exports=async function(context,req){
 try{
  if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'GET, OPTIONS','Cache-Control':'no-store'},body:''};return}
  if(req.method!=='GET'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'GET, OPTIONS'});return}
  await auth.validateSession(req);
  const environment=requestEnvironment(req),blobName=text(req&&req.query&&req.query.blob);
  if(!validBlobName(blobName))throw error('DOCUMENT_BLOB_INVALID','Dokumentreferenz ist ungültig.',400);
  if(blobEnvironment(blobName)!==environment)throw error('ENVIRONMENT_MISMATCH','Das Dokument gehört zu einer anderen ExportHUB-Datenumgebung.',409);
  const cs=connectionString();if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);
  const service=createBlobServiceClient(cs),container=service.getContainerClient(DOCUMENT_CONTAINER),blob=container.getBlockBlobClient(blobName),downloaded=await readBuffer(blob);
  context.res={status:200,headers:{'Content-Type':downloaded.contentType,'Content-Length':String(downloaded.buffer.length),'Cache-Control':'private, no-store','Content-Disposition':'inline; filename="document"','X-Content-Type-Options':'nosniff'},body:downloaded.buffer};
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('ExportHUB document API error',e&&e.code,e&&e.message)}catch(_){}
  context.res=json(Number(e&&e.status||e&&e.statusCode||500),{ok:false,code:e&&e.code||'SERVER_ERROR',message:e&&e.message||'Dokument konnte nicht geladen werden.'});
 }
};
