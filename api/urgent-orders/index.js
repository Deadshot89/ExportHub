'use strict';
const {BlobServiceClient}=require('@azure/storage-blob');
const auth=require('../shared/auth-store');
const fs=require('node:fs');
const path=require('node:path');
const apiI18n=require('../shared/i18n');
const {isolationConfig}=require('../shared/testservice-auth-isolation');
const model=require('../shared/urgent-orders');
const packing=require('../shared/urgent-packing');
const mailTranslation=require('../shared/urgent-mail-translation');
const {isTransientStorageWriteError:isTransientStorageError}=require('../shared/state-save-retry');
const MAX_RETRIES=8;
// Read-only storage calls (session check, list, counts) may be repeated after
// a short network/Azure hiccup. Writes are never repeated by this helper.
const READ_RETRY_DELAYS_MS=[150,450];
const PROD_BLOB='urgent-orders/v1.json';
const TEST_BLOB='testservice/urgent-orders/v1.json';
const PROD_PACKING_BLOB='urgent-orders/packing-catalog-v1.json';
const TEST_PACKING_BLOB='testservice/urgent-orders/packing-catalog-v1.json';

function json(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)};}
function empty(){return{schemaVersion:1,updatedAt:null,orders:[],profiles:{},reporterGroups:[]};}
function normalize(doc){const d=doc&&typeof doc==='object'?doc:empty();d.orders=Array.isArray(d.orders)?d.orders:[];d.profiles=d.profiles&&typeof d.profiles==='object'&&!Array.isArray(d.profiles)?d.profiles:{};d.reporterGroups=Array.isArray(d.reporterGroups)?d.reporterGroups:[];return d;}
function publicSiteEnvironment(url){
 try{
  const raw=String(url||'').split(',')[0].trim();
  if(!raw)return'';
  const value=new URL(/^[a-z]+:\/\//i.test(raw)?raw:'https://'+raw);
  const hostname=value.hostname.toLowerCase();
  // Only the designated Urgent Order production site may select production data.
  // Unknown Azure PR/preview hosts must never silently become production.
  if(hostname==='wonderful-forest-0f315e310.7.azurestaticapps.net')return'production';
  if(hostname.endsWith('.azurestaticapps.net')&&hostname.includes('-testservice.'))return'testservice';
  if(hostname==='exporthub360.com'||hostname==='www.exporthub360.com'||hostname==='exporthub360.de'||hostname==='www.exporthub360.de')return'production';
 }catch(_){}
 return'';
}
// Release metadata is produced by the deployment pipeline, stored on the
// Azure Functions filesystem, and verified by exporthub-health. Unlike Origin
// or X-Forwarded-Host it cannot be supplied by an anonymous browser request.
function deploymentEnv(metadata){
 if(!metadata||!(/^[0-9a-f]{40}$/i.test(String(metadata.buildId||''))))return'';
 if(!['testservice','production'].includes(metadata.environment)||!metadata.visibleRelease||!metadata.technicalBuild||!metadata.builtAt)return'';
 return metadata.environment;
}
function serverDeploymentEnvironment(){
 // Use the same verified file/runtime sources as /api/exporthub-health.
 // Azure's managed Functions proxy often supplies its internal worker Host
 // rather than the browser-facing azurestaticapps.net hostname.
 let fromFile='';
 try{
  const location=process.env.EXPORTHUB_RELEASE_METADATA_PATH?path.resolve(process.env.EXPORTHUB_RELEASE_METADATA_PATH):path.join(__dirname,'..','release-metadata.json');
  fromFile=deploymentEnv(JSON.parse(fs.readFileSync(location,'utf8')));
 }catch(_){}
 const fromRuntime=deploymentEnv({
  buildId:process.env.EXPORTHUB_DEPLOY_BUILD_ID,
  visibleRelease:process.env.EXPORTHUB_DEPLOY_VISIBLE_RELEASE,
  technicalBuild:process.env.EXPORTHUB_DEPLOY_TECHNICAL_BUILD,
  builtAt:process.env.EXPORTHUB_DEPLOY_BUILT_AT,
  environment:process.env.EXPORTHUB_DEPLOY_ENVIRONMENT
 });
 // Inconsistent server-side deployment identities must fail closed.
 if(fromFile&&fromRuntime&&fromFile!==fromRuntime)return'';
 return fromFile||fromRuntime||'';
}
function isAzureInternalWorkerHost(value){
 try{
  const raw=String(value||'').split(',')[0].trim();
  if(!raw)return false;
  const hostname=new URL(/^[a-z]+:\/\//i.test(raw)?raw:'https://'+raw).hostname.toLowerCase();
  return hostname.endsWith('.azurewebsites.net');
 }catch(_){return false;}
}
// Prevent an untrusted SWA preview deployment from accessing production data,
// even when forwarding headers or Origin imitate the official site.
function unknownStaticWebAppHost(url){
 try{
  const raw=String(url||'').split(',')[0].trim();
  if(!raw)return false;
  const hostname=new URL(/^[a-z]+:\/\//i.test(raw)?raw:'https://'+raw).hostname.toLowerCase();
  return hostname.endsWith('.azurestaticapps.net')&&!publicSiteEnvironment(raw);
 }catch(_){return false;}
}

// RC1876: Host diagnostics reveal only categories, never token, username, host or path.
// The verified release identity remains mandatory for internal Azure worker requests.
function safeHostClass(value){
 try{
  const raw=String(value||'').split(',')[0].trim();
  if(!raw)return'absent';
  const host=new URL(/^[a-z]+:\/\//i.test(raw)?raw:'https://'+raw).hostname.toLowerCase();
  if(host==='wonderful-forest-0f315e310.7.azurestaticapps.net')return'canonical-production';
  if(host==='exporthub360.com'||host==='www.exporthub360.com'||host==='exporthub360.de'||host==='www.exporthub360.de')return'legacy-production';
  if(host.endsWith('.azurestaticapps.net')&&host.includes('-testservice.'))return'testservice';
  if(host.endsWith('.azurestaticapps.net'))return'untrusted-preview';
  if(host.endsWith('.azurewebsites.net'))return'azure-functions-worker';
  return'other'
 }catch(_){return'invalid'}
}
function safeHostDiagnostic(req){
 const h=req&&req.headers||{};
 return {
  direct:safeHostClass(h.host||h.Host||''),
  forwarded:safeHostClass(h['x-forwarded-host']||h['X-Forwarded-Host']||h['x-original-host']||''),
  origin:safeHostClass(h.origin||h.Origin||h.referer||h.Referer||''),
  verifiedDeployment:serverDeploymentEnvironment()||'missing'
 }
}
function resolveStorageEnvironment(req,serverEnvironment=serverDeploymentEnvironment()){
 const h=req&&req.headers||{};
 const direct=publicSiteEnvironment(h.host||h.Host||'');
 const forwarded=publicSiteEnvironment(h['x-forwarded-host']||h['X-Forwarded-Host']||h['x-original-host']||'');
 const site=publicSiteEnvironment(h.origin||h.Origin||h.referer||h.Referer||'');
 const requested=String(h['x-exporthub-environment']||h['X-ExportHUB-Environment']||'').toLowerCase().trim();
 if(direct&&forwarded&&direct!==forwarded)
  throw model.problem('URGENT_ENVIRONMENT_MISMATCH','The deployment host values disagree.',409);
 // Accept Azure's internal Functions worker Host only when server-side
 // release metadata unequivocally names the deployed environment.
 // Browser Origin, Referer and X-ExportHUB-Environment never grant access.
 if(unknownStaticWebAppHost(h.host||h.Host||'')||
    unknownStaticWebAppHost(h['x-forwarded-host']||h['X-Forwarded-Host']||h['x-original-host']||'')||
    unknownStaticWebAppHost(h.origin||h.Origin||h.referer||h.Referer||'')||
    (!direct&&!forwarded&&(!serverEnvironment||!isAzureInternalWorkerHost(h.host||h.Host||''))))
  throw model.problem('URGENT_HOST_UNTRUSTED','The deployment host could not be verified; urgent order storage is blocked.',503);
 const environment=direct||forwarded||serverEnvironment;
 if(site&&site!==environment)
  throw model.problem('URGENT_ENVIRONMENT_MISMATCH','The urgent order origin does not match the deployment.',409);
 if(requested&&requested!==environment)
  throw model.problem('URGENT_ENVIRONMENT_MISMATCH','The requested environment conflicts with the deployment.',409);
 if(serverEnvironment&&serverEnvironment!==environment)
  throw model.problem('URGENT_ENVIRONMENT_MISMATCH','Verified deployment and request host disagree.',409);
 // Original legacy host contract stays intact whenever a public Host exists.
 if((direct||forwarded)&&auth.environmentFromRequest(req)!==environment)
  throw model.problem('URGENT_ENVIRONMENT_MISMATCH','The requested environment conflicts with the deployment host.',409);
 return environment;
}
function storage(req){
 const environment=resolveStorageEnvironment(req);
 const isolated=environment==='testservice'?isolationConfig():{enabled:false};
 const configured=isolated.enabled?isolated.connectionString:(process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.EXPORTHUB_STORAGE_CONNECTION||process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||'');
 if(!configured)throw model.problem('URGENT_STORAGE_MISSING','Azure-Speicherung für Urgent Orders ist nicht konfiguriert.',503);
 const service=BlobServiceClient.fromConnectionString(configured);
 const container=service.getContainerClient(isolated.enabled?isolated.container:(process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data'));
 return{blob:container.getBlockBlobClient(environment==='testservice'?TEST_BLOB:PROD_BLOB),
  catalogBlob:container.getBlockBlobClient(environment==='testservice'?TEST_PACKING_BLOB:PROD_PACKING_BLOB),environment};
}
async function write(storageRef,mutator){
 for(let attempt=0;attempt<MAX_RETRIES;attempt++){
  const doc=await readDoc(storageRef),state=normalize(doc.value),result=mutator(state);
  state.updatedAt=new Date().toISOString();
  try{
   const response=await auth.writeJson(storageRef.blob,state,doc.etag);
   if(!response||!response.etag)throw model.problem('URGENT_WRITE_UNVERIFIED','Der Speichervorgang wurde nicht bestätigt. Bitte die Übersicht neu laden.',503);
   return result;
  }catch(e){if(Number(e&&e.statusCode)===412&&attempt<MAX_RETRIES-1)continue;throw e;}
 }
 throw model.problem('URGENT_CONCURRENT_UPDATE','Gleichzeitige Änderung. Bitte erneut versuchen.',409);
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function withReadRetry(read){
 for(let attempt=0;;attempt++){
  try{return await read();}
  catch(e){
   // Our own problems (401/403/404/409/503 ...) carry e.status and are final.
   if(e&&e.status||!isTransientStorageError(e)||attempt>=READ_RETRY_DELAYS_MS.length)throw e;
   await sleep(READ_RETRY_DELAYS_MS[attempt]);
  }
 }
}
function readDoc(refs){return withReadRetry(()=>auth.readJson(refs.blob,empty(),{missingBlobOnly:true}));}
async function readPackingCatalog(refs){
 if(!refs.catalogBlob)return {schemaVersion:1,count:0,unknownPackSize:0,quantities:{}}; // unit tests with mocked refs
 const data=await withReadRetry(()=>auth.readJson(refs.catalogBlob,{schemaVersion:1,count:0,unknownPackSize:0,quantities:{}},{missingBlobOnly:true}));
 const catalog=data.value||{};
 if(!catalog.quantities||typeof catalog.quantities!=='object'||Array.isArray(catalog.quantities))
  throw model.problem('URGENT_PACKING_CATALOG_INVALID','Die Verpackungsgrößen sind beschädigt. Bitte die Logistik informieren.',503);
 return catalog;
}
function canImportCatalog(user){
 if(user&&user.globalAdmin===true)return true;
 const rights=user&&user.rights&&user.rights.shipmentoverview||{};
 return rights.admin===true||rights.functionAdmin===true||String(rights.level||rights.access||'').toLowerCase()==='admin';
}
// Only codes/names, never messages: storage messages may contain account details.
function safeCode(value){const v=String(value==null?'':value);return /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(v)?v:'';}
function failureDetails(e){
 return [safeCode(e&&e.code),safeCode(e&&e.name),Number(e&&e.statusCode)||'',safeCode(e&&e.cause&&e.cause.code)].filter(Boolean).join('/')||'UNEXPECTED';
}
function identity(user){return{id:model.text(user&&user.id,150),name:model.text(user&&(user.name||user.user||user.login),150)};}
function requestBody(req){return auth.body(req);}
function findOrder(doc,id){const order=doc.orders.find(x=>x.id===id);if(!order)throw model.problem('URGENT_NOT_FOUND','Auftrag nicht gefunden.',404);return order;}
function visibleOrders(doc,user){return doc.orders.filter(x=>model.canRead(x,user)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));}
function accessibleOrder(doc,id,user){const order=findOrder(doc,id);if(!model.canRead(order,user))throw model.problem('URGENT_FORBIDDEN','Kein Zugriff auf diesen Auftrag.',403);return order;}
async function execute(req,user,refs){
 const p=requestBody(req),action=model.text(p.action||'list',40),now=new Date().toISOString();
 if(action==='list'){
  const doc=normalize((await readDoc(refs)).value);
  // Account-linked email profiles are deprecated; only the local browser's
  // non-authenticated address history supplies autocomplete suggestions.
  return{orders:visibleOrders(doc,user),canManage:model.canManage(user),canImportPackingCatalog:canImportCatalog(user),environment:refs.environment};
 }
 if(action==='counts'){
  // Return only authorized aggregate values. Menu polling must never transfer
  // private order lines, reporter emails or exception notes.
  const doc=normalize((await readDoc(refs)).value);
  let open=0,closed=0;
  for(const order of doc.orders){
   if(!model.canRead(order,user))continue;
   if(model.isClosed(order))closed++;else open++;
  }
  return{open,closed,total:open+closed,environment:refs.environment};
 }
 if(action==='packing-catalog-status'){
  if(!canImportCatalog(user))throw model.problem('URGENT_FORBIDDEN','Keine Berechtigung zur Artikelstammdatenverwaltung.',403);
  const catalog=await readPackingCatalog(refs);
  return{count:catalog.count||0,unknownPackSize:catalog.unknownPackSize||0,environment:refs.environment};
 }
 if(action==='import-packing-catalog'){
  if(!canImportCatalog(user))throw model.problem('URGENT_FORBIDDEN','Keine Berechtigung zur Artikelstammdatenverwaltung.',403);
  if(!refs.catalogBlob)throw model.problem('URGENT_PACKING_STORAGE_MISSING','Der private Artikeldatenspeicher ist nicht erreichbar.',503);
  const catalog=packing.parseCatalog(p.tsv);
  const current=await withReadRetry(()=>auth.readJson(refs.catalogBlob,{schemaVersion:1,quantities:{}},{missingBlobOnly:true}));
  catalog.importedAt=now;
  const saved=await auth.writeJson(refs.catalogBlob,catalog,current.etag);
  if(!saved||!saved.etag)throw model.problem('URGENT_PACKING_WRITE_UNVERIFIED','Die Artikelliste wurde nicht bestätigt. Bitte nicht als aktiv betrachten.',503);
  const readback=await readPackingCatalog(refs);
  if(readback.count!==catalog.count||readback.importedAt!==catalog.importedAt)
   throw model.problem('URGENT_PACKING_READBACK_FAILED','Die gespeicherte Artikelliste konnte nicht bestätigt werden.',503);
  return{count:catalog.count,unknownPackSize:catalog.unknownPackSize,environment:refs.environment};
 }
 if(action==='create'){
  const catalog=p.allLines===true?null:await readPackingCatalog(refs);
  const created=model.createOrder(p,identity(user),now,catalog);
  return write(refs,doc=>{
   const previous=doc.orders.find(x=>x.orderNumber===created.orderNumber);
   if(previous)throw model.problem('URGENT_ORDER_EXISTS','Diese SO-Nummer ist bereits gemeldet. Bitte die vorhandenen Positionen prüfen.',409);
   doc.orders.push(created);
   // Email history is browser-local; do not link the email to the login profile.
   return{order:created,environment:refs.environment};
  });
 }
 if(action==='save-profile'){
  // Retired: never create a new login-linked email profile, including from
  // legacy clients. Existing historical records remain untouched.
  throw model.problem('URGENT_PROFILE_DEPRECATED','E-Mail-Adressen werden jetzt nur auf diesem Gerät gespeichert.',410);
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
 if(action==='record-mail-handoff'){
  if(!model.canManage(user))throw model.problem('URGENT_FORBIDDEN','Nur die Logistik darf E-Mails dokumentieren.',403);
  return write(refs,doc=>{
   const order=accessibleOrder(doc,model.text(p.id,90),user);
   const mail=model.recordMailHandoff(order,p,user,now);
   return{mail,order};
  });
 }
 if(action==='confirm-mail-sent'){
  if(!model.canManage(user))throw model.problem('URGENT_FORBIDDEN','Nur die Logistik darf E-Mails als versendet bestätigen.',403);
  return write(refs,doc=>{
   const order=accessibleOrder(doc,model.text(p.id,90),user);
   const mail=model.confirmMailSent(order,model.text(p.mailId,90),user,now);
   return{mail,order};
  });
 }
 if(action==='prepare-mail'){
  if(!model.canManage(user))throw model.problem('URGENT_FORBIDDEN','Nur die Logistik darf E-Mails vorbereiten.',403);
  const doc=normalize((await readDoc(refs)).value),order=accessibleOrder(doc,model.text(p.id,90),user);
  const kind=model.text(p.kind,30),lang=model.language(p.language||order.language);
  const originalNote=String(p.note==null?'':p.note);
  // Translation is for the actual employee-entered website error text, not
  // just for the fixed mail labels. Only server-side credentials are used.
  // The draft remains editable and an unavailable translation is disclosed.
  const translation=kind==='problem'&&originalNote.trim().length>=8
   ?await mailTranslation.translateIssueNote(originalNote,model.language(p.noteLanguage||order.language),lang)
   :{text:originalNote,translationWarning:false};
  return{
   draft:model.draftMail(order,kind,lang,translation.text,user),
   orderId:order.id,
   translationWarning:translation.translationWarning===true,
   translationWarningText:translation.translationWarning?apiI18n.tLang(lang,'api.urgent.translationReview'):''
  };
 }
 throw model.problem('URGENT_ACTION_UNKNOWN','Unbekannte Urgent-Order-Aktion.');
}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return;}
 if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'});return;}
 try{
  const current=await withReadRetry(async()=>await auth.validateSession(req));
  const ref=storage(req);
  const result=await execute(req,current.user,ref);
  context.res=json(200,{ok:true,...result});
 }catch(e){
  // A temporary storage/network failure without our own problem status is a
  // controlled 503 (retry later), not an unexplained 500.
  const transient=!(e&&e.status)&&isTransientStorageError(e);
  const status=transient?503:Number(e&&e.status||e&&e.statusCode)||500;
  const code=transient?'URGENT_STORAGE_UNAVAILABLE':e&&e.code&&e.status?e.code:(status>=500?'URGENT_ERROR':e&&e.code||'URGENT_ERROR');
  context.log&&context.log.warn&&context.log.warn('urgent-orders',code,status,failureDetails(e));
  if(e&&e.code==='URGENT_HOST_UNTRUSTED')context.log&&context.log.warn&&context.log.warn('urgent-host-evidence',JSON.stringify(safeHostDiagnostic(req)));
  const response={ok:false,code,message:status>=500?apiI18n.t(req,e&&e.code==='URGENT_HOST_UNTRUSTED'?'api.urgent.hostUntrusted':'api.urgent.serverError'):e&&e.message||apiI18n.t(req,'api.urgent.invalidRequest')};
  if(code==='URGENT_MINIBAG_CONFIRM_REQUIRED')response.minibagArticles=e.minibagArticles||[];
  if(code==='URGENT_HOST_UNTRUSTED')response.diagnostic=safeHostDiagnostic(req);
  context.res=json(status,response);
 }
};
module.exports.execute=execute;
module.exports.storage=storage;
module.exports.resolveStorageEnvironment=resolveStorageEnvironment;
module.exports.safeHostDiagnostic=safeHostDiagnostic;
module.exports.deploymentEnv=deploymentEnv;
module.exports.readDocument=async function(refs){return normalize((await readDoc(refs)).value);};
module.exports.readPackingCatalog=readPackingCatalog;
module.exports.withReadRetry=withReadRetry;
module.exports.write=write;
module.exports.empty=empty;
module.exports.normalize=normalize;
