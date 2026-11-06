'use strict';
// Versanddokumentation je REF: eigenstaendiger, versionierter Nachweis.
// Die Originaldateien bleiben unveraendert im geschuetzten REF-Ordner.
const crypto=require('crypto');
const {BlobServiceClient}=require('@azure/storage-blob');
const auth=require('../shared/auth-store');
const apiI18n=require('../shared/i18n');
const rights=require('../shared/state-write-guard');
const shipments=require('../shared/av-check');
const {isolationConfig}=require('../shared/testservice-auth-isolation');

const FIELDS={
  shipmentNumber:100,customer:200,dispatchDate:10,colli:10,weightKg:16,
  packaging:400,shippingMethod:80,carrier:160,trackingNumber:160,
  contents:3000,loadSecuring:1500,remarks:2000
};
const STATES=new Set(['offen','in_pruefung','abgeschlossen']);
function txt(v,max){return String(v==null?'':v).trim().slice(0,max)}
function problem(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e}
function reference(v){const x=txt(v,30).toUpperCase();if(!/^[A-Z0-9]{6}$/.test(x))throw problem('INVALID_REFERENCE','Sendungsreferenz muss sechs Buchstaben/Ziffern haben.');return x}
function normalizeFields(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw problem('FIELDS_REQUIRED','Sendungsdaten fehlen.');
 const out={};
 for(const [key,max] of Object.entries(FIELDS))out[key]=txt(input[key],max);
 if(out.dispatchDate&&!validDate(out.dispatchDate))throw problem('INVALID_DATE','Datum ist ungueltig.');
 if(out.colli&&(!/^\d+$/.test(out.colli)||Number(out.colli)>100000))throw problem('INVALID_COLLI','Colli muss eine ganze Zahl sein.');
 if(out.weightKg&&(!/^\d+(?:[.,]\d{1,3})?$/.test(out.weightKg)||Number(out.weightKg.replace(',','.'))>100000000))throw problem('INVALID_WEIGHT','Gewicht ist ungueltig.');
 out.weightKg=out.weightKg.replace(',','.');
 return out;
}
function validDate(value){const d=String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;const dt=new Date(d+'T12:00:00Z');return Number.isFinite(dt.getTime())&&dt.toISOString().slice(0,10)===d}
function complaintText(input){const value=txt(input,2000);if(!value)throw problem('COMPLAINT_REQUIRED','Bitte die Kundenbeschwerde erfassen.');return value}
function recordBlank(ref){return{version:1,reference:ref,revision:0,fields:null,complaints:[],history:[],createdAt:null,updatedAt:null,updatedBy:''}}
function json(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)}}
function clientFor(env){
 const cfg=isolationConfig(),isolated=env==='testservice'&&cfg.enabled;
 const conn=isolated?cfg.connectionString:process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||'';
 if(!conn)throw problem('STORAGE_NOT_CONFIGURED','Speicher ist nicht erreichbar.',503);
 const container=isolated?cfg.container:auth.TEAM_CONTAINER;
 return{service:BlobServiceClient.fromConnectionString(conn),container,prefix:env==='testservice'?'testservice/shipment-documentation/':'shipment-documentation/'};
}
function blobFor(env,ref){
 const cfg=clientFor(env);
 return cfg.service.getContainerClient(cfg.container).getBlockBlobClient(cfg.prefix+ref+'.json');
}
async function read(blob,ref){
 try{
  const response=await blob.download(0),chunks=[];
  for await(const chunk of response.readableStreamBody)chunks.push(Buffer.from(chunk));
  const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!parsed||parsed.reference!==ref||!Number.isInteger(parsed.revision)||parsed.revision<1)throw problem('DOCUMENT_CORRUPT','Die gespeicherte Sendungsdokumentation ist ungueltig.',503);
  return{record:parsed,etag:response.etag};
 }catch(e){if(e&&e.statusCode===404)return{record:recordBlank(ref),etag:null};throw e}
}
function bodyOf(req){
 const raw=req&&req.body;
 if(typeof raw==='string'&&Buffer.byteLength(raw)>32000)throw problem('PAYLOAD_TOO_LARGE','Die Eingabe ist zu gross.',413);
 if(raw&&typeof raw==='object'&&!Buffer.isBuffer(raw))return raw;
 try{return JSON.parse(String(raw||'{}'))}catch(_){throw problem('INVALID_JSON','Ungueltige Eingabe.')}
}
async function userEnvironment(req){
 const logged=await auth.validateSession(req),env=auth.environmentFromRequest(req),storage=auth.loginStorageEnvironment(req);
 const sessionEnv=txt(logged.session&&logged.session.environment,32).toLowerCase();
 if((sessionEnv==='testservice'&&env!=='testservice')||(storage==='testservice'&&sessionEnv!=='testservice'))
  throw problem('SESSION_ENVIRONMENT_MISMATCH','Anmeldung gehoert zu einer anderen Umgebung.',403);
 return{env,username:txt(auth.usernameOf(logged.user)||logged.user&&logged.user.name||'Mitarbeiter',120),user:logged.user,team:logged.team};
}
async function write(blob,record,etag){
 const data=Buffer.from(JSON.stringify(record),'utf8');
 if(data.length>256*1024)throw problem('DOCUMENT_LIMIT','Zu viele Eintraege in dieser Sendungsdokumentation.',413);
 try{
  await blob.uploadData(data,{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},
   conditions:etag?{ifMatch:etag}:{ifNoneMatch:'*'}});
 }catch(e){if(e&&(e.statusCode===409||e.statusCode===412))throw problem('CONFLICT','Die Dokumentation wurde zwischenzeitlich geaendert. Bitte neu laden.',409);throw e}
}
function assertShipmentAccess(user,team,ref,method){
 if(!rights.canReadAny(user,['shipment','shipmentoverview','documents']))throw problem('DOCUMENTATION_FORBIDDEN','Keine Berechtigung fuer die Sendungsdokumentation.',403);
 if(method==='POST'&&!rights.canEditAny(user,['shipment','documents']))throw problem('DOCUMENTATION_READ_ONLY','Keine Berechtigung zum Aendern der Sendungsdokumentation.',403);
 const state=team&&team.state&&typeof team.state==='object'?team.state:{};
 if(!shipments.shipmentCopies(state,ref).length)throw problem('SHIPMENT_NOT_FOUND','Diese Sendungsreferenz existiert nicht im zentralen ExportHUB-Sendungsbestand.',404);
}
async function handle(req){
 const {env,username,user,team}=await userEnvironment(req);
 const input=req.method==='GET'?(req.query||{}):bodyOf(req);
 const ref=reference(input.reference);
 assertShipmentAccess(user,team,ref,req.method);
 const blob=blobFor(env,ref);
 const existing=await read(blob,ref);
 if(req.method==='GET')return json(200,{ok:true,exists:!!existing.etag,record:existing.record});
 const expected=Number(input.expectedRevision);
 if(!Number.isInteger(expected)||expected!==existing.record.revision)throw problem('CONFLICT','Neu laden: Die Dokumentation wurde von jemand anderem geaendert.',409);
 const action=txt(input.action,32),now=new Date().toISOString();
 const rec=existing.record;
 let previousFields=null,statusChange=null;
 if(action==='save'){
  previousFields=Object.assign({},rec.fields||{});
  rec.fields=normalizeFields(input.fields);
 }else if(action==='complaint'){
  if(!rec.fields)throw problem('SAVE_FIRST','Bitte erst den Versandnachweis speichern.');
  if(rec.complaints.length>=200)throw problem('COMPLAINT_LIMIT','Die maximale Anzahl Beschwerden ist erreicht.',413);
  const reportedDate=txt(input.reportedDate,10)||now.slice(0,10);
  if(!validDate(reportedDate))throw problem('INVALID_COMPLAINT_DATE','Beschwerdedatum ist ungueltig.');
  rec.complaints.push({id:crypto.randomUUID(),date:now,reportedDate,
   text:complaintText(input.text),state:'offen',createdBy:username,changedAt:now,changedBy:username});
 }else if(action==='complaint-status'){
  const id=txt(input.complaintId,80),state=txt(input.state,32);
  if(!STATES.has(state))throw problem('INVALID_STATUS','Ungueltiger Beschwerdestatus.');
  const item=rec.complaints.find(x=>x.id===id);
  if(!item)throw problem('COMPLAINT_NOT_FOUND','Beschwerde nicht gefunden.',404);
  statusChange={complaintId:id,before:item.state,after:state};
  item.state=state;item.changedAt=now;item.changedBy=username;
 }else throw problem('ACTION_INVALID','Unbekannte Aktion.');
 const event={date:now,user:username,action,revision:rec.revision+1};
 if(statusChange)event.statusChange=statusChange;
 if(previousFields){
  event.changes={};
  for(const key of Object.keys(FIELDS))if(String(previousFields[key]||'')!==String(rec.fields[key]||''))
   event.changes[key]={before:previousFields[key]||'',after:rec.fields[key]||''};
 }
 if(rec.history.length>=1000)throw problem('HISTORY_LIMIT','Versionshistorie voll; bitte archivieren, bevor neue Aenderungen erfolgen.',413);
 rec.history.push(event);
 if(!rec.createdAt)rec.createdAt=now;
 rec.updatedAt=now;rec.updatedBy=username;rec.revision++;
 await write(blob,rec,existing.etag);
 return json(200,{ok:true,record:rec});
}
module.exports=async function(context,req){
 try{
  if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'GET, POST, OPTIONS','Cache-Control':'no-store'}};return}
  if(!['GET','POST'].includes(req.method)){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'});return}
  context.res=await handle(req);
 }catch(e){
  context.res=json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.status?e.message:apiI18n.t(req,'api.state.serverError')});
 }
};
module.exports.reference=reference;
module.exports.normalizeFields=normalizeFields;
module.exports.assertShipmentAccess=assertShipmentAccess;
