'use strict';

const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');

const TEAM_CONTAINER = process.env.EXPORTHUB_STORAGE_CONTAINER || process.env.EXPORTHUB_CONTAINER || 'exporthub-data';
const TEAM_BLOB_BASE = process.env.EXPORTHUB_STORAGE_BLOB || process.env.EXPORTHUB_STATE_BLOB || 'team-state.json';
const TEST_TEAM_BLOB = process.env.EXPORTHUB_TEST_STORAGE_BLOB || ('testservice/'+String(TEAM_BLOB_BASE||'team-state.json').replace(/^\/+/,''));
const MAX_RETRIES = 8;
const AVIS_SESSION_MS = 30 * 60 * 1000;
const SECURITY_VERSION = 2;

function text(v){ return String(v == null ? '' : v).trim(); }
function lower(v){ return text(v).toLowerCase(); }
function upper(v){ return text(v).toUpperCase(); }
function arr(v){ return Array.isArray(v) ? v : []; }
function obj(v){ return !!v && typeof v === 'object' && !Array.isArray(v); }
function num(v){ const n=Number(String(v==null?'':v).replace(',','.')); return Number.isFinite(n)?n:0; }
function now(){ return new Date().toISOString(); }
function error(code,message,status=400){ const e=new Error(message); e.code=code; e.status=status; return e; }
function json(status,body,headers={}){ return {status,headers:Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Cross-Origin-Resource-Policy':'same-origin','X-Robots-Tag':'noindex, nofollow, noarchive'},headers),body:JSON.stringify(body)}; }
function body(req){ if(req&&req.body&&typeof req.body==='object')return req.body; try{return JSON.parse(req&&req.body||'{}')}catch(_){return {}} }
function connectionString(){ return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || ''; }
function wait(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }
function isConflict(e){ return !!(e&&(Number(e.statusCode||e.status)===412||['ConditionNotMet','TargetConditionNotMet'].includes(String(e.code||'')))); }
function hash(v){ return crypto.createHash('sha256').update(String(v||'')).digest('hex'); }
function safeEqual(a,b){ const aa=Buffer.from(String(a||''),'utf8'),bb=Buffer.from(String(b||''),'utf8'); return aa.length===bb.length&&aa.length>0&&crypto.timingSafeEqual(aa,bb); }
function b64u(buf){ return Buffer.from(buf).toString('base64url'); }

function requestEvidence(req){ const h=req&&req.headers||{};return [h.origin,h.Origin,h.referer,h.Referer,h['x-forwarded-host'],h['X-Forwarded-Host'],h['x-original-host'],h['X-Original-Host'],h.host,h.Host].map(text).filter(Boolean).join(' '); }
function requestEnvironment(req,payload){
 const h=req&&req.headers||{},raw=lower(h['x-exporthub-environment']||h['X-ExportHUB-Environment']||(payload&&payload.environment)||''),origin=lower(h.origin||h.Origin||h.referer||h.Referer||''),originTest=/-testservice\./i.test(origin),originAzure=/\.azurestaticapps\.net(?:[:/]|$)/i.test(origin),originProd=originAzure&&!originTest;
 if(raw&&raw!=='production'&&raw!=='testservice')throw error('ENVIRONMENT_INVALID','Unbekannte ExportHUB-Datenumgebung.',400);
 if(originTest){if(raw&&raw!=='testservice')throw error('ENVIRONMENT_MISMATCH','Ein Testservice-Avis darf keine Produktionsdaten anfordern.',409);return'testservice'}
 if(originProd){if(raw&&raw!=='production')throw error('ENVIRONMENT_MISMATCH','Ein Produktions-Avis darf keine Testservice-Daten anfordern.',409);return'production'}
 if(raw)return raw;return /-testservice\./i.test(requestEvidence(req))?'testservice':'production';
}
async function blobClient(req,payload){
 const cs=connectionString();
 if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);
 const service=BlobServiceClient.fromConnectionString(cs),container=service.getContainerClient(TEAM_CONTAINER),environment=requestEnvironment(req,payload),blobName=environment==='testservice'?TEST_TEAM_BLOB:TEAM_BLOB_BASE;
 return {blob:container.getBlockBlobClient(blobName),environment,blobName};
}
async function readTeam(blob){
 try{
  const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));
  const raw=Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,'').trim();
  return {value:raw?JSON.parse(raw):{schemaVersion:3,revision:0,state:{}},etag:r.etag||null};
 }catch(e){ if(e&&e.statusCode===404)return {value:{schemaVersion:3,revision:0,state:{}},etag:null}; throw e; }
}
async function writeTeam(blob,value,etag){
 const raw=JSON.stringify(value);
 await blob.upload(raw,Buffer.byteLength(raw),{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions:etag?{ifMatch:etag}:{ifNoneMatch:'*'},metadata:{schema:String(value.schemaVersion||3),revision:String(value.revision||0),updatedepoch:String(Date.parse(value.updatedAt||'')||Date.now()),clientversion:String(value.clientVersion||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)}});
}
function sref(sh){ return upper(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.id||sh.shipmentId)); }
function sid(sh){ return text(sh&&(sh.id||sh.shipmentId||sh.uuid||sh.ref||sh.reference)); }
function avisToken(sh){ return text(sh&&(sh.customerAvisToken||sh.avisToken)); }
function avisEnabled(sh){ return !!(sh&&(sh.customerAvisEnabled===true||sh.avisEnabled===true)); }
function avisSecurityVersion(sh){ return Number(sh&&(sh.customerAvisSecurityVersion||sh.avisSecurityVersion)||0); }
function avisEnabledAt(sh){ return text(sh&&(sh.customerAvisEnabledAt||sh.avisEnabledAt)); }
function avisUsedAt(sh){ return text(sh&&(sh.customerAvisUsedAt||sh.avisUsedAt)); }
function sameShipment(a,b){ const ar=sref(a),br=sref(b),ai=sid(a),bi=sid(b); return !!((ar&&br&&ar===br)||(ai&&bi&&ai===bi)); }
function shipmentCopies(state){
 const out=[];function add(v){if(obj(v)&&out.indexOf(v)<0)out.push(v)}
 ['shipments','savedShipments','shipmentArchive','archivedShipments'].forEach(k=>arr(state&&state[k]).forEach(add));
 ['shipment','currentShipment','selectedShipment'].forEach(k=>add(state&&state[k]));
 return out;
}
function score(sh){
 if(!sh)return -1; let n=0;
 n+=arr(sh.rows).length*30+arr(sh.colli).length*20+arr(sh.deliveryFiles).length*12+arr(sh.podFiles).length*20+arr(sh.abdFiles).length*10+arr(sh.documents).length*8+arr(sh.generatedDocuments).length*4;
 ['customerName','recipientAddress','carrier','status','pickupConfirmedAt','plannedPickupDate','customerAvisPickupDate'].forEach(k=>{if(text(sh[k]))n+=5});
 if(avisEnabled(sh))n+=50;if(avisToken(sh))n+=50;return n;
}
function updatedStamp(sh){
 const raw=text(sh&&(sh.updatedAt||sh._syncUpdatedAt||sh.modifiedAt||sh.lastModifiedAt||sh.createdAt||sh.created));
 const ms=Date.parse(raw);return Number.isFinite(ms)?ms:0;
}
function eventStamp(v){ const ms=Date.parse(text(v));return Number.isFinite(ms)?ms:-1; }
function avisDisabledAt(sh){ return text(sh&&(sh.customerAvisAutoDisabledAt||sh.avisAutoDisabledAt||sh.customerAvisDisabledAt||sh.avisDisabledAt)); }
function newestCopy(state,anchor){
 if(!anchor)return null;
 const copies=findCopies(state,anchor).slice().sort((a,b)=>updatedStamp(b)-updatedStamp(a)||score(b)-score(a));
 return copies[0]||anchor;
}
function effectiveAvisCopy(state,anchor){
 if(!anchor)return null;
 const copies=findCopies(state,anchor),fresh=newestCopy(state,anchor)||anchor;
 let enabledSource=null,enabledMs=-1,disabledMs=-1;
 copies.forEach(sh=>{
  const dis=eventStamp(avisDisabledAt(sh));if(dis>disabledMs)disabledMs=dis;
  if(!avisEnabled(sh)||!avisToken(sh))return;
  let at=eventStamp(avisEnabledAt(sh));if(at<0)at=updatedStamp(sh);
  if(!enabledSource||at>enabledMs||(at===enabledMs&&avisSecurityVersion(sh)>avisSecurityVersion(enabledSource))){enabledSource=sh;enabledMs=at}
 });
 const out=Object.assign({},fresh);
 if(!enabledSource||enabledMs<=disabledMs){
  out.customerAvisEnabled=false;out.avisEnabled=false;out.customerAvisToken='';out.avisToken='';
  out.customerAvisSecurityVersion=0;out.avisSecurityVersion=0;return out;
 }
 const t=avisToken(enabledSource),v=avisSecurityVersion(enabledSource),at=avisEnabledAt(enabledSource);
 out.customerAvisEnabled=true;out.avisEnabled=true;out.customerAvisToken=t;out.avisToken=t;
 out.customerAvisSecurityVersion=v;out.avisSecurityVersion=v;out.customerAvisEnabledAt=at;out.avisEnabledAt=at;
 out.customerAvisDisabledAt='';out.avisDisabledAt='';out.customerAvisAutoDisabledAt='';out.avisAutoDisabledAt='';
 return out;
}
function tokenMatches(sh,token){ const a=Buffer.from(avisToken(sh)),b=Buffer.from(text(token));return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b); }
function findAnyByToken(state,token){
 const matches=shipmentCopies(state).filter(sh=>tokenMatches(sh,token)).sort((a,b)=>updatedStamp(b)-updatedStamp(a)||score(b)-score(a));
 for(const anchor of matches){const effective=effectiveAvisCopy(state,anchor);if(effective&&avisEnabled(effective)&&tokenMatches(effective,token))return effective}
 return null;
}
function findByTokenHash(state,tokenHash){
 const matches=shipmentCopies(state).filter(sh=>avisToken(sh)&&safeEqual(hash(avisToken(sh)),tokenHash)).sort((a,b)=>updatedStamp(b)-updatedStamp(a)||score(b)-score(a));
 for(const anchor of matches){const effective=effectiveAvisCopy(state,anchor);if(effective&&avisEnabled(effective)&&avisToken(effective)&&safeEqual(hash(avisToken(effective)),tokenHash))return effective}
 return null;
}
function assertSecureAvis(sh){
 if(!sh||!avisEnabled(sh))throw error('AVIS_DISABLED','Dieser Kunden-Avis-Link ist nicht mehr aktiv.',410);
 if(avisAutoExpired(sh))throw error('AVIS_AUTO_EXPIRED','Dieser Kunden-Avis wurde automatisch drei Arbeitstage nach der tatsächlichen Abholung deaktiviert. Samstag und Sonntag wurden nicht mitgerechnet.',410);
 if(avisSecurityVersion(sh)<SECURITY_VERSION||!avisEnabledAt(sh))throw error('AVIS_RENEW_REQUIRED','Dieser ältere Kunden-Avis-Link wurde aus Sicherheitsgründen ungültig. Bitte fordern Sie einen neuen Link an.',410);
 return true;
}
function assertUnusedAvis(sh){ return assertSecureAvis(sh); }
function resolveRawToken(state,token){ const sh=findAnyByToken(state,token);if(!sh)throw error('AVIS_INVALID','Dieser Kunden-Avis-Link ist ungültig oder nicht mehr aktiv.',410);assertSecureAvis(sh);return sh; }
function findCopies(state,target){ return shipmentCopies(state).filter(sh=>sameShipment(sh,target)); }
function rowsOf(sh){ const lists=[sh&&sh.rows,sh&&sh.colli,sh&&sh.collis,sh&&sh.packages,sh&&sh.packagingRows].filter(Array.isArray).sort((a,b)=>b.length-a.length); return lists[0]||[]; }
function dateTimeOf(sh){ return text(sh&&(sh.pickupConfirmedAt||sh.qrPickupConfirmedAt||sh.pickupCompletedAt||sh.pickedUpAt||sh.actualPickupAt||sh.actualPickupDate||sh.podServerVerifiedAt)); }
function berlinDateKey(value){
 const d=value instanceof Date?value:new Date(value);if(!Number.isFinite(d.getTime()))return'';
 try{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),o={};parts.forEach(p=>{o[p.type]=p.value});return o.year+'-'+o.month+'-'+o.day}catch(_){return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')}
}
function dateKey(value){ const raw=text(value),m=raw.match(/^(\d{4}-\d{2}-\d{2})/);if(m)return m[1];return raw?berlinDateKey(raw):''; }
function addBusinessDays(key,count){ const m=text(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return'';const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],12)),n=Math.max(0,Number(count)||0);let left=n;while(left>0){d.setUTCDate(d.getUTCDate()+1);const w=d.getUTCDay();if(w!==0&&w!==6)left--}return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0'); }
function avisAutoExpiresOn(sh){ const picked=dateKey(dateTimeOf(sh));return picked?addBusinessDays(picked,3):''; }
function avisAutoExpired(sh){ const expiry=avisAutoExpiresOn(sh);return !!(avisEnabled(sh)&&expiry&&berlinDateKey(new Date())>=expiry); }

function podAvailable(sh){
 if(!sh)return false;
 if(sh.podAvailable===true||sh.podConfirmed===true||sh.podServerVerified===true||sh.signatureAvailable===true||sh.driverSignatureAvailable===true)return true;
 if(text(sh.podCloudBackupWebUrl||sh.driverSignature||sh.pickupDriverSignature||sh.signatureDataUrl||sh.pickupSignature))return true;
 return arr(sh.podFiles).some(f=>obj(f)&&!f.placeholder&&!f.fallback&&!!fileSource(f));
}
function fileName(f,fallback){ return text(f&&(f.name||f.filename||f.fileName||f.title||f.label))||fallback||'Dokument'; }
function fileMime(f){ return text(f&&(f.mimeType||f.contentType||f.type))||'application/octet-stream'; }
function fileSource(f){ return text(f&&(f.data||f.dataUrl||f.content||f.url||f.downloadUrl||f.href||f.contentUrl)); }
function safeExternalUrl(raw){
 try{const u=new URL(raw);if(u.protocol!=='https:')return'';const h=u.hostname.toLowerCase();if(/(^|\.)sharepoint\.com$/.test(h)||/(^|\.)blob\.core\.windows\.net$/.test(h)||h==='1drv.ms')return u.href;return''}catch(_){return''}
}
function parseDataUrl(raw,mimeHint){
 if(!/^data:/i.test(raw))return null;const p=raw.indexOf(',');if(p<0)return null;const meta=raw.slice(5,p),payload=raw.slice(p+1),parts=meta.split(';'),mime=text(parts[0])||mimeHint||'application/octet-stream',is64=parts.some(x=>lower(x)==='base64');try{return {mime,bytes:is64?Buffer.from(payload,'base64'):Buffer.from(decodeURIComponent(payload),'utf8')}}catch(_){return null}
}
function docCategory(key){ if(/pod/i.test(key))return'POD';if(/abd/i.test(key))return'ABD';if(/delivery|lieferschein|dnc/i.test(key))return'Lieferschein';if(/invoice/i.test(key))return'Rechnung';return'Dokument'; }
function documentRecords(sh){
 const keys=['deliveryFiles','deliveryNotesFiles','lieferscheine','documents','files','attachments','abdFiles','invoiceFiles','mailAttachments','podFiles'],out=[],seen=new Set();
 keys.forEach(key=>arr(sh&&sh[key]).forEach((f,i)=>{if(!obj(f))return;const raw=fileSource(f),name=fileName(f,key+' '+(i+1)),mime=fileMime(f),inline=parseDataUrl(raw,mime),external=safeExternalUrl(raw);if(!inline&&!external)return;const signature=[key,text(f.id),name,text(f.size),raw.slice(0,80)].join('|'),id=crypto.createHash('sha256').update(signature).digest('hex').slice(0,24),dedupe=(name+'|'+text(f.size)+'|'+raw.slice(0,120)).toLowerCase();if(seen.has(dedupe))return;seen.add(dedupe);out.push({id,name,mime,size:inline?inline.bytes.length:Number(f.size||0)||0,category:docCategory(key),inline,external})}));
 const podUrl=safeExternalUrl(sh&&sh.podCloudBackupWebUrl);if(podUrl){const name=text(sh.podCloudBackupFileName)||('POD_'+(sref(sh)||'Sendung')+'.pdf'),id=crypto.createHash('sha256').update('pod-cloud|'+podUrl).digest('hex').slice(0,24);if(!out.some(d=>d.external===podUrl))out.push({id,name,mime:'application/pdf',size:0,category:'POD',external:podUrl,inline:null})}
 if(!out.some(d=>d.category==='POD')){
  const sigRaw=text(sh&&(sh.driverSignature||sh.pickupDriverSignature||sh.signatureDataUrl||sh.pickupSignature)),sig=parseDataUrl(sigRaw,'image/jpeg');
  if(sig&&/^image\/(?:jpeg|png|webp)$/i.test(sig.mime||'')){
   const ext=/png/i.test(sig.mime)?'png':/webp/i.test(sig.mime)?'webp':'jpg',name='POD_'+(sref(sh)||'Sendung')+'_Unterschrift.'+ext,id=crypto.createHash('sha256').update('pod-signature|'+hash(sigRaw)).digest('hex').slice(0,24);
   out.push({id,name,mime:sig.mime,size:sig.bytes.length,category:'POD',inline:sig,external:''});
  }
 }
 return out;
}
function sessionSecret(){
 const source=text(process.env.EXPORTHUB_AVIS_SIGNING_SECRET||process.env.EXPORTHUB_AUTH_SIGNING_SECRET)||connectionString();
 if(!source)throw error('AVIS_SIGNING_NOT_CONFIGURED','Die sichere Avis-Sitzung ist serverseitig nicht konfiguriert.',503);
 return crypto.createHash('sha256').update('ExportHUB/customer-avis/session/v2|'+source).digest();
}
function sessionSignature(encoded){ return crypto.createHmac('sha256',sessionSecret()).update(encoded).digest('base64url'); }
function issueSession(sh,rawToken){
 assertSecureAvis(sh);const exp=Date.now()+AVIS_SESSION_MS,payload={v:2,p:'customer-avis',th:hash(rawToken),ref:sref(sh),exp};
 const encoded=b64u(Buffer.from(JSON.stringify(payload),'utf8')),sig=sessionSignature(encoded);return {token:'av2.'+encoded+'.'+sig,expiresAt:new Date(exp).toISOString()};
}
function verifySession(raw){
 const parts=text(raw).split('.');if(parts.length!==3||parts[0]!=='av2')throw error('AVIS_SESSION_REQUIRED','Bitte bestätigen Sie die Referenz erneut.',401);
 const expected=sessionSignature(parts[1]);if(!safeEqual(expected,parts[2]))throw error('AVIS_SESSION_INVALID','Die Avis-Sitzung ist ungültig.',401);
 let p;try{p=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'))}catch(_){throw error('AVIS_SESSION_INVALID','Die Avis-Sitzung ist ungültig.',401)}
 if(!p||p.p!=='customer-avis'||Number(p.v)!==2||!p.th||!p.ref||Number(p.exp||0)<=Date.now())throw error('AVIS_SESSION_EXPIRED','Die Avis-Sitzung ist abgelaufen. Bitte erneut bestätigen.',401);
 return p;
}
function sessionFromRequest(req,payload){ const h=req&&req.headers||{};return text(h['x-exporthub-avis-session']||h['X-ExportHUB-Avis-Session']||(req.query&&req.query.session)||(payload&&payload.session)); }
function publicStatus(sh){
 const raw=text(sh&&(sh.status||sh.processStatus||sh.pickupStatus||sh.readinessStatus)),v=lower(raw);
 if(/storn|cancel/.test(v))return raw||'Storniert';
 if(/archiv/.test(v))return raw||'Archiviert';
 if(/abgeschlossen|completed|erledigt|done/.test(v)||sh&&((sh.completed===true)||(sh.completionConfirmed===true)||text(sh.completedAt)))return raw||'Abgeschlossen';
 if(podAvailable(sh))return /pod/i.test(raw)?raw:'POD vorhanden';
 if(dateTimeOf(sh))return /abgeholt|picked|pickup/.test(v)?raw:'Abgeholt';
 return raw||'Erstellt';
}
function pickupCarrierOf(sh){return text(sh&&(sh.pickupCarrierName||sh.pickupSpeditionName||sh.carrierName||sh.speditionName||sh.carrier||sh.spedition));}
function pickupPlateOf(sh){return text(sh&&(sh.pickupLicensePlate||sh.licensePlate||sh.vehicleLicensePlate||sh.kennzeichen));}
function pickupDriverOf(sh){return text(sh&&(sh.pickupDriverName||sh.driverName||sh.confirmedBy));}
function publicShipment(sh,session){
 const actual=dateTimeOf(sh);
 if(actual)return {ok:true,closed:true,status:'Abgeholt',actualPickupAt:actual,pickup:{carrier:pickupCarrierOf(sh),licensePlate:pickupPlateOf(sh),driverName:pickupDriverOf(sh)},avis:{enabled:true,closed:true,persistent:true,autoExpiresOn:avisAutoExpiresOn(sh),businessDaysAfterPickup:3,weekendsExcluded:true,securityVersion:SECURITY_VERSION},lastUpdatedAt:text(sh.updatedAt||sh._syncUpdatedAt||sh.modifiedAt||sh.lastModifiedAt)};
 const rows=rowsOf(sh).map((r,i)=>({position:i+1,type:text(r.type||r.packaging||r.verpackung),count:Math.max(0,Math.round(num(r.count||r.qty||r.anzahl))),weight:num(r.weight||r.gewicht),ldm:num(r.ldm||r.loadingMeter),length:num(r.l||r.length),width:num(r.w||r.width),height:num(r.h||r.height)}));
 const totals=rows.reduce((a,r)=>{a.count+=r.count;a.weight+=r.weight;a.ldm+=r.count*r.ldm;return a},{count:0,weight:0,ldm:0}),docs=documentRecords(sh).map(d=>({id:d.id,name:d.name,mime:d.mime,size:d.size,category:d.category,downloadUrl:'/api/customer-avis?action=document&id='+encodeURIComponent(d.id)+'&session='+encodeURIComponent(session)}));
 const planned=text(sh.customerAvisPickupDate||sh.avisPickupDate||sh.plannedPickupDate||sh.pickupDate),from=text(sh.customerAvisPickupTimeFrom||sh.avisPickupTimeFrom),to=text(sh.customerAvisPickupTimeTo||sh.avisPickupTimeTo);
 return {ok:true,reference:sref(sh),shipmentId:sid(sh),sender:{name:text(sh.senderName||(sh.sender&&sh.sender.name))||'Essentra Components GmbH',address:text(sh.senderAddress||(sh.sender&&[sh.sender.street,sh.sender.city,sh.sender.country].filter(Boolean).join(', ')))||'Montel-Allee 3, 41334 Nettetal, Deutschland'},customerName:text(sh.customerName||(sh.customer&&sh.customer.name)),customerNumber:text(sh.customerNumber||sh.customerAccount||sh.customerNo),customerReference:text(sh.customerReference||sh.customerRef||sh.orderReference||sh.purchaseOrder||sh.poNumber),salesOrder:text(sh.salesOrder||sh.salesOrderNumber||sh.orderNumber),recipientName:text(sh.recipientName||sh.destinationName),recipientAddress:text(sh.recipientAddress||sh.deliveryAddress||sh.destinationAddress),country:text(sh.recipientCountry||sh.country),shipDate:text(sh.shipDate||sh.shippingDate||sh.shipmentDate||sh.dispatchDate),incoterm:text(sh.incoterm||sh.incoterms),carrier:text(sh.carrier||sh.carrierName||sh.spedition),status:publicStatus(sh),goodsDescription:text(sh.goodsDescription||sh.description||sh.warenbeschreibung),rows,totals,documents:docs,appointment:{date:planned,timeFrom:from,timeTo:to,plate:text(sh.customerAvisPickupPlate||sh.avisPickupPlate),shipmentNumber:text(sh.customerAvisShipmentNumber||sh.avisShipmentNumber),note:text(sh.customerAvisPickupNote||sh.avisPickupNote),submittedAt:text(sh.customerAvisResponseAt||sh.avisResponseAt)},actualPickupAt:'',pod:{available:podAvailable(sh),status:text(sh.podStatus)||(podAvailable(sh)?'POD vorhanden':'Noch nicht vorhanden'),documents:docs.filter(d=>d.category==='POD')},avis:{enabled:true,enabledAt:avisEnabledAt(sh),usedAt:'',singleUse:false,persistent:true,autoExpiresOn:avisAutoExpiresOn(sh),businessDaysAfterPickup:3,weekendsExcluded:true,securityVersion:SECURITY_VERSION},lastUpdatedAt:text(sh.updatedAt||sh._syncUpdatedAt||sh.modifiedAt||sh.lastModifiedAt)};
}
function validateTime(v){ return !v||/^([01]\d|2[0-3]):[0-5]\d$/.test(v); }
function updateAvisShipmentNumberNote(existing,number){
 const label='Sendungsnummer (Lieferavis):',clean=text(number).replace(/[\r\n]+/g,' ').slice(0,120),lines=String(existing==null?'':existing).replace(/\r\n/g,'\n').split('\n').filter(line=>!/^\s*Sendungsnummer \(Lieferavis\):/i.test(line));
 if(clean)lines.push(label+' '+clean);return lines.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
function mutateAppointment(state,target,payload){
 const date=text(payload.pickupDate);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw error('PICKUP_DATE_REQUIRED','Bitte ein gültiges Abholdatum angeben.',400);
 const from=text(payload.timeFrom),to=text(payload.timeTo);if(!validateTime(from)||!validateTime(to))throw error('PICKUP_TIME_INVALID','Bitte eine gültige Uhrzeit angeben.',400);
 if(from&&to&&from>=to)throw error('PICKUP_TIME_INVALID','Das Ende des Zeitfensters muss nach dem Beginn liegen.',400);
 const plate=text(payload.plate).replace(/[\r\n]+/g,' ').slice(0,40),shipmentNumber=text(payload.shipmentNumber).replace(/[\r\n]+/g,' ').slice(0,120);if(!shipmentNumber)throw error('SHIPMENT_NUMBER_REQUIRED','Bitte die Sendungsnummer angeben.',400);
 const stamp=now(),baseValues={customerAvisPickupDate:date,avisPickupDate:date,customerAvisPickupTimeFrom:from,avisPickupTimeFrom:from,customerAvisPickupTimeTo:to,avisPickupTimeTo:to,customerAvisPickupPlate:plate,avisPickupPlate:plate,customerAvisShipmentNumber:shipmentNumber,avisShipmentNumber:shipmentNumber,customerAvisPickupContact:'',avisPickupContact:'',customerAvisPickupNote:text(payload.note).slice(0,1000),avisPickupNote:text(payload.note).slice(0,1000),customerAvisResponseAt:stamp,avisResponseAt:stamp,customerAvisResponseReference:sref(target),avisResponseReference:sref(target),customerAvisResponseStatus:'gemeldet',avisResponseStatus:'gemeldet',plannedPickupDate:date,pickupDate:date,updatedAt:stamp,_syncUpdatedAt:stamp};
 findCopies(state,target).forEach(sh=>{const note=updateAvisShipmentNumberNote(sh.overviewNote||sh.shipmentOverviewNote||'',shipmentNumber);Object.assign(sh,baseValues,{overviewNote:note,shipmentOverviewNote:note})}); return baseValues;
}
async function saveAppointment(blob,sessionPayload,session,payload){
 for(let attempt=0;attempt<MAX_RETRIES;attempt++){
  const d=await readTeam(blob),team=d.value||{},state=obj(team.state)?team.state:{},target=findByTokenHash(state,sessionPayload.th);if(!target)throw error('AVIS_DISABLED','Dieser Kunden-Avis-Link ist nicht mehr aktiv.',410);assertSecureAvis(target);if(sref(target)!==upper(sessionPayload.ref))throw error('AVIS_SESSION_INVALID','Die Avis-Sitzung ist ungültig.',401);if(dateTimeOf(target))throw error('AVIS_CLOSED','Der Lieferavis ist nach der Abholung geschlossen. Änderungen sind nicht mehr möglich.',410);
  mutateAppointment(state,target,payload);team.state=state;team.revision=Number(team.revision||0)+1;team.updatedAt=now();team.updatedBy='Kunden-Avis';team.updatedByUserId='customer-avis';team.clientVersion=text(team.clientVersion)||'customer-avis-v4';
  try{await writeTeam(blob,team,d.etag);const fresh=findByTokenHash(team.state,sessionPayload.th)||target;return publicShipment(fresh,session)}catch(e){if(isConflict(e)&&attempt<MAX_RETRIES-1){await wait(80+attempt*120);continue}throw e}
 }
 throw error('CONCURRENT_UPDATE','Die Abholmeldung konnte wegen einer gleichzeitigen Änderung noch nicht gespeichert werden. Bitte erneut versuchen.',409);
}
function contentDisposition(name){ const safe=text(name).replace(/[\r\n"\\]/g,'_').slice(0,180)||'Dokument'; return 'attachment; filename="'+safe.replace(/[^\x20-\x7E]/g,'_')+'"; filename*=UTF-8\'\''+encodeURIComponent(safe); }
async function persistAutoDisable(blob,loaded,target){
 if(!target||!avisAutoExpired(target))return false;
 const team=loaded.value||{},state=obj(team.state)?team.state:{},stamp=now(),expiry=avisAutoExpiresOn(target),values={customerAvisEnabled:false,avisEnabled:false,customerAvisToken:'',avisToken:'',customerAvisSecurityVersion:0,avisSecurityVersion:0,customerAvisExpiresAt:expiry,avisExpiresAt:expiry,customerAvisDisabledAt:stamp,avisDisabledAt:stamp,customerAvisAutoDisabledAt:stamp,avisAutoDisabledAt:stamp,customerAvisAutoDisabledReason:'3 Arbeitstage nach tatsächlicher Abholung',avisAutoDisabledReason:'3 business days after actual collection',updatedAt:stamp,_syncUpdatedAt:stamp};
 findCopies(state,target).forEach(sh=>Object.assign(sh,values));team.state=state;team.revision=Number(team.revision||0)+1;team.updatedAt=stamp;team.updatedBy='Kunden-Avis Auto-Ablauf';team.updatedByUserId='customer-avis';
 try{await writeTeam(blob,team,loaded.etag);return true}catch(e){if(!isConflict(e))throw e;return false}
}
async function authorizePersistent(blob,token,payload){
 const d=await readTeam(blob),team=d.value||{},state=obj(team.state)?team.state:{},sh=findAnyByToken(state,token),reference=upper(payload.reference);
 if(!sh)throw error('AVIS_INVALID','Dieser Kunden-Avis-Link ist ungültig oder nicht mehr aktiv.',410);
 if(avisAutoExpired(sh)){await persistAutoDisable(blob,d,sh);throw error('AVIS_AUTO_EXPIRED','Dieser Kunden-Avis wurde automatisch drei Arbeitstage nach der tatsächlichen Abholung deaktiviert. Samstag und Sonntag wurden nicht mitgerechnet.',410)}
 assertSecureAvis(sh);
 if(!reference||reference!==sref(sh)){await wait(350);throw error('AVIS_ACCESS_DENIED','Die Referenznummer ist nicht korrekt.',403)}
 const issued=issueSession(sh,token);
 return Object.assign({session:issued.token,sessionExpiresAt:issued.expiresAt},publicShipment(sh,issued.token));
}

module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{'Cache-Control':'no-store','Allow':'GET, POST, OPTIONS','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff'},body:''};return}
 try{
  const payload=body(req),storage=await blobClient(req,payload),blob=storage.blob;
  if(req.method==='POST'&&lower(payload.action)==='authorize'){
   const token=text(payload.token);if(!/^[A-Za-z0-9_-]{32,160}$/.test(token))throw error('TOKEN_REQUIRED','Der Kunden-Avis-Link ist ungültig.',400);
   context.res=json(200,await authorizePersistent(blob,token,payload));return;
  }
  const session=sessionFromRequest(req,payload),sessionPayload=verifySession(session),d=await readTeam(blob),state=obj(d.value&&d.value.state)?d.value.state:{},sh=findByTokenHash(state,sessionPayload.th);if(!sh)throw error('AVIS_DISABLED','Dieser Kunden-Avis-Link ist nicht mehr aktiv.',410);if(avisAutoExpired(sh)){await persistAutoDisable(blob,d,sh);throw error('AVIS_AUTO_EXPIRED','Dieser Kunden-Avis wurde automatisch drei Arbeitstage nach der tatsächlichen Abholung deaktiviert. Samstag und Sonntag wurden nicht mitgerechnet.',410)}assertSecureAvis(sh);if(sref(sh)!==upper(sessionPayload.ref))throw error('AVIS_SESSION_INVALID','Die Avis-Sitzung ist ungültig.',401);
  if(req.method==='GET'){
   const action=lower(req.query&&req.query.action);
   if(action==='document'){
    if(dateTimeOf(sh))throw error('AVIS_CLOSED','Der Lieferavis ist nach der Abholung geschlossen. Dokumente sind nicht mehr abrufbar.',410);
    const id=text(req.query&&req.query.id),doc=documentRecords(sh).find(x=>x.id===id);if(!doc)throw error('DOCUMENT_NOT_FOUND','Das Dokument ist nicht mehr verfügbar.',404);
    if(doc.inline){context.res={status:200,isRaw:true,headers:{'Content-Type':doc.inline.mime||doc.mime||'application/octet-stream','Content-Disposition':contentDisposition(doc.name),'Cache-Control':'private, no-store','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Cross-Origin-Resource-Policy':'same-origin','X-Robots-Tag':'noindex, nofollow, noarchive'},body:doc.inline.bytes};return}
    if(doc.external){context.res={status:302,headers:{Location:doc.external,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive'},body:''};return}
    throw error('DOCUMENT_NOT_FOUND','Das Dokument ist nicht mehr verfügbar.',404);
   }
   context.res=json(200,publicShipment(sh,session));return;
  }
  if(req.method==='POST'){
   const action=lower(payload.action||'appointment');if(action!=='appointment')throw error('UNKNOWN_ACTION','Unbekannte Avis-Aktion.',400);
   context.res=json(200,await saveAppointment(blob,sessionPayload,session,payload));return;
  }
  context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'GET, POST, OPTIONS'});
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('Customer avis API error',e&&e.code,e&&e.message)}catch(_){}
  context.res=json(e&&e.status?e.status:500,{ok:false,code:e&&e.code?e.code:'SERVER_ERROR',message:e&&e.message?e.message:'Der Kunden-Avis-Service ist momentan nicht verfügbar.'});
 }
};
