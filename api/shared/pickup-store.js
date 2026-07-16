'use strict';
const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');

const RECORD_CONTAINER = process.env.EXPORTHUB_PICKUP_CONTAINER || 'exporthub-pickup';
const POD_CONTAINER = process.env.EXPORTHUB_POD_CONTAINER || 'exporthub-pod';
const TEAM_CONTAINER = process.env.EXPORTHUB_STORAGE_CONTAINER || 'exporthub-data';
const TEAM_BLOB = process.env.EXPORTHUB_STORAGE_BLOB || 'team-state.json';
const MAX_RETRIES = 6;

function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || ''}
function secret(){return process.env.EXPORTHUB_PICKUP_SECRET || connectionString() || 'exporthub-local-secret'}
function hash(value){return crypto.createHmac('sha256',secret()).update(String(value||'')).digest('hex')}
function safeEqualHex(a,b){try{const aa=Buffer.from(String(a||''),'hex'),bb=Buffer.from(String(b||''),'hex');return aa.length===bb.length&&aa.length>0&&crypto.timingSafeEqual(aa,bb)}catch(_){return false}}
function validToken(token){return /^[a-f0-9]{48}$/i.test(String(token||''))}
function json(status,body,headers={}){return {status,headers:Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},headers),body:JSON.stringify(body)}}
function body(req){if(req&&req.body&&typeof req.body==='object')return req.body;try{return JSON.parse(req.body||'{}')}catch(_){return {}}}
function principal(req){try{const h=req.headers&&(req.headers['x-ms-client-principal']||req.headers['X-MS-CLIENT-PRINCIPAL']);return h?JSON.parse(Buffer.from(h,'base64').toString('utf8')):null}catch(_){return null}}
function actor(req){const p=principal(req);return p&&(p.userDetails||p.userId)||'QR-Abholscan'}
function err(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e}
function now(){return new Date().toISOString()}
function clone(v){return JSON.parse(JSON.stringify(v))}

async function clients(){
  const cs=connectionString();
  if(!cs)throw err('STORAGE_NOT_CONFIGURED','App-Einstellung EXPORTHUB_STORAGE_CONNECTION_STRING fehlt.',503);
  const service=BlobServiceClient.fromConnectionString(cs);
  const records=service.getContainerClient(RECORD_CONTAINER),pods=service.getContainerClient(POD_CONTAINER),team=service.getContainerClient(TEAM_CONTAINER);
  await Promise.all([records.createIfNotExists(),pods.createIfNotExists(),team.createIfNotExists()]);
  return {service,records,pods,team};
}
async function readBuffer(blob){const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));return {buffer:Buffer.concat(chunks),etag:r.etag||null,contentType:r.contentType||r._response&&r._response.headers&&r._response.headers.get&&r._response.headers.get('content-type')||''}}
async function readJson(blob){try{const r=await readBuffer(blob);return {value:r.buffer.length?JSON.parse(r.buffer.toString('utf8')):null,etag:r.etag}}catch(e){if(e&&e.statusCode===404)return {value:null,etag:null};throw e}}
async function writeJson(blob,value,etag){const raw=JSON.stringify(value),conditions=etag?{ifMatch:etag}:{ifNoneMatch:'*'};return blob.upload(raw,Buffer.byteLength(raw),{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions})}
function recordBlob(records,token){return records.getBlockBlobClient('records/'+String(token).toLowerCase()+'.json')}
async function getRecord(token){if(!validToken(token))throw err('INVALID_TOKEN','Ungültiger QR-Code.',404);const c=await clients(),blob=recordBlob(c.records,token),r=await readJson(blob);if(!r.value)throw err('NOT_FOUND','QR-Code nicht gefunden.',404);return {clients:c,blob,record:r.value,etag:r.etag}}
async function mutateRecord(token,fn){for(let i=0;i<MAX_RETRIES;i++){const got=await getRecord(token),next=await fn(clone(got.record),got.clients);try{await writeJson(got.blob,next,got.etag);return next}catch(e){if(e&&e.statusCode===412&&i<MAX_RETRIES-1)continue;throw e}}throw err('CONFLICT','Datensatz konnte wegen eines Konflikts nicht gespeichert werden.',409)}
function expired(r){return r.expiresAt&&Date.now()>Date.parse(r.expiresAt)}
function publicRecord(r){return {ok:true,status:r.status||'open',reference:r.reference||'',customer:r.customer||'',recipient:r.recipient||'',shipmentId:r.shipmentId||'',createdAt:r.createdAt||null,expiresAt:r.expiresAt||null,confirmedAt:r.confirmedAt||null,podFiles:(Array.isArray(r.podFiles)?r.podFiles:[]).map(f=>({id:f.id,name:f.name,type:f.type,size:f.size,uploadedAt:f.uploadedAt,url:'/api/pickup-pod?token='+encodeURIComponent(r.token)+'&file='+encodeURIComponent(f.id)}))}}
async function updateTeam(record,podsToAdd=[]){
  const c=await clients(),blob=c.team.getBlockBlobClient(TEAM_BLOB);
  for(let i=0;i<MAX_RETRIES;i++){
    const d=await readJson(blob),doc=d.value||{schemaVersion:2,revision:0,updatedAt:null,updatedBy:null,state:{},users:[]};
    doc.state=doc.state||{};doc.state.shipments=Array.isArray(doc.state.shipments)?doc.state.shipments:[];doc.state.tasks=Array.isArray(doc.state.tasks)?doc.state.tasks:[];
    const ref=String(record.reference||'').trim().toUpperCase(),sid=String(record.shipmentId||'').trim();
    const sh=doc.state.shipments.find(x=>(sid&&String(x.id||x.shipmentId||'')===sid)||(ref&&String(x.ref||'').trim().toUpperCase()===ref));
    if(sh){
      const iso=record.confirmedAt||now(),day=iso.slice(0,10),dt=new Date(iso);
      sh.actualPickupDate=day;sh.pickedUpAtDate=day;sh.actualPickupTime=isNaN(dt)?'':dt.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});sh.pickedUpAt=iso;sh.pickupStatus='abgeholt';sh.status='erledigt';sh.done=true;sh.completedAt=iso;sh.pickupQrUsed=true;sh.pickupQrUsedAt=iso;sh._syncUpdatedAt=iso;sh._syncDeviceId='qr-pickup';
      if(podsToAdd.length){const all=[...(Array.isArray(sh.podFiles)?sh.podFiles:[])];for(const p of podsToAdd){const url='/api/pickup-pod?token='+encodeURIComponent(record.token)+'&file='+encodeURIComponent(p.id);if(!all.some(x=>x.remoteId===p.id||x.url===url))all.push({name:p.name,filename:p.name,url,uploadedAt:p.uploadedAt,remote:true,remoteId:p.id,mimeType:p.type,size:p.size})}sh.podFiles=all;sh.podStatus='POD vorhanden'}
    }
    for(const t of doc.state.tasks){if(String(t.area||'').toLowerCase()==='abholtag'&&((sid&&String(t.linkedShipmentId||'')===sid)||(ref&&String(t.linkedShipmentRef||'').toUpperCase()===ref))){t.status='erledigt';t.done=true;t.completedAt=record.confirmedAt||now();t._syncUpdatedAt=record.confirmedAt||now();t._syncDeviceId='qr-pickup'}}
    doc.revision=Number(doc.revision||0)+1;doc.updatedAt=now();doc.updatedBy='QR-Abholscan';doc.updatedByDevice='qr-pickup';doc.clientVersion='RC453';
    try{await writeJson(blob,doc,d.etag);return doc}catch(e){if(e&&e.statusCode===412&&i<MAX_RETRIES-1)continue;throw e}
  }
}
module.exports={RECORD_CONTAINER,POD_CONTAINER,TEAM_CONTAINER,TEAM_BLOB,clients,connectionString,hash,safeEqualHex,validToken,json,body,principal,actor,err,now,clone,readBuffer,readJson,writeJson,recordBlob,getRecord,mutateRecord,expired,publicRecord,updateTeam};
