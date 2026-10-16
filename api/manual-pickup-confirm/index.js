'use strict';

const crypto=require('crypto');
const {BlobServiceClient}=require('@azure/storage-blob');
const auth=require('../shared/auth-store');
const fastAuth=require('../shared/fast-auth-store');
const apiI18n=require('../shared/i18n');

const TEAM_CONTAINER=process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data';
const TEAM_BLOB_BASE=process.env.EXPORTHUB_STORAGE_BLOB||process.env.EXPORTHUB_STATE_BLOB||'team-state.json';
const TEST_TEAM_BLOB=process.env.EXPORTHUB_TEST_STORAGE_BLOB||('testservice/'+String(TEAM_BLOB_BASE).replace(/^\/+/,''));
const MAX_RETRIES=8;

function text(value){return String(value==null?'':value).trim()}
function upper(value){return text(value).toUpperCase()}
function arr(value){return Array.isArray(value)?value:[]}
function obj(value){return!!value&&typeof value==='object'&&!Array.isArray(value)}
function now(){return new Date().toISOString()}
function body(req){return auth.body(req)}
function json(status,payload){return auth.json(status,payload,{'Cache-Control':'no-store, no-cache, must-revalidate'})}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
function teamBlobName(environment){return environment==='testservice'?TEST_TEAM_BLOB:TEAM_BLOB_BASE}
function isConflict(error){return!!(error&&(Number(error.statusCode||error.status)===412||['ConditionNotMet','TargetConditionNotMet'].includes(String(error.code||''))))}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

async function validateSession(req){
  if(fastAuth&&typeof fastAuth.isSource==='function'&&fastAuth.isSource(auth))return fastAuth.validateSession(req);
  return auth.validateSession(req);
}

function resolveEnvironment(req,payload){
  const headers=req&&req.headers||{};
  const requested=text(payload&&payload.environment||headers['x-exporthub-environment']||headers['X-ExportHUB-Environment']||req&&req.query&&req.query.environment).toLowerCase();
  return requested==='testservice'?'testservice':'production';
}

async function teamBlob(environment){
  const cs=connectionString();
  if(!cs)throw auth.error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);
  const service=BlobServiceClient.fromConnectionString(cs);
  const container=service.getContainerClient(TEAM_CONTAINER);
  if(typeof container.createIfNotExists==='function')await container.createIfNotExists();
  return container.getBlockBlobClient(teamBlobName(environment));
}

async function readTeam(blob){
  try{
    const response=await blob.download(0),chunks=[];
    for await(const chunk of response.readableStreamBody)chunks.push(Buffer.from(chunk));
    const raw=Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,'').trim();
    return{value:raw?JSON.parse(raw):{schemaVersion:3,revision:0,state:{}},etag:response.etag||null};
  }catch(error){
    if(error&&Number(error.statusCode)===404)return{value:{schemaVersion:3,revision:0,state:{}},etag:null};
    throw error;
  }
}

async function writeTeam(blob,team,etag){
  const raw=JSON.stringify(team);
  const options={blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8',blobCacheControl:'no-store'}};
  if(etag)options.conditions={ifMatch:etag};
  else options.conditions={ifNoneMatch:'*'};
  return blob.upload(raw,Buffer.byteLength(raw),options);
}

function identityValues(shipment){
  if(!obj(shipment))return[];
  return['id','shipmentId','uuid','ref','reference','shipmentRef','referenceNumber','referenceNo'].map(key=>text(shipment[key])).filter(Boolean);
}
function sameShipment(shipment,id,reference){
  const wantedId=text(id),wantedRef=upper(reference),ids=identityValues(shipment),refs=ids.map(upper);
  return!!((wantedId&&ids.includes(wantedId))||(wantedRef&&refs.includes(wantedRef)));
}
function shipmentCopies(state,id,reference){
  const result=[];
  const add=value=>{if(obj(value)&&sameShipment(value,id,reference)&&!result.includes(value))result.push(value)};
  ['shipments','savedShipments','salesSharedShipments','sharedShipments','shipmentArchive','archivedShipments','archive'].forEach(key=>arr(state&&state[key]).forEach(add));
  ['shipment','currentShipment','selectedShipment'].forEach(key=>add(state&&state[key]));
  return result;
}

function normalizeStatus(value){return text(value).toLocaleLowerCase('de-DE')}
function statusRank(value){
  const status=normalizeStatus(value);
  if(/^(?:archiviert|archived)$/.test(status))return 6;
  if(/^(?:abgeschlossen|completed)$/.test(status))return 5;
  if(/^(?:pod vorhanden|pod available)$/.test(status))return 4;
  if(/^(?:abgeholt|picked up|collected)$/.test(status))return 3;
  if(/^(?:bereit zur abholung|ready for pickup)$/.test(status))return 2;
  if(/^(?:erstellt|created)$/.test(status))return 1;
  return 0;
}
function preserveLaterStatus(shipment){
  return statusRank(shipment&&shipment.status)>=4||statusRank(shipment&&shipment.processStatus)>=4||statusRank(shipment&&shipment.shipmentStatus)>=4;
}

function validDate(value){
  const raw=text(value);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return false;
  const date=new Date(raw+'T12:00:00Z');
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===raw;
}
function validTime(value){return !text(value)||/^([01]\d|2[0-3]):[0-5]\d$/.test(text(value))}
function sanitizePayload(payload){
  const pickupDate=text(payload&&payload.pickupDate),pickupTime=text(payload&&payload.pickupTime),reason=text(payload&&payload.reason).replace(/[\r\n\t]+/g,' ').slice(0,500);
  if(!validDate(pickupDate))throw auth.error('PICKUP_DATE_REQUIRED','Abholdatum ist erforderlich.',400);
  if(!validTime(pickupTime))throw auth.error('PICKUP_TIME_INVALID','Abholzeit ist ungültig.',400);
  if(!reason)throw auth.error('PICKUP_REASON_REQUIRED','Begründung für die manuelle Abholung ist erforderlich.',400);
  const pickupAt=text(payload&&payload.pickupAt);
  if(pickupAt&&!Number.isFinite(Date.parse(pickupAt)))throw auth.error('PICKUP_AT_INVALID','Abholzeitpunkt ist ungültig.',400);
  return{
    pickupDate,
    pickupTime,
    pickupAt:pickupAt?new Date(pickupAt).toISOString():'',
    reason,
    plate:text(payload&&payload.plate).replace(/[\r\n\t]+/g,' ').slice(0,60),
    carrier:text(payload&&payload.carrier).replace(/[\r\n\t]+/g,' ').slice(0,160)
  };
}

function actorName(user){return text(user&&(user.name||user.user||user.login||user.username))||'ExportHUB'}
function applyManualPickup(shipment,input,actor,stamp,eventId){
  const oldStatus=text(shipment.status||shipment.processStatus||shipment.shipmentStatus),oldDate=text(shipment.actualPickupDate),oldTime=text(shipment.actualPickupTime);
  const laterStatus=preserveLaterStatus(shipment);
  const pickedValues={status:'Abgeholt',processStatus:'Abgeholt',shipmentStatus:'Abgeholt'};
  const values={
    actualPickupDate:input.pickupDate,
    actualPickupTime:input.pickupTime,
    pickupConfirmed:true,
    pickupConfirmedAt:stamp,
    manualPickupConfirmedAt:stamp,
    manualPickupConfirmedBy:actor,
    manualPickupReason:input.reason,
    pickupConfirmationSource:'manual',
    updatedAt:stamp,
    _syncUpdatedAt:stamp
  };
  if(input.pickupAt){values.actualPickupAt=input.pickupAt;values.pickedUpAt=input.pickupAt}
  if(input.plate)values.pickupPlate=input.plate;
  if(input.carrier)values.pickupCarrierName=input.carrier;
  if(!laterStatus)Object.assign(values,pickedValues); // preserve later status: POD vorhanden / Abgeschlossen / Archiviert niemals zurückstufen
  Object.assign(shipment,values);
  const afterStatus=text(shipment.status||shipment.processStatus||shipment.shipmentStatus)||'Abgeholt';
  const revision={
    id:eventId,
    at:stamp,
    actor,
    source:'manual',
    reason:input.reason,
    before:{status:oldStatus,actualPickupDate:oldDate,actualPickupTime:oldTime},
    after:{status:afterStatus,actualPickupDate:input.pickupDate,actualPickupTime:input.pickupTime,actualPickupAt:input.pickupAt||''}
  };
  const confirmations=arr(shipment.manualPickupConfirmationHistory).slice();
  if(!confirmations.some(item=>text(item&&item.id)===eventId))confirmations.push(revision);
  shipment.manualPickupConfirmationHistory=confirmations.slice(-100);
  const history=arr(shipment.shipmentHistory).slice();
  if(!history.some(item=>text(item&&item.id)===eventId))history.push({
    id:eventId,
    at:stamp,
    type:'pickup-manual-confirmation',
    label:apiI18n.tLang('de',oldDate?'api.pickup.manualDateChanged':'api.pickup.manualConfirmed'),
    labelKey:oldDate?'api.pickup.manualDateChanged':'api.pickup.manualConfirmed',
    actor:{name:actor,role:'ExportHUB'},
    details:revision
  });
  shipment.shipmentHistory=history.slice(-500);
  return values;
}

async function confirmManualPickup(environment,id,reference,payload,user){
  const input=sanitizePayload(payload),blob=await teamBlob(environment),actor=actorName(user);
  for(let attempt=0;attempt<MAX_RETRIES;attempt++){
    const loaded=await readTeam(blob),team=obj(loaded.value)?loaded.value:{schemaVersion:3,revision:0,state:{}},state=obj(team.state)?team.state:team;
    if(!obj(team.state))team.state=state;
    const copies=shipmentCopies(state,id,reference);
    if(!copies.length)throw auth.error('SHIPMENT_NOT_FOUND','Sendung wurde nicht gefunden.',404);
    const stamp=now(),eventId='MANUAL-PICKUP-'+crypto.randomBytes(10).toString('hex');
    let values={};
    copies.forEach((shipment,index)=>{const next=applyManualPickup(shipment,input,actor,stamp,eventId);if(index===0)values=next});
    team.revision=Math.max(0,Number(team.revision)||0)+1;
    team.updatedAt=stamp;
    team.clientVersion='RC1547';
    try{
      await writeTeam(blob,team,loaded.etag);
      const primary=copies[0],status=text(primary.status||primary.processStatus||primary.shipmentStatus)||'Abgeholt';
      return{values:Object.assign({},values,{status,processStatus:text(primary.processStatus)||status,shipmentStatus:text(primary.shipmentStatus)||status}),eventId,actor,confirmedAt:stamp};
    }catch(error){
      if(!isConflict(error)||attempt===MAX_RETRIES-1)throw error;
      await wait(35*(attempt+1));
    }
  }
  throw auth.error('PICKUP_SAVE_CONFLICT','Abholung konnte wegen gleichzeitiger Änderungen nicht gespeichert werden.',409);
}

module.exports=async function(context,req){
  const method=String(req&&req.method||'POST').toUpperCase();
  if(method==='OPTIONS'){context.res=json(204,{});return}
  try{
    if(method!=='POST')throw auth.error('METHOD_NOT_ALLOWED','Methode nicht erlaubt.',405);
    const session=await validateSession(req),payload=body(req),environment=resolveEnvironment(req,payload);
    const id=text(payload.shipmentId||payload.id),reference=upper(payload.reference||payload.ref);
    if(!id&&!reference)throw auth.error('SHIPMENT_REQUIRED','Sendungsreferenz fehlt.',400);
    const result=await confirmManualPickup(environment,id,reference,payload,session.user);
    context.res=json(200,{ok:true,environment,reference,shipmentId:id,values:result.values,eventId:result.eventId,actor:result.actor,confirmedAt:result.confirmedAt});
  }catch(error){
    context.res=json(Number(error&&(error.status||error.statusCode))||500,{ok:false,code:text(error&&error.code)||'MANUAL_PICKUP_FAILED',message:text(error&&error.message)||apiI18n.t(req,'api.pickup.manualFailed')});
  }
};

module.exports._test={sanitizePayload,statusRank,preserveLaterStatus,applyManualPickup,sameShipment};
