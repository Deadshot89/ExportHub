'use strict';
const {BlobServiceClient}=require('@azure/storage-blob');
const pins=require('../shared/loader-pin-store');
const store=require('../shared/pickup-store');
const CONTAINER=process.env.EXPORTHUB_LOCATION_CONTAINER||'exporthub-location';
const MAX_RETRIES=6;
const LOCATIONS={0:'Eingang',1:'Lane 1',2:'Lane 2',3:'Lane 3',4:'Lane 4',5:'Lane 5',6:'Regal',7:'Vor dem Regal',8:'DAF'};
function q(v){return String(v==null?'':v).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()}
function body(req){return req&&req.body&&typeof req.body==='object'?req.body:{}}
function action(req){return q(req&&req.query&&req.query.action||body(req).action).toLowerCase()}
function token(req,b){return q((req&&req.query&&req.query.token)||b.token).toLowerCase()}
function response(status,obj){return {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','X-Content-Type-Options':'nosniff'},body:JSON.stringify(obj)}}
function err(code,msg,status){const e=new Error(msg);e.code=code;e.status=status||400;return e}
function now(){return new Date().toISOString()}
function count(v){const n=Math.round(Number(v));return Number.isFinite(n)&&n>=0?n:0}
function validToken(v){return /^[A-Za-z0-9_-]{6,128}$/.test(String(v||''))}
function sessionHeader(req){const h=req&&req.headers||{};return q(h.authorization||h.Authorization||h['x-exporthub-token']||h['X-ExportHUB-Token']||h['x-exporthub-session']||h['X-ExportHUB-Session'])}
async function container(){const cs=store.connectionString();if(!cs)throw err('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);const service=BlobServiceClient.fromConnectionString(cs),c=service.getContainerClient(CONTAINER);try{await c.createIfNotExists()}catch(_){}return c}
function blob(c,t){return c.getBlockBlobClient('records/'+t+'.json')}
async function readJson(b){try{const r=await b.download(0),chunks=[];for await(const x of r.readableStreamBody)chunks.push(Buffer.from(x));return{value:chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):null,etag:r.etag||null}}catch(e){if(Number(e&&e.statusCode)===404)return{value:null,etag:null};throw e}}
async function writeJson(b,v,etag){const raw=JSON.stringify(v),conditions=etag?{ifMatch:etag}:{ifNoneMatch:'*'};return b.upload(raw,Buffer.byteLength(raw),{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8',blobCacheControl:'no-store'},conditions})}
async function mutate(t,fn){const c=await container(),b=blob(c,t);for(let i=0;i<MAX_RETRIES;i++){const d=await readJson(b),next=await fn(d.value||null);try{await writeJson(b,next,d.etag);return next}catch(e){if(Number(e&&e.statusCode)===412&&i<MAX_RETRIES-1)continue;throw e}}throw err('LOCATION_CONFLICT','Location konnte wegen eines gleichzeitigen Zugriffs nicht gespeichert werden.',409)}
function pub(r){return{ok:true,token:r.token,shipmentId:r.shipmentId||'',reference:r.reference||'',customer:r.customer||'',palletCount:count(r.palletCount),packageCount:count(r.packageCount),colliCount:count(r.colliCount||r.totalColli||r.expectedColliCount),totalColli:count(r.totalColli||r.colliCount),status:r.status||'',ready:r.ready===true,currentLocation:r.currentLocation||'Eingang',locationCode:count(r.locationCode),prepared:r.prepared===true,loaderName:r.loaderName||'',bookedAt:r.bookedAt||null,collected:r.collected===true,collectedAt:r.collectedAt||null,history:Array.isArray(r.history)?r.history.slice(-50):[],version:'RC666'}}
async function requireLoader(b){const pin=pins.text(b.pin||b.loaderPin||b.personalLoaderPin);if(!pins.validPin(pin))throw err('PIN_REQUIRED','Bitte die vierstellige persönliche Verlader-PIN eingeben.',400);const loader=await pins.findByPin(pin);if(!loader)throw err('INVALID_PIN','Verlader-PIN ist nicht korrekt oder deaktiviert.',401);return loader}
function requireApp(req){if(!sessionHeader(req))throw err('AUTH_REQUIRED','ExportHUB-Anmeldung erforderlich.',401)}
async function listRecords(){const c=await container(),out=[];for await(const item of c.listBlobsFlat({prefix:'records/'})){if(!/\.json$/i.test(item.name))continue;try{const d=await readJson(c.getBlockBlobClient(item.name));if(d.value)out.push(pub(d.value))}catch(_){}}return out}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{'Cache-Control':'no-store','Allow':'GET, POST, OPTIONS'},body:''};return}
 try{
  const a=action(req),b=body(req),t=token(req,b);
  if(a==='list'){requireApp(req);context.res=response(200,{ok:true,records:await listRecords(),version:'RC666'});return}
  if(!validToken(t))throw err('INVALID_TOKEN','Ungültiger Location-QR-Code.',400);
  if(a==='get'||(!a&&req.method==='GET')){const c=await container(),d=await readJson(blob(c,t));if(!d.value)throw err('NOT_FOUND','Location-QR-Code ist nicht registriert.',404);context.res=response(200,pub(d.value));return}
  if(a==='register'){
    requireApp(req);
    const rec=await mutate(t,async function(cur){cur=cur||{token:t,createdAt:now(),history:[]};cur.token=t;cur.shipmentId=q(b.shipmentId||cur.shipmentId);cur.reference=q(b.reference||cur.reference).toUpperCase();cur.customer=q(b.customer||cur.customer);cur.palletCount=count(b.palletCount);cur.packageCount=count(b.packageCount);cur.colliCount=count(b.colliCount||b.totalColli||b.expectedColliCount);cur.totalColli=cur.colliCount;cur.expectedColliCount=cur.colliCount;cur.status=q(b.status||cur.status);cur.ready=b.ready===true;cur.locationCode=cur.collected===true?0:count(cur.locationCode);cur.currentLocation=cur.collected===true?'':(LOCATIONS[cur.locationCode]||q(cur.currentLocation)||'Eingang');cur.prepared=cur.collected===true?false:cur.prepared===true;cur.updatedAt=now();cur.registrationVersion='RC666';return cur});
    context.res=response(200,pub(rec));return;
  }
  if(a==='move'){
    let loader=null;if(pins.validPin(pins.text(b.pin||b.loaderPin||b.personalLoaderPin)))loader=await requireLoader(b);else requireApp(req);
    const code=Math.round(Number(b.locationCode));if(!Number.isFinite(code)||code<0||code>8)throw err('INVALID_LOCATION','Bitte eine gültige Location von 0 bis 8 auswählen.',400);
    const rec=await mutate(t,async function(cur){if(!cur)throw err('NOT_FOUND','Location-QR-Code ist nicht registriert.',404);if(cur.collected===true)throw err('ALREADY_COLLECTED','Die Sendung wurde bereits abgeholt.',409);if(code>0&&cur.ready!==true)throw err('NOT_READY','Die Sendung ist noch nicht abholbereit und kann noch nicht auf eine Ausgangslocation gebucht werden.',409);const stamp=now(),name=LOCS[code];cur.currentLocation=name;cur.locationCode=code;cur.prepared=code>0;cur.loaderName=loader?loader.name:q(b.loaderName||cur.loaderName);cur.loaderId=loader?loader.id:q(b.loaderId||cur.loaderId);cur.bookedAt=stamp;cur.updatedAt=stamp;cur.history=Array.isArray(cur.history)?cur.history:[];cur.history.push({at:stamp,action:'move',locationCode:code,location:name,loaderName:cur.loaderName||''});cur.history=cur.history.slice(-100);return cur});
    context.res=response(200,pub(rec));return;
  }
  if(a==='collect'){
    let loader=null;if(pins.validPin(pins.text(b.pin||b.loaderPin||b.personalLoaderPin)))loader=await requireLoader(b);else requireApp(req);
    const rec=await mutate(t,async function(cur){if(!cur)throw err('NOT_FOUND','Location-QR-Code ist nicht registriert.',404);const stamp=cur.collectedAt||now();cur.collected=true;cur.collectedAt=stamp;cur.currentLocation='';cur.locationCode=0;cur.prepared=false;if(loader){cur.loaderName=loader.name;cur.loaderId=loader.id}cur.updatedAt=now();cur.history=Array.isArray(cur.history)?cur.history:[];if(!cur.history.some(x=>x&&x.action==='collect'&&x.at===stamp))cur.history.push({at:stamp,action:'collect',loaderName:cur.loaderName||''});cur.history=cur.history.slice(-100);return cur});
    context.res=response(200,pub(rec));return;
  }
  throw err('UNKNOWN_ACTION','Unbekannte Location-Aktion.',400);
 }catch(e){context.log&&context.log.error&&context.log.error('location-booking RC666',e&&e.code,e&&e.message);context.res=response(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Location konnte nicht verarbeitet werden.'});}
};
