'use strict';
const auth=require('../shared/fast-auth-store');
const {createBlobServiceClient}=require('../shared/blob-rest');
const {DOCUMENT_CONTAINER}=require('../shared/document-blob-store');
const apiI18n=require('../shared/i18n');
const crypto=require('crypto');
const POD_CONTAINER=process.env.EXPORTHUB_POD_CONTAINER||'exporthub-pod';
// RC1803: short-lived download tickets. Company web filters (Zscaler appends
// `_sm_nck=1`) answer a PDF download with a redirect. A background fetch with
// ExportHUB headers can never follow that redirect, so every Lieferschein
// failed with AZURE_ROUTE_BLOCKED. The browser now asks for a ticket (small
// JSON answer) and opens the ticket URL as a plain navigation that the
// filter can redirect and scan. The ticket binds one blob, one environment
// and a five-minute lifetime; it carries no session token.
const TICKET_TTL_MS=5*60*1000;

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function json(status,body,headers={}){return{status,headers:Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},headers),body:JSON.stringify(body)}}
function error(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.EXPORTHUB_STORAGE_CONNECTION||process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
function requestEnvironment(req){
 const h=req&&req.headers||{},host=lower(h['x-forwarded-host']||h['X-Forwarded-Host']||h['x-original-host']||h['X-Original-Host']||h.host||h.Host||''),query=lower(req&&req.query&&req.query.environment||'');
 const hostTest=/-testservice\./i.test(host),hostAzure=/\.azurestaticapps\.net(?:[:/]|$)/i.test(host);
 // Custom production domains are authoritative too: never let a query string
 // select TESTSERVICE from the production website's protected document API.
 const hostProd=(hostAzure&&!hostTest)||/^(?:www\.)?exporthub360\.(?:de|com)(?::\d+)?$/i.test(host);
 if(query&&query!=='production'&&query!=='testservice')throw error('ENVIRONMENT_INVALID',apiI18n.t(req,'api.common.environmentInvalid'),400);
 if(hostTest){if(query&&query!=='testservice')throw error('ENVIRONMENT_MISMATCH',apiI18n.t(req,'api.document.environmentMismatchTest'),409);return'testservice'}
 if(hostProd){if(query&&query!=='production')throw error('ENVIRONMENT_MISMATCH',apiI18n.t(req,'api.document.environmentMismatchProduction'),409);return'production'}
 return query||'production';
}
function validDocumentBlobName(value){return /^rc1059\/(production|testservice)\/[a-f0-9]{2}\/[a-f0-9]{64}$/.test(text(value))}
function validPickupPodBlobName(value){return /^rc995\/(production|testservice)\/[a-f0-9]{64}\/automatic\/[^/]+\.pdf$/i.test(text(value))}
function validBlobName(value){return validDocumentBlobName(value)||validPickupPodBlobName(value)}
function blobEnvironment(name){const m=text(name).match(/^rc(?:1059|995)\/(production|testservice)\//);return m?m[1]:''}
function ticketKey(){
 let source='';
 try{if(typeof auth.sessionSigningSecret==='function')source=auth.sessionSigningSecret().toString('hex')}catch(_){source=''}
 if(!source)source=connectionString();
 if(!source)throw error('STORAGE_NOT_CONFIGURED',apiI18n.t({},'api.common.storageNotConfigured'),503);
 return crypto.createHash('sha256').update('ExportHUB/document-ticket/v1|'+source).digest();
}
function ticketName(value){return text(value).replace(/[\u0000-\u001f\u007f"\\\/]+/g,'_').slice(0,120)}
function createTicket(blobName,environment,name,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({v:1,p:'exporthub-document',b:blobName,e:environment,n:ticketName(name),x:now+TICKET_TTL_MS}),'utf8').toString('base64url');
 return 'edt1.'+payload+'.'+crypto.createHmac('sha256',ticketKey()).update(payload).digest('base64url');
}
function readTicket(req,value,now=Date.now()){
 const parts=text(value).split('.');
 const invalid=()=>error('DOCUMENT_TICKET_INVALID',apiI18n.t(req,'api.document.ticketInvalid'),403);
 if(parts.length!==3||parts[0]!=='edt1'||!parts[1]||!parts[2])throw invalid();
 const expected=crypto.createHmac('sha256',ticketKey()).update(parts[1]).digest();
 let given;try{given=Buffer.from(parts[2],'base64url')}catch(_){throw invalid()}
 if(given.length!==expected.length||!crypto.timingSafeEqual(given,expected))throw invalid();
 let data;try{data=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'))}catch(_){throw invalid()}
 if(!data||data.v!==1||data.p!=='exporthub-document'||!validBlobName(data.b))throw invalid();
 if(!(Number(data.x)>now))throw error('DOCUMENT_TICKET_EXPIRED',apiI18n.t(req,'api.document.ticketExpired'),403);
 return{blobName:text(data.b),environment:text(data.e),name:text(data.n)};
}
function contentDisposition(name,download){
 const clean=ticketName(name)||'document.pdf',ascii=clean.replace(/[^\x20-\x7e]/g,'_');
 return (download?'attachment':'inline')+'; filename="'+ascii+'"; filename*=UTF-8\'\''+encodeURIComponent(clean);
}
async function readBuffer(blob){const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));return{buffer:Buffer.concat(chunks),contentType:text(r.contentType)||'application/octet-stream'} }

module.exports=async function(context,req){
 try{
  if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'GET, OPTIONS','Cache-Control':'no-store'},body:''};return}
  if(req.method!=='GET'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'GET, OPTIONS'});return}
  const query=req&&req.query||{},ticketValue=text(query.ticket);
  let ticket=null;
  // A ticket replaces the session header only for this one blob. Validate it
  // before the environment check so a forged ticket learns nothing else.
  if(ticketValue)ticket=readTicket(req,ticketValue);
  else await auth.validateSession(req);
  const environment=requestEnvironment(req),blobName=ticket?ticket.blobName:text(query.blob);
  if(!validBlobName(blobName))throw error('DOCUMENT_BLOB_INVALID',apiI18n.t(req,'api.document.referenceInvalid'),400);
  if(blobEnvironment(blobName)!==environment||(ticket&&ticket.environment!==environment))throw error('ENVIRONMENT_MISMATCH',apiI18n.t(req,'api.document.environmentMismatch'),409);
  const cs=connectionString();if(!cs)throw error('STORAGE_NOT_CONFIGURED',apiI18n.t(req,'api.common.storageNotConfigured'),503);
  if(!ticket&&lower(query.action)==='ticket'){
   const name=text(query.name),url='/api/exporthub-document?ticket='+encodeURIComponent(createTicket(blobName,environment,name));
   context.res=json(200,{ok:true,url,expiresInSeconds:TICKET_TTL_MS/1000});return;
  }
  const service=createBlobServiceClient(cs),containerName=validPickupPodBlobName(blobName)?POD_CONTAINER:DOCUMENT_CONTAINER,container=service.getContainerClient(containerName),blob=container.getBlockBlobClient(blobName),downloaded=await readBuffer(blob);
  const download=ticket&&text(query.download)==='1';
  // isRaw: like pickup-pod/container-document, the Functions host must send the
  // PDF bytes unchanged instead of serializing the Buffer body.
  context.res={status:200,isRaw:true,headers:{'Content-Type':downloaded.contentType,'Content-Length':String(downloaded.buffer.length),'Cache-Control':'private, no-store','Content-Disposition':ticket?contentDisposition(ticket.name,download):'inline; filename="document"','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'},body:downloaded.buffer};
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('ExportHUB document API error',e&&e.code,e&&e.message)}catch(_){}
  context.res=json(Number(e&&e.status||e&&e.statusCode||500),{ok:false,code:e&&e.code||'SERVER_ERROR',message:e&&e.message||apiI18n.t(req,'api.document.loadFailed')});
 }
};

module.exports.createTicket=createTicket;
module.exports.readTicket=readTicket;
