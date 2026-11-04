'use strict';
const {BlobServiceClient}=require('@azure/storage-blob');
const auth=require('../shared/auth-store');
const apiI18n=require('../shared/i18n');
const {isolationConfig}=require('../shared/testservice-auth-isolation');
const model=require('../shared/urgent-orders');
const MAX_RETRIES=8;
const PROD_BLOB='urgent-orders/v1.json';
const TEST_BLOB='testservice/urgent-orders/v1.json';

function json(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)};}
function empty(){return{schemaVersion:1,updatedAt:null,orders:[],profiles:{},reporterGroups:[]};}
function normalize(doc){const d=doc&&typeof doc==='object'?doc:empty();d.orders=Array.isArray(d.orders)?d.orders:[];d.profiles=d.profiles&&typeof d.profiles==='object'&&!Array.isArray(d.profiles)?d.profiles:{};d.reporterGroups=Array.isArray(d.reporterGroups)?d.reporterGroups:[];return d;}
function publicSiteEnvironment(url){
 try{
  const raw=String(url||'').trim();
  if(!raw)return'';
  const value=new URL(/^[a-z]+:\/\//i.test(raw)?raw:'https://'+raw);
  const hostname=value.hostname.toLowerCase();
  if(hostname.endsWith('.azurestaticapps.net'))return hostname.includes('-testservice.')?'testservice':'production';
  if(hostname==='exporthub360.com'||hostname==='www.exporthub360.com'||hostname==='exporthub360.de'||hostname==='www.exporthub360.de')return'production';
 }catch(_){}
 return'';
}
function storage(req){
 const h=req&&req.headers||{};
 const direct=publicSiteEnvironment(h.host||h.Host||'');
 const forwarded=publicSiteEnvironment(h['x-forwarded-host']||h['X-Forwarded-Host']||h['x-original-host']||'');
 const site=publicSiteEnvironment(h.origin||h.Origin||h.referer||h.Referer||'');
 // Do not let an unauthenticated browser-supplied Origin or an X-ExportHUB-Environment
 // select a production/test blob when Azure's genuine Host is not identifiable.
 if(!direct&&!forwarded)throw model.problem('URGENT_HOST_UNTRUSTED','The deployment host could not be verified; urgent order storage is blocked.',503);
 if(direct&&forwarded&&direct!==forwarded)
  throw model.problem('URGENT_ENVIRONMENT_MISMATCH','The deployment host values disagree.',409);
 const environment=direct||forwarded;
 if(site&&site!==environment)
  throw model.problem('URGENT_ENVIRONMENT_MISMATCH','The urgent order origin does not match the deployment host.',409);
 const detected=auth.environmentFromRequest(req);
 if(detected!==environment)
  throw model.problem('URGENT_ENVIRONMENT_MISMATCH','The requested environment conflicts with the deployment host.',409);
 const isolated=environment==='testservice'?isolationConfig():{enabled:false};
 const configured=isolated.enabled?isolated.connectionString:(process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.EXPORTHUB_STORAGE_CONNECTION||process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||'');
 if(!configured)throw model.problem('URGENT_STORAGE_MISSING','Azure-Speicherung für Urgent Orders ist nicht konfiguriert.',503);
 const service=BlobServiceClient.fromConnectionString(configured);
 const container=service.getContainerClient(isolated.enabled?isolated.container:(process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data'));
 return{blob:container.getBlockBlobClient(environment==='testservice'?TEST_BLOB:PROD_BLOB),environment};
}
async function write(storageRef,mutator){
 for(let attempt=0;attempt<MAX_RETRIES;attempt++){
  const doc=await auth.readJson(storageRef.blob,empty()),state=normalize(doc.value),result=mutator(state);
  state.updatedAt=new Date().toISOString();
  try{
   const response=await auth.writeJson(storageRef.blob,state,doc.etag);
   if(!response||!response.etag)throw model.problem('URGENT_WRITE_UNVERIFIED','Der Speichervorgang wurde nicht bestätigt. Bitte die Übersicht neu laden.',503);
   return result;
  }catch(e){if(Number(e&&e.statusCode)===412&&attempt<MAX_RETRIES-1)continue;throw e;}
 }
 throw model.problem('URGENT_CONCURRENT_UPDATE','Gleichzeitige Änderung. Bitte erneut versuchen.',409);
}
function identity(user){return{id:model.text(user&&user.id,150),name:model.text(user&&(user.name||user.user||user.login),150)};}
function requestBody(req){return auth.body(req);}
function findOrder(doc,id){const order=doc.orders.find(x=>x.id===id);if(!order)throw model.problem('URGENT_NOT_FOUND','Auftrag nicht gefunden.',404);return order;}
function visibleOrders(doc,user){return doc.orders.filter(x=>model.canRead(x,user)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));}
function accessibleOrder(doc,id,user){const order=findOrder(doc,id);if(!model.canRead(order,user))throw model.problem('URGENT_FORBIDDEN','Kein Zugriff auf diesen Auftrag.',403);return order;}
async function execute(req,user,refs){
 const p=requestBody(req),action=model.text(p.action||'list',40),now=new Date().toISOString();
 if(action==='list'){
  const doc=normalize((await auth.readJson(refs.blob,empty())).value);
  return{orders:visibleOrders(doc,user),profile:doc.profiles[model.text(user.id)]||null,canManage:model.canManage(user),environment:refs.environment};
 }
 if(action==='create'){
  const created=model.createOrder(p,identity(user),now);
  return write(refs,doc=>{
   const previous=doc.orders.find(x=>x.orderNumber===created.orderNumber);
   if(previous)throw model.problem('URGENT_ORDER_EXISTS','Diese SO-Nummer ist bereits gemeldet. Bitte die vorhandenen Positionen prüfen.',409);
   doc.orders.push(created);
   doc.profiles[model.text(user.id)]={email:created.email,language:created.language,updatedAt:now,verified:false};
   return{order:created,profile:doc.profiles[model.text(user.id)],environment:refs.environment};
  });
 }
 if(action==='save-profile'){
  const address=model.email(p.email),language=model.language(p.language),key=model.text(user.id);
  return write(refs,doc=>{doc.profiles[key]={email:address,language,updatedAt:now,verified:false};return{profile:doc.profiles[key]};});
 }
 if(action==='update-status'){
  if(!model.canManage(user))throw model.problem('URGENT_FORBIDDEN','Statusänderungen sind ausschließlich für die Logistik möglich.',403);
  const id=model.text(p.id,90),itemId=model.text(p.itemId,90),status=model.text(p.status,30);
  return write(refs,doc=>{
   const order=findOrder(doc,id);
   model.setItemStatus(order,itemId,status,user,now,model.text(p.note,1000));
   return{order};
  });
 }
 if(action==='prepare-mail'){
  if(!model.canManage(user))throw model.problem('URGENT_FORBIDDEN','Nur die Logistik darf E-Mails vorbereiten.',403);
  const doc=normalize((await auth.readJson(refs.blob,empty())).value),order=accessibleOrder(doc,model.text(p.id,90),user);
  return{draft:model.draftMail(order,model.text(p.kind,30),model.language(p.language||order.language),p.note),orderId:order.id};
 }
 throw model.problem('URGENT_ACTION_UNKNOWN','Unbekannte Urgent-Order-Aktion.');
}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return;}
 if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'});return;}
 try{
  const current=await auth.validateSession(req);
  const ref=storage(req);
  const result=await execute(req,current.user,ref);
  context.res=json(200,{ok:true,...result});
 }catch(e){
  const status=Number(e&&e.status||e&&e.statusCode)||500;
  context.log&&context.log.warn&&context.log.warn('urgent-orders',e&&e.code||'UNEXPECTED',status);
  context.res=json(status,{ok:false,code:e&&e.code||'URGENT_ERROR',message:status>=500?apiI18n.t(req,'api.urgent.serverError'):e&&e.message||apiI18n.t(req,'api.urgent.invalidRequest')});
 }
};
module.exports.execute=execute;
module.exports.storage=storage;
module.exports.readDocument=async function(refs){return normalize((await auth.readJson(refs.blob,empty())).value);};
module.exports.write=write;
module.exports.empty=empty;
module.exports.normalize=normalize;
