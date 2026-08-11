
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
function safeName(v){return String(v||'POD').replace(/[^a-zA-Z0-9._ -]/g,'_').replace(/\s+/g,'_').slice(0,100)}
function first(body,names){for(const name of names){const v=body&&body[name];if(v!==undefined&&v!==null&&String(v).trim()!=='')return v}return ''}
function sanitizeText(v,max=180){return String(v==null?'':v).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max)}
function signatureUrl(record){return record&&record.signatureBlobName?'/api/pickup-pod?token='+encodeURIComponent(record.token)+'&signature=1':''}
function realPodFiles(record){return (Array.isArray(record&&record.podFiles)?record.podFiles:[]).filter(f=>String(f&&f.kind||'').toLowerCase()!=='scan-confirmation')}

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

function parseSignature(dataUrl){
  const value=String(dataUrl||''),m=value.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
  if(!m)throw err('SIGNATURE_REQUIRED','Die digitale Unterschrift ist Pflicht.',400);
  const type=m[1].toLowerCase()==='jpg'?'jpeg':m[1].toLowerCase(),buffer=Buffer.from(m[2].replace(/\s+/g,''),'base64');
  if(buffer.length<100)throw err('INVALID_SIGNATURE','Die digitale Unterschrift ist leer oder ungültig.',400);
  if(buffer.length>2*1024*1024)throw err('SIGNATURE_TOO_LARGE','Die digitale Unterschrift ist zu groß.',413);
  if(type==='jpeg'&&!(buffer[0]===0xff&&buffer[1]===0xd8))throw err('INVALID_SIGNATURE','Die JPEG-Unterschrift ist beschädigt.',400);
  if(type==='png'&&!(buffer[0]===0x89&&buffer[1]===0x50&&buffer[2]===0x4e&&buffer[3]===0x47))throw err('INVALID_SIGNATURE','Die PNG-Unterschrift ist beschädigt.',400);
  return {buffer,type:'image/'+type,extension:type==='jpeg'?'jpg':type};
}
async function saveDriverSignature(c,record,dataUrl){
  const parsed=parseSignature(dataUrl),blobName=String(record.token).toLowerCase()+'/driver-signature.'+parsed.extension,blob=c.pods.getBlockBlobClient(blobName);
  await blob.uploadData(parsed.buffer,{overwrite:true,blobHTTPHeaders:{blobContentType:parsed.type,blobCacheControl:'no-store'},metadata:{token:String(record.token),reference:String(record.reference||''),kind:'driver-signature'}});
  return {signatureBlobName:blobName,signatureType:parsed.type,signatureSize:parsed.buffer.length,signatureStoredAt:now()};
}
function publicRecord(r){
  const files=realPodFiles(r),url=signatureUrl(r),available=!!url,carrier=sanitizeText(first(r,['carrierName','speditionName','carrier','spedition']),180),expected=Math.max(0,Math.round(Number(first(r,['expectedColliCount','totalColli','colliCount','packageCount']))||0)),entered=Math.max(0,Math.round(Number(first(r,['enteredColliCount','confirmedColliCount','pickupColliCount']))||0)),colliOk=r.colliCountConfirmed===true||r.colliConfirmed===true||r.pickupColliCountConfirmed===true;
  return {ok:true,status:r.status||'open',reference:r.reference||'',customer:r.customer||'',recipient:r.recipient||'',address:r.address||'',locationName:r.locationName||'',shipmentId:r.shipmentId||'',palletOut:Math.max(0,Number(r.palletOut||0)||0),carrierName:carrier,speditionName:carrier,carrier:carrier,spedition:carrier,expectedColliCount:expected,colliCount:expected,totalColli:expected,packageCount:expected,enteredColliCount:entered,colliCountConfirmed:colliOk,colliConfirmed:colliOk,pickupColliCountConfirmed:colliOk,createdAt:r.createdAt||null,expiresAt:r.expiresAt||null,confirmedAt:r.confirmedAt||null,driverName:r.driverName||'',pickupDriverName:r.driverName||'',licensePlate:r.licensePlate||'',vehicleLicensePlate:r.licensePlate||'',kennzeichen:r.licensePlate||'',loaderName:r.loaderName||'',loadedBy:r.loaderName||'',loader:r.loaderName||'',verlader:r.loaderName||'',signatureAvailable:available,driverSignatureAvailable:available,driverSignatureUrl:url,pickupSignatureUrl:url,podType:available?'signed-loadlist':'',podStatus:available?'POD vorhanden':'Unterschrift fehlt',podCount:(available?1:0)+files.length,podFiles:files.map(f=>({id:f.id,name:f.name,type:f.type,size:f.size,uploadedAt:f.uploadedAt,kind:f.kind||'',url:'/api/pickup-pod?token='+encodeURIComponent(r.token)+'&file='+encodeURIComponent(f.id)}))};
}

function pdfEscape(s){return String(s||'').replace(/[^\x20-\x7E]/g,' ').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}
function makePdf(objects){let parts=[Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n','binary')],offsets=[0],length=parts[0].length;for(let i=0;i<objects.length;i++){offsets[i+1]=length;const head=Buffer.from(`${i+1} 0 obj\n`,'ascii'),obj=Buffer.isBuffer(objects[i])?objects[i]:Buffer.from(String(objects[i]),'binary'),tail=Buffer.from('\nendobj\n','ascii');parts.push(head,obj,tail);length+=head.length+obj.length+tail.length}const xref=length;let table=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)table+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';table+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;parts.push(Buffer.from(table,'ascii'));return Buffer.concat(parts)}
function streamObject(dict,data){const b=Buffer.isBuffer(data)?data:Buffer.from(String(data),'binary');return Buffer.concat([Buffer.from(`<< ${dict} /Length ${b.length} >>\nstream\n`,'ascii'),b,Buffer.from('\nendstream','ascii')])}
function confirmationPdf(){throw err('LEGACY_SCAN_POD_DISABLED','Ein Scan ohne digitale Unterschrift ist kein POD. Die unterschriebene Ladeliste ist der POD.',409)}
function jpegInfo(buf){if(!Buffer.isBuffer(buf)||buf.length<4||buf[0]!==0xff||buf[1]!==0xd8)throw err('INVALID_IMAGE','Ungültiges JPEG-Bild.',400);let i=2;while(i<buf.length-9){if(buf[i]!==0xff){i++;continue}while(buf[i]===0xff)i++;const marker=buf[i++];if(marker===0xd8||marker===0xd9)continue;if(i+2>buf.length)break;const len=buf.readUInt16BE(i);if(len<2||i+len>buf.length)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){const height=buf.readUInt16BE(i+3),width=buf.readUInt16BE(i+5),components=buf[i+7];return {width,height,components}}i+=len}throw err('INVALID_IMAGE','JPEG-Abmessungen konnten nicht gelesen werden.',400)}
function imagesPdf(images){if(!images.length)throw err('NO_IMAGES','Keine Bilder für PDF vorhanden.',400);const objects=[],kids=[];objects.push('<< /Type /Catalog /Pages 2 0 R >>');objects.push('');images.forEach((item,idx)=>{const info=jpegInfo(item.buffer),pageId=3+idx*3,contentId=pageId+1,imageId=pageId+2,k='Im'+(idx+1),maxW=523,maxH=770,scale=Math.min(maxW/info.width,maxH/info.height),w=Math.max(1,info.width*scale),h=Math.max(1,info.height*scale),x=(595-w)/2,y=(842-h)/2,color=info.components===1?'/DeviceGray':info.components===4?'/DeviceCMYK':'/DeviceRGB';kids.push(`${pageId} 0 R`);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /${k} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);objects.push(streamObject('',Buffer.from(`q\n${w.toFixed(3)} 0 0 ${h.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm\n/${k} Do\nQ`,'ascii')));objects.push(streamObject(`/Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace ${color} /BitsPerComponent 8 /Filter /DCTDecode`,item.buffer))});objects[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;return makePdf(objects)}
async function createConfirmationPod(){throw err('LEGACY_SCAN_POD_DISABLED','Ein Scan ohne digitale Unterschrift ist kein POD. Die unterschriebene Ladeliste ist der POD.',409)}

async function updateTeam(record,podsToAdd=[]){
  const c=await clients(),blob=c.team.getBlockBlobClient(TEAM_BLOB);
  for(let i=0;i<MAX_RETRIES;i++){
    const d=await readJson(blob),doc=d.value||{schemaVersion:2,revision:0,updatedAt:null,updatedBy:null,state:{},users:[]};
    doc.state=doc.state||{};doc.state.shipments=Array.isArray(doc.state.shipments)?doc.state.shipments:[];doc.state.tasks=Array.isArray(doc.state.tasks)?doc.state.tasks:[];
    const ref=String(record.reference||'').trim().toUpperCase(),sid=String(record.shipmentId||'').trim(),sigUrl=signatureUrl(record),hasSignature=!!sigUrl;
    const sh=doc.state.shipments.find(x=>(sid&&String(x.id||x.shipmentId||'')===sid)||(ref&&String(x.ref||'').trim().toUpperCase()===ref));
    if(sh){
      const iso=record.confirmedAt||now(),day=iso.slice(0,10),dt=new Date(iso);
      sh.actualPickupDate=day;sh.pickedUpAtDate=day;sh.actualPickupTime=isNaN(dt)?'':dt.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});sh.pickedUpAt=iso;sh.pickupConfirmedAt=iso;sh.pickupStatus='abgeholt';sh.pickupQrUsed=true;sh.pickupQrUsedAt=iso;sh.qrPickupConfirmed=true;sh._syncUpdatedAt=iso;sh._syncDeviceId='qr-pickup';
      sh.pickupDriverName=record.driverName||'';sh.driverName=record.driverName||'';sh.pickupLicensePlate=record.licensePlate||'';sh.licensePlate=record.licensePlate||'';sh.vehicleLicensePlate=record.licensePlate||'';sh.kennzeichen=record.licensePlate||'';sh.loaderName=record.loaderName||'';sh.loadedBy=record.loaderName||'';sh.loader=record.loaderName||'';sh.verlader=record.loaderName||'';var carrier=sanitizeText(first(record,['carrierName','speditionName','carrier','spedition']),180),expected=Math.max(0,Math.round(Number(first(record,['expectedColliCount','totalColli','colliCount','packageCount']))||0)),entered=Math.max(0,Math.round(Number(first(record,['enteredColliCount','confirmedColliCount','pickupColliCount']))||0)),colliOk=record.colliCountConfirmed===true||record.colliConfirmed===true||record.pickupColliCountConfirmed===true;if(carrier){sh.carrier=carrier;sh.carrierName=carrier;sh.spedition=carrier;sh.speditionName=carrier}sh.expectedColliCount=expected;sh.pickupColliCount=expected;sh.enteredColliCount=entered;sh.colliCountConfirmed=colliOk;sh.pickupColliCountConfirmed=colliOk;
      sh.driverSignatureUrl=sigUrl;sh.pickupDriverSignatureUrl=sigUrl;sh.signatureAvailable=hasSignature;sh.podFiles=(Array.isArray(sh.podFiles)?sh.podFiles:[]).filter(x=>String(x&&x.kind||'').toLowerCase()!=='scan-confirmation');
      if(podsToAdd.length){const all=[...sh.podFiles];for(const p of podsToAdd.filter(x=>String(x&&x.kind||'').toLowerCase()!=='scan-confirmation')){const url='/api/pickup-pod?token='+encodeURIComponent(record.token)+'&file='+encodeURIComponent(p.id);if(!all.some(x=>x.remoteId===p.id||x.url===url))all.push({id:'QR-'+p.id,name:p.name,filename:p.name,url,uploadedAt:p.uploadedAt,added:p.uploadedAt,remote:true,remoteId:p.id,mimeType:p.type,type:p.type,size:p.size,source:'QR',kind:p.kind||''})}sh.podFiles=all}
      if(hasSignature){sh.podStatus='POD vorhanden';sh.podAvailable=true;sh.podConfirmed=true;sh.podScanConfirmed=true;sh.podDocumentType='signed-loadlist';sh.podDisplayName='Ladeliste mit Unterschrift';sh.status='POD vorhanden';sh.processStatus='POD vorhanden'}
      else{sh.podStatus='Unterschrift fehlt';sh.podAvailable=false;sh.podConfirmed=false;sh.podScanConfirmed=false;if(String(sh.status||'').toLowerCase().includes('pod'))sh.status='Abgeholt';if(String(sh.processStatus||'').toLowerCase().includes('pod'))sh.processStatus='Abgeholt'}
      sh.podCount=(hasSignature?1:0)+sh.podFiles.length;
    }
    for(const t of doc.state.tasks){if(String(t.area||'').toLowerCase()==='abholtag'&&((sid&&String(t.linkedShipmentId||'')===sid)||(ref&&String(t.linkedShipmentRef||'').toUpperCase()===ref))){t.status='erledigt';t.done=true;t.completedAt=record.confirmedAt||now();t._syncUpdatedAt=record.confirmedAt||now();t._syncDeviceId='qr-pickup'}}
    doc.revision=Number(doc.revision||0)+1;doc.updatedAt=now();doc.updatedBy='QR-Abholscan';doc.updatedByDevice='qr-pickup';doc.clientVersion='RC610';
    try{await writeJson(blob,doc,d.etag);return doc}catch(e){if(e&&e.statusCode===412&&i<MAX_RETRIES-1)continue;throw e}
  }
}
module.exports={RECORD_CONTAINER,POD_CONTAINER,TEAM_CONTAINER,TEAM_BLOB,clients,connectionString,hash,safeEqualHex,validToken,json,body,principal,actor,err,now,clone,readBuffer,readJson,writeJson,recordBlob,getRecord,mutateRecord,expired,publicRecord,updateTeam,safeName,confirmationPdf,imagesPdf,createConfirmationPod,parseSignature,saveDriverSignature,signatureUrl,realPodFiles,first,sanitizeText};
