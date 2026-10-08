'use strict';
const crypto=require('crypto');
const packStore=require('../shared/pack-notification-store');

const TEAM_CONTAINER=process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data';
const TEAM_BLOB=process.env.EXPORTHUB_STORAGE_BLOB||process.env.EXPORTHUB_STATE_BLOB||'team-state.json';
const TEST_TEAM_BLOB=process.env.EXPORTHUB_TEST_STORAGE_BLOB||('testservice/'+String(TEAM_BLOB).replace(/^\/+/,''));
const MAX_RETRIES=5;
const DEFAULT_UPLOAD_MAX=Math.max(256*1024,Math.min(25*1024*1024,Number(process.env.EXPORTHUB_PACK_UPLOAD_MAX_BYTES||10*1024*1024)));
const RATE_WINDOW_MS=60*1000;
const RATE_MAX=Math.max(10,Math.min(300,Number(process.env.EXPORTHUB_PACK_RATE_LIMIT||90)));
const rateBuckets=new Map();

function text(v){return String(v==null?'':v).trim();}
function lower(v){return text(v).toLowerCase();}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function body(req){if(req&&req.body&&typeof req.body==='object')return req.body;try{return JSON.parse(req&&req.body||'{}')}catch(_){return{}}}
function header(req,name){const h=req&&req.headers||{};return h[name.toLowerCase()]||h[name]||'';}
function error(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;e.statusCode=status;return e;}
function response(status,value){return{status,body:value};}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.EXPORTHUB_STORAGE_CONNECTION||process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||'';}
function resolveEnvironment(req,payload={}){const host=lower(header(req,'host')||header(req,'x-forwarded-host'));const requested=lower(header(req,'x-exporthub-environment')||payload.environment);const hostEnv=/testservice/.test(host)?'testservice':'production';if(requested&&requested!=='production'&&requested!=='testservice')throw error('PACK_ENVIRONMENT_INVALID','Ungültige Umgebung.',400);if(requested&&requested!==hostEnv)throw error('PACK_ENVIRONMENT_MISMATCH','Pack-Umgebung passt nicht zum Host.',409);return requested||hostEnv;}
function sanitizeFilename(name){const cleaned=text(name).replace(/[\\/\0-\x1f\x7f]+/g,'_').replace(/\s+/g,' ').slice(0,180);return cleaned||'document';}
function ext(name){const m=sanitizeFilename(name).toLowerCase().match(/(\.[a-z0-9]+)$/);return m?m[1]:'';}
function dataMime(doc){const raw=text(doc&&doc.data||doc&&doc.dataUrl);const m=raw.match(/^data:([^;,]+);base64,/i);return lower(m&&m[1]);}
function inlineBuffer(doc){
 const raw=text(doc&&doc.data||doc&&doc.dataUrl||doc&&doc.base64);if(!raw)return null;
 const comma=raw.indexOf(','),payload=comma>=0?raw.slice(comma+1):raw;
 if(!payload||payload.length%4===1||!/^[A-Za-z0-9+/]*={0,2}$/.test(payload))return null;
 try{const buffer=Buffer.from(payload,'base64');if(!buffer.length)return null;const normalized=buffer.toString('base64').replace(/=+$/,'');if(normalized!==payload.replace(/=+$/,''))return null;return buffer}catch(_){return null}
}
function payloadBytes(doc){const buffer=inlineBuffer(doc);if(buffer)return buffer.length;const explicit=Number(doc&&doc.size);return Number.isFinite(explicit)&&explicit>=0?explicit:0;}
function signatureMatches(extension,buffer){
 if(!buffer||!buffer.length)return false;
 if(extension==='.pdf')return buffer.length>=5&&buffer.subarray(0,5).toString('ascii')==='%PDF-';
 if(extension==='.jpg'||extension==='.jpeg')return buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff;
 if(extension==='.png')return buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
 return false;
}
function validateDocuments(input,maxBytes=DEFAULT_UPLOAD_MAX){const docs=Array.isArray(input)?input:[];if(!docs.length)throw error('PACK_DOCUMENT_REQUIRED','Mindestens ein Lieferschein ist erforderlich.',400);const map={'.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'};return docs.map((raw,index)=>{const name=sanitizeFilename(raw&&raw.name||raw&&raw.fileName||`document-${index+1}`),extension=ext(name),mime=lower(raw&&raw.mimeType||raw&&raw.type||dataMime(raw)),expected=map[extension];if(!expected||mime!==expected||dataMime(raw)&&dataMime(raw)!==expected)throw error('PACK_DOCUMENT_TYPE_MISMATCH','Dateiendung und Dateityp stimmen nicht überein.',400);const buffer=inlineBuffer(raw),size=buffer?buffer.length:payloadBytes(raw);if(size<=0)throw error('PACK_DOCUMENT_EMPTY','Leere Dokumente sind nicht erlaubt.',400);if(size>Number(maxBytes))throw error('PACK_DOCUMENT_TOO_LARGE','Dokument ist zu groß.',413);if(buffer&&!signatureMatches(extension,buffer))throw error('PACK_DOCUMENT_SIGNATURE_INVALID','Dateiinhalt passt nicht zum angegebenen Dokumenttyp.',400);return Object.assign({},clone(raw),{name,mimeType:expected,size});});}
function positive(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:0;}
function validateSubmitPayload(raw,maxBytes=DEFAULT_UPLOAD_MAX){
 const p=raw&&typeof raw==='object'?raw:{};
 if(!text(p.stationToken))throw error('PACK_STATION_TOKEN_REQUIRED','Packtisch-Token fehlt.',400);
 if(!text(p.sessionId))throw error('PACK_SESSION_REQUIRED','Pack-Session fehlt.',400);
 if(!text(p.idempotencyKey))throw error('PACK_IDEMPOTENCY_REQUIRED','Idempotency-Key fehlt.',400);
 if(!text(p.customer))throw error('PACK_CUSTOMER_REQUIRED','Kunde fehlt.',400);
 const customerSource=lower(p.customerSource)==='master'?'master':'manual';
 const customerId=customerSource==='master'?text(p.customerId).slice(0,120):'';
 const customerAccount=customerSource==='master'?text(p.customerAccount).slice(0,120):'';
 if(customerSource==='master'&&!customerId)throw error('PACK_CUSTOMER_ID_REQUIRED','Ausgewählter Kunde ist unvollständig.',400);
 if(!text(p.deliveryNoteReference))throw error('PACK_DELIVERY_NOTE_REQUIRED','Lieferschein/Referenz fehlt.',400);
 if(!text(p.packageType))throw error('PACK_PACKAGE_TYPE_REQUIRED','Packstücktyp fehlt.',400);
 const packageCount=Number(p.packageCount);if(!Number.isInteger(packageCount)||packageCount<1)throw error('PACK_PACKAGE_COUNT_INVALID','Anzahl Packstücke ist ungültig.',400);
 const totalWeight=positive(p.totalWeight);if(!totalWeight)throw error('PACK_WEIGHT_INVALID','Gesamtgewicht muss größer als 0 sein.',400);
 const packages=Array.isArray(p.packages)?p.packages:[];if(packages.length!==packageCount)throw error('PACK_PACKAGES_INVALID','Maße müssen für jedes Packstück erfasst werden.',400);
 const normalizedPackages=packages.map((item,index)=>{const length=positive(item&&item.length),width=positive(item&&item.width),height=positive(item&&item.height);if(!length||!width||!height)throw error('PACK_DIMENSIONS_INVALID','Länge, Breite und Höhe müssen größer als 0 sein.',400);return{packageNo:index+1,length,width,height,unit:'cm'};});
 return{stationToken:text(p.stationToken),sessionId:text(p.sessionId),idempotencyKey:text(p.idempotencyKey),customer:text(p.customer).slice(0,200),customerId,customerAccount,customerSource,deliveryNoteReference:text(p.deliveryNoteReference).slice(0,200),packageType:text(p.packageType).slice(0,80),packageCount,totalWeight,packages:normalizedPackages,note:text(p.note).slice(0,2000),documents:validateDocuments(p.documents,maxBytes)};
}
function customerSearch(state,query){
 const q=lower(query);if(q.length<2)return[];
 const customers=Array.isArray(state&&state.customers)?state.customers:[];
 const out=[];
 for(const raw of customers){
  const id=text(raw&&raw.id),account=text(raw&&raw.account||raw&&raw.customerNumber),name=text(raw&&raw.name||raw&&raw.customerName);
  if(!id&&!account&&!name)continue;
  if(!lower(account).includes(q)&&!lower(name).includes(q))continue;
  out.push({id,account,name});
  if(out.length>=10)break;
 }
 return out;
}
function packageNumber(raw,...keys){for(const key of keys){const n=Number(raw&&raw[key]);if(Number.isFinite(n)&&n>0)return n;}return null;}
function packagingList(state){
 const fixed=[{name:'E3',length:43,width:31,height:31,ldm:0.06,source:'fixed'}];
 const seen=new Set(fixed.map(x=>lower(x.name))),out=fixed.slice();
 for(const raw of Array.isArray(state&&state.colliTypes)?state.colliTypes:[]){
  const name=text(raw&&raw.name||raw&&raw.label||raw&&raw.type||raw&&raw.packaging).slice(0,120);if(!name||seen.has(lower(name)))continue;
  const item={name,length:packageNumber(raw,'l','length'),width:packageNumber(raw,'w','width'),height:packageNumber(raw,'h','height'),ldm:packageNumber(raw,'ldm'),source:'master'};
  out.push(item);seen.add(lower(name));if(out.length>=100)break;
 }
 return out;
}
function taskFor(notification,environment){const at=notification.createdAt||new Date().toISOString();return{id:`task:pack:${notification.id}`,sourceType:'pack_notification',sourceId:notification.id,sourceRef:notification.reference,group:'Packmeldungen',title:`Neue Packmeldung · ${notification.customer||notification.reference}`,status:'open',priority:'P2',manual:false,unread:true,readAt:'',environment,createdAt:at,updatedAt:at};}
function configuredStations(){let list=[];try{list=JSON.parse(process.env.EXPORTHUB_PACK_STATIONS_JSON||'[]')}catch(_){return[]}return(Array.isArray(list)?list:[]).map((s,index)=>{const token=text(s&&s.token);if(!token)return null;return{id:text(s.id)||`PT${String(index+1).padStart(2,'0')}`,name:text(s.name)||`Packtisch ${index+1}`,tokenHash:packStore.hashStationToken(token),active:s.active!==false,createdAt:text(s.createdAt)||new Date().toISOString(),updatedAt:new Date().toISOString()}}).filter(Boolean);}
function ensureConfiguredStations(state){const out=state&&typeof state==='object'?state:{};if(!Array.isArray(out.packStations))out.packStations=[];for(const station of configuredStations()){const i=out.packStations.findIndex(x=>text(x&&x.id)===station.id);if(i<0)out.packStations.push(station);else out.packStations[i]=Object.assign({},out.packStations[i],{name:station.name,tokenHash:station.tokenHash,active:station.active,updatedAt:station.updatedAt});}return out;}
function defaultRateLimit(req,action){const key=[text(header(req,'x-forwarded-for')).split(',')[0]||'unknown',action].join('|'),now=Date.now(),bucket=rateBuckets.get(key);if(!bucket||now-bucket.start>=RATE_WINDOW_MS){rateBuckets.set(key,{start:now,count:1});return;}bucket.count++;if(bucket.count>RATE_MAX)throw error('PACK_RATE_LIMIT','Zu viele Anfragen. Bitte erneut versuchen.',429);}
async function readJson(blob){try{const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));const raw=Buffer.concat(chunks);return{value:JSON.parse(raw.toString('utf8')),etag:r.etag||null}}catch(e){if(Number(e&&e.statusCode)===404)return{value:{schemaVersion:3,revision:0,state:{},users:[]},etag:null};throw e;}}
async function uploadJson(blob,value,etag){const raw=JSON.stringify(value),bytes=Buffer.byteLength(raw);return blob.upload(raw,bytes,{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions:etag?{ifMatch:etag}:{ifNoneMatch:'*'},metadata:{schema:String(value.schemaVersion||3),revision:String(value.revision||0),clientversion:'pack-notification',updatedepoch:String(Date.parse(value.updatedAt||'')||Date.now())}});}
function defaultMutateState(){const {createBlobServiceClient}=require('../shared/blob-rest');const documents=require('../shared/document-blob-store');return async function(environment,mutator){const cs=connectionString();if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);const container=createBlobServiceClient(cs).getContainerClient(TEAM_CONTAINER),blob=container.getBlockBlobClient(environment==='testservice'?TEST_TEAM_BLOB:TEAM_BLOB);for(let attempt=0;attempt<MAX_RETRIES;attempt++){const current=await readJson(blob),team=current.value&&typeof current.value==='object'?current.value:{schemaVersion:3,revision:0,state:{},users:[]},currentState=team.state&&typeof team.state==='object'?team.state:{};const result=await mutator(ensureConfiguredStations(clone(currentState)));const externalized=await documents.externalizeDocumentCollections(result.state,{currentState,environment});team.state=externalized.state;team.schemaVersion=Math.max(3,Number(team.schemaVersion||3));team.revision=Number(team.revision||0)+1;team.updatedAt=new Date().toISOString();team.updatedBy='public-pack-station';team.clientVersion='pack-notification';try{await uploadJson(blob,team,current.etag);return Object.assign({},result,{state:team.state})}catch(e){if((Number(e&&e.statusCode)===409||Number(e&&e.statusCode)===412)&&attempt<MAX_RETRIES-1)continue;throw e;}}throw error('PACK_CONCURRENT_UPDATE','Packmeldung konnte wegen paralleler Änderungen nicht gespeichert werden.',409);};}
function createHandler(deps={}){const mutateState=deps.mutateState||defaultMutateState(),now=deps.now||(()=>new Date()),rateLimit=deps.rateLimit||defaultRateLimit,maxBytes=Number(deps.maxUploadBytes||DEFAULT_UPLOAD_MAX);return async function(req){try{if(String(req&&req.method||'POST').toUpperCase()==='OPTIONS')return response(204,{ok:true});if(String(req&&req.method||'POST').toUpperCase()!=='POST')throw error('METHOD_NOT_ALLOWED','Methode nicht erlaubt.',405);const payload=body(req),action=lower(req&&req.query&&req.query.action);if(!['session','submit','customer-search','packaging-list'].includes(action))throw error('PACK_ACTION_INVALID','Unbekannte Pack-Aktion.',400);rateLimit(req,action);const environment=resolveEnvironment(req,payload);
if(action==='customer-search'){
 const token=text(payload.stationToken);if(!token)throw error('PACK_STATION_TOKEN_REQUIRED','Packtisch-Token fehlt.',400);
 const result=await mutateState(environment,state=>{packStore.validateStationToken(state,token);return{state,customers:customerSearch(state,payload.query)};});
 return response(200,{ok:true,customers:result.customers});
}
if(action==='packaging-list'){
 const token=text(payload.stationToken);if(!token)throw error('PACK_STATION_TOKEN_REQUIRED','Packtisch-Token fehlt.',400);
 const result=await mutateState(environment,state=>{packStore.validateStationToken(state,token);return{state,packaging:packagingList(state)};});
 return response(200,{ok:true,packaging:result.packaging});
}
if(action==='session'){const token=text(payload.stationToken);if(!token)throw error('PACK_STATION_TOKEN_REQUIRED','Packtisch-Token fehlt.',400);const result=await mutateState(environment,state=>{const station=packStore.validateStationToken(state,token),created=packStore.createSession(state,station.id,now());return{state:created.state,session:created.session,station};});return response(201,{ok:true,sessionId:result.session.id,stationName:result.station.name,expiresAt:result.session.expiresAt});}
const valid=validateSubmitPayload(payload,maxBytes);const result=await mutateState(environment,state=>{const station=packStore.validateStationToken(state,valid.stationToken),session=packStore.getSession(state,valid.sessionId);if(!session)throw error('PACK_SESSION_NOT_FOUND','Pack-Session nicht gefunden.',404);if(text(session.packStationId)!==text(station.id))throw error('PACK_SESSION_STATION_MISMATCH','Pack-Session gehört zu einem anderen Packtisch.',403);if(session.status!=='submitted'&&Date.parse(session.expiresAt||'')<new Date(now()).getTime())throw error('PACK_SESSION_EXPIRED','Pack-Session ist abgelaufen.',409);const submitted=packStore.submitSession(state,valid.sessionId,valid,now());const out=submitted.state;if(!Array.isArray(out.tasks))out.tasks=[];let task=out.tasks.find(t=>text(t&&t.sourceType)==='pack_notification'&&text(t&&t.sourceId)===submitted.notification.id);if(!task){task=taskFor(submitted.notification,environment);out.tasks.push(task);}return{state:out,notification:submitted.notification,created:submitted.created,task};});return response(result.created?201:200,{ok:true,reference:result.notification.reference,notificationId:result.notification.id,created:result.created});}catch(e){return response(Number(e&&e.status||e&&e.statusCode)||500,{ok:false,code:text(e&&e.code)||'PACK_NOTIFICATION_FAILED',message:text(e&&e.message)||'Packmeldung fehlgeschlagen.'});}};}

let defaultHandler=null;
module.exports=async function(context,req){if(!defaultHandler)defaultHandler=createHandler();const res=await defaultHandler(req);context.res={status:res.status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(res.body)};};
module.exports.createHandler=createHandler;
module.exports.validateDocuments=validateDocuments;
module.exports.validateSubmitPayload=validateSubmitPayload;
module.exports.resolveEnvironment=resolveEnvironment;
module.exports.sanitizeFilename=sanitizeFilename;
module.exports.customerSearch=customerSearch;
module.exports.packagingList=packagingList;
module.exports.taskFor=taskFor;
