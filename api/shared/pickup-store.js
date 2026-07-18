
'use strict';
const crypto = require('crypto');
const { createBlobServiceClient } = require('./blob-rest');

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
function safeName(v){return String(v||'POD').replace(/[^a-zA-Z0-9._ -]/g,'_').replace(/\s+/g,'_').slice(0,100)}

async function clients(){
  const cs=connectionString();
  if(!cs)throw err('STORAGE_NOT_CONFIGURED','App-Einstellung EXPORTHUB_STORAGE_CONNECTION_STRING fehlt.',503);
  const service=createBlobServiceClient(cs);
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
function publicRecord(r){return {ok:true,status:r.status||'open',reference:r.reference||'',customer:r.customer||'',recipient:r.recipient||'',shipmentId:r.shipmentId||'',createdAt:r.createdAt||null,expiresAt:r.expiresAt||null,confirmedAt:r.confirmedAt||null,credentialVersion:Number(r.credentialVersion||0),pinRevision:Number(r.pinRevision||0),pinLocked:Boolean(r.pinLocked),podCount:Array.isArray(r.podFiles)?r.podFiles.length:0,podFiles:(Array.isArray(r.podFiles)?r.podFiles:[]).map(f=>({id:f.id,name:f.name,type:f.type,size:f.size,uploadedAt:f.uploadedAt,kind:f.kind||'',url:'/api/pickup-pod?token='+encodeURIComponent(r.token)+'&file='+encodeURIComponent(f.id)}))}}
function stampSyncFields(record,fields,updatedAt,deviceId){if(!record||typeof record!=='object')return record;const iso=updatedAt||now(),device=deviceId||'server';record._syncFields=record._syncFields&&typeof record._syncFields==='object'?record._syncFields:{};for(const field of fields)record._syncFields[field]={updatedAt:iso,deviceId:device};record._syncUpdatedAt=iso;record._syncDeviceId=device;return record}

function pdfEscape(s){return String(s||'').replace(/[^\x20-\x7E]/g,' ').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}
function makePdf(objects){let parts=[Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n','binary')],offsets=[0],length=parts[0].length;for(let i=0;i<objects.length;i++){offsets[i+1]=length;const head=Buffer.from(`${i+1} 0 obj\n`,'ascii'),obj=Buffer.isBuffer(objects[i])?objects[i]:Buffer.from(String(objects[i]),'binary'),tail=Buffer.from('\nendobj\n','ascii');parts.push(head,obj,tail);length+=head.length+obj.length+tail.length}const xref=length;let table=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)table+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';table+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;parts.push(Buffer.from(table,'ascii'));return Buffer.concat(parts)}
function streamObject(dict,data){const b=Buffer.isBuffer(data)?data:Buffer.from(String(data),'binary');return Buffer.concat([Buffer.from(`<< ${dict} /Length ${b.length} >>\nstream\n`,'ascii'),b,Buffer.from('\nendstream','ascii')])}
function confirmationPdf(r){const lines=['ExportHUB POD - Abholscan','',`Referenz: ${r.reference||''}`,`Kunde: ${r.customer||r.recipient||''}`,`Abholung bestaetigt: ${r.confirmedAt||''}`,`Sendungs-ID: ${r.shipmentId||''}`,'','Dieser einmalige QR-Abholscan gilt als POD-Nachweis.'];let y=790,cmd=['BT','/F1 19 Tf',`50 ${y} Td`];lines.forEach((line,i)=>{if(i===1){cmd.push('0 -18 Td');return}cmd.push(`(${pdfEscape(line)}) Tj`);cmd.push(`0 -${i===0?34:25} Td`)});cmd.push('ET');const content=Buffer.from(cmd.join('\n'),'ascii');return makePdf(['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',streamObject('',content)])}
function jpegInfo(buf){if(!Buffer.isBuffer(buf)||buf.length<4||buf[0]!==0xff||buf[1]!==0xd8)throw err('INVALID_IMAGE','Ungültiges JPEG-Bild.',400);let i=2;while(i<buf.length-9){if(buf[i]!==0xff){i++;continue}while(buf[i]===0xff)i++;const marker=buf[i++];if(marker===0xd8||marker===0xd9)continue;if(i+2>buf.length)break;const len=buf.readUInt16BE(i);if(len<2||i+len>buf.length)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){const height=buf.readUInt16BE(i+3),width=buf.readUInt16BE(i+5),components=buf[i+7];return {width,height,components}}i+=len}throw err('INVALID_IMAGE','JPEG-Abmessungen konnten nicht gelesen werden.',400)}
function imagesPdf(images){if(!images.length)throw err('NO_IMAGES','Keine Bilder für PDF vorhanden.',400);const objects=[],kids=[];objects.push('<< /Type /Catalog /Pages 2 0 R >>');objects.push('');images.forEach((item,idx)=>{const info=jpegInfo(item.buffer),pageId=3+idx*3,contentId=pageId+1,imageId=pageId+2,k='Im'+(idx+1),maxW=523,maxH=770,scale=Math.min(maxW/info.width,maxH/info.height),w=Math.max(1,info.width*scale),h=Math.max(1,info.height*scale),x=(595-w)/2,y=(842-h)/2,color=info.components===1?'/DeviceGray':info.components===4?'/DeviceCMYK':'/DeviceRGB';kids.push(`${pageId} 0 R`);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /${k} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);objects.push(streamObject('',Buffer.from(`q\n${w.toFixed(3)} 0 0 ${h.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm\n/${k} Do\nQ`,'ascii')));objects.push(streamObject(`/Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace ${color} /BitsPerComponent 8 /Filter /DCTDecode`,item.buffer))});objects[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;return makePdf(objects)}
async function createConfirmationPod(record){const existing=(Array.isArray(record.podFiles)?record.podFiles:[]).find(x=>x.kind==='scan-confirmation');if(existing)return existing;const c=await clients(),id=crypto.randomBytes(12).toString('hex'),ref=safeName(record.reference||record.shipmentId||'Sendung'),name=`POD_Abholscan_${ref}.pdf`,blobName=String(record.token).toLowerCase()+'/'+id+'.pdf',pdf=confirmationPdf(record),blob=c.pods.getBlockBlobClient(blobName);await blob.uploadData(pdf,{blobHTTPHeaders:{blobContentType:'application/pdf'},metadata:{token:String(record.token),reference:String(record.reference||''),kind:'scan-confirmation'}});return {id,name,type:'application/pdf',size:pdf.length,uploadedAt:now(),blobName,kind:'scan-confirmation'}}

async function updateTeam(record,podsToAdd=[]){
  const c=await clients(),blob=c.team.getBlockBlobClient(TEAM_BLOB);
  for(let i=0;i<MAX_RETRIES;i++){
    const d=await readJson(blob),doc=d.value||{schemaVersion:3,revision:0,updatedAt:null,updatedBy:null,state:{},users:[]};
    doc.state=doc.state||{};doc.state.shipments=Array.isArray(doc.state.shipments)?doc.state.shipments:[];doc.state.tasks=Array.isArray(doc.state.tasks)?doc.state.tasks:[];
    const ref=String(record.reference||'').trim().toUpperCase(),sid=String(record.shipmentId||'').trim();
    const sh=doc.state.shipments.find(x=>(sid&&String(x.id||x.shipmentId||'')===sid)||(ref&&String(x.ref||'').trim().toUpperCase()===ref));
    if(!sh)throw err('SHIPMENT_NOT_FOUND','Die zugehörige Sendung wurde nicht gefunden.',404);
    const iso=record.confirmedAt||now(),day=iso.slice(0,10),dt=new Date(iso);
    sh.actualPickupDate=day;sh.pickedUpAtDate=day;sh.actualPickupTime=isNaN(dt)?'':dt.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});sh.pickedUpAt=iso;sh.pickupStatus='abgeholt';sh.processStatus='Abgeholt';sh.status='Abgeholt';sh.done=false;sh.completedAt='';sh.pickupQrUsed=true;sh.pickupQrUsedAt=iso;sh.podScanConfirmed=true;
    const changedFields=['actualPickupDate','pickedUpAtDate','actualPickupTime','pickedUpAt','pickupStatus','processStatus','status','done','completedAt','pickupQrUsed','pickupQrUsedAt','podScanConfirmed'];
    if(podsToAdd.length){const all=[...(Array.isArray(sh.podFiles)?sh.podFiles:[])];for(const p of podsToAdd){const url='/api/pickup-pod?token='+encodeURIComponent(record.token)+'&file='+encodeURIComponent(p.id);if(!all.some(x=>x.remoteId===p.id||x.url===url))all.push({id:'QR-'+p.id,name:p.name,filename:p.name,url,uploadedAt:p.uploadedAt,added:p.uploadedAt,remote:true,remoteId:p.id,mimeType:p.type,type:p.type,size:p.size,source:'QR',kind:p.kind||''})}sh.podFiles=all;sh.podStatus='Scan bestätigt – POD-Dokument fehlt';sh.podCount=all.length;changedFields.push('podFiles','podStatus','podCount')}
    stampSyncFields(sh,changedFields,iso,'qr-pickup');
    for(const t of doc.state.tasks){if(String(t.area||'').toLowerCase()==='abholtag'&&((sid&&String(t.linkedShipmentId||'')===sid)||(ref&&String(t.linkedShipmentRef||'').toUpperCase()===ref))){t.status='erledigt';t.done=true;t.completedAt=iso;stampSyncFields(t,['status','done','completedAt'],iso,'qr-pickup')}}
    doc.revision=Number(doc.revision||0)+1;doc.updatedAt=now();doc.updatedBy='QR-Abholscan';doc.updatedByDevice='qr-pickup';doc.clientVersion='RC538';
    try{await writeJson(blob,doc,d.etag);return doc}catch(e){if(e&&e.statusCode===412&&i<MAX_RETRIES-1)continue;throw e}
  }
}
module.exports={RECORD_CONTAINER,POD_CONTAINER,TEAM_CONTAINER,TEAM_BLOB,clients,connectionString,hash,safeEqualHex,validToken,json,body,principal,actor,err,now,clone,readBuffer,readJson,writeJson,recordBlob,getRecord,mutateRecord,expired,publicRecord,stampSyncFields,updateTeam,safeName,confirmationPdf,imagesPdf,createConfirmationPod};
