'use strict';
const fs=require('fs');

function replaceOnce(source,search,replacement,label){
  const count=source.split(search).length-1;
  if(count!==1)throw new Error(label+': erwartet 1 Treffer, gefunden '+count);
  return source.replace(search,replacement);
}

const storeFile='api/shared/pickup-store.js';
let src=fs.readFileSync(storeFile,'utf8');

const helpers=`function rc1017TeamPickupHistory(record){return pickupHistory(record).map(x=>({id:x.id||('pickup-'+(x.sequence||'')),sequence:Number(x.sequence||0)||0,type:x.type||(x.complete?'complete':'partial'),confirmedAt:x.confirmedAt||'',colliCount:Math.max(0,Math.round(Number(x.colliCount)||0)),collectedAfter:Math.max(0,Math.round(Number(x.collectedAfter)||0)),remainingAfter:Math.max(0,Math.round(Number(x.remainingAfter)||0)),complete:x.complete===true,driverName:x.driverName||'',licensePlate:x.licensePlate||'',loaderName:x.loaderName||'',loaderId:x.loaderId||'',carrierName:x.carrierName||'',returnedEuroPallets:Math.max(0,Math.round(Number(x.returnedEuroPallets)||0)),signatureBlobName:x.signatureBlobName||'',signatureStoredAt:x.signatureStoredAt||'',signatureStored:!!x.signatureBlobName}))}
function rc1017SubShipmentPicked(sub){if(!sub||typeof sub!=='object')return false;const status=String(sub.status||'').toLowerCase();if(/confirmed|pod|completed|abgeholt/.test(status))return true;if(String(sub.confirmedAt||'').trim())return true;const expected=expectedCollis(sub),remaining=pickupRemainingColliCount(sub),collected=pickupCollectedColliCount(sub);return expected>0&&remaining===0&&collected>=expected}
function rc1017SubShipmentHasPod(sub){if(!sub||typeof sub!=='object')return false;if(realPodFiles(sub).length)return true;if(String(sub.signatureBlobName||'').trim())return true;return pickupHistory(sub).some(x=>String(x&&x.signatureBlobName||'').trim())}
function aggregateShipmentFromSubs(sh){
 if(!sh||typeof sh!=='object')return sh;
 const subs=Array.isArray(sh.subShipments)?sh.subShipments:[];
 if(!subs.length)return sh;
 const picked=subs.filter(rc1017SubShipmentPicked).length,allPicked=picked===subs.length,anyActivity=subs.some(x=>x&&((x.locked===true)||pickupHistory(x).length||pickupCollectedColliCount(x)>0||rc1017SubShipmentPicked(x))),allPod=allPicked&&subs.every(rc1017SubShipmentHasPod);
 const expected=subs.reduce((n,x)=>n+expectedCollis(x),0),collected=subs.reduce((n,x)=>n+pickupCollectedColliCount(x),0),remaining=Math.max(0,expected-collected);
 sh.requiredTruckCount=Math.max(Number(sh.requiredTruckCount||0)||0,subs.length);sh.multiTruckLocked=subs.some(x=>x&&x.locked===true)||anyActivity;sh.expectedColliCount=expected;sh.collectedPickupCollis=collected;sh.pickupCollectedColliCount=collected;sh.remainingPickupCollis=remaining;sh.pickupRemainingColliCount=remaining;sh.pickupPartial=!allPicked&&anyActivity;
 if(allPicked){sh.status='Abgeholt';sh.processStatus='Abgeholt';sh.pickupStatus='abgeholt';sh.pickupQrUsed=true;sh.qrPickupConfirmed=true;const latest=subs.map(x=>Date.parse(x&&x.confirmedAt||'')||0).reduce((a,b)=>Math.max(a,b),0);if(latest){const iso=new Date(latest).toISOString();sh.pickedUpAt=iso;sh.pickupConfirmedAt=iso;sh.qrPickupConfirmedAt=iso;sh.actualPickupDate=iso.slice(0,10)}}
 else if(anyActivity){sh.status='Teilweise abgeholt';sh.processStatus='Teilweise abgeholt';sh.pickupStatus='teilweise abgeholt';sh.pickupQrUsed=false;sh.qrPickupConfirmed=false;sh.readyForPickup=true;sh.readinessStatus='Teilweise abgeholt'}
 if(allPod){sh.podAvailable=true;sh.podConfirmed=true;sh.podStatus='POD vorhanden'}else{sh.podAvailable=false;sh.podConfirmed=false;if(anyActivity)sh.podStatus=allPicked?'POD ausstehend':'Teilabholung dokumentiert'}
 return sh
}
function applyPickupRecordToShipment(sh,record){
 if(!sh||typeof sh!=='object')throw err('SHIPMENT_REQUIRED','Hauptsendung fehlt.',409);
 const subShipmentId=String(record&&record.subShipmentId||'').trim();if(!subShipmentId)return sh;
 const subs=Array.isArray(sh.subShipments)?sh.subShipments:[],target=subs.find(x=>String(x&&x.subShipmentId||'').trim()===subShipmentId);if(!target)throw err('SUBSHIPMENT_NOT_FOUND','Die LKW-Teilsendung wurde in der Hauptsendung nicht gefunden.',409);
 const history=rc1017TeamPickupHistory(record),complete=pickupComplete(record),collected=pickupCollectedColliCount(record),remaining=pickupRemainingColliCount(record),expected=expectedCollis(record),last=history.length?history[history.length-1]:null,iso=String(record.confirmedAt||record.lastPartialPickupAt||record.updatedAt||last&&last.confirmedAt||now());
 target.pickupHistory=history;target.collectedPickupCollis=collected;target.pickupCollectedColliCount=collected;target.remainingPickupCollis=remaining;target.pickupRemainingColliCount=remaining;target.expectedColliCount=expected;target.pickupPartial=!complete&&collected>0;target.status=complete?'confirmed':(collected>0?'partial':'open');target.locked=complete||collected>0||history.length>0;target.confirmedAt=complete?String(record.confirmedAt||iso):'';target.lastPartialPickupAt=!complete&&collected>0?iso:String(record.lastPartialPickupAt||'');target.podFiles=clone(realPodFiles(record));target.signatureBlobName=String(record.signatureBlobName||last&&last.signatureBlobName||'');target.signatureStoredAt=String(record.signatureStoredAt||last&&last.signatureStoredAt||'');target.updatedAt=iso;
 if(last){target.driverName=last.driverName||'';target.pickupDriverName=last.driverName||'';target.licensePlate=last.licensePlate||'';target.vehicleLicensePlate=last.licensePlate||'';target.kennzeichen=last.licensePlate||'';target.loaderName=last.loaderName||'';target.loadedBy=last.loaderName||'';target.loader=last.loaderName||'';target.verlader=last.loaderName||'';target.carrierName=last.carrierName||''}
 return aggregateShipmentFromSubs(sh)
}
`;
if(!src.includes('function applyPickupRecordToShipment(')){
  src=replaceOnce(src,'async function updateTeam(record,podsToAdd=[],rawToken=\'\'){',helpers+'async function updateTeam(record,podsToAdd=[],rawToken=\'\'){','RC1017 Teilsendungs-Statusadapter');
}

const updateStart=src.indexOf("async function updateTeam(record,podsToAdd=[],rawToken=''){");
const exportStart=src.indexOf('\nmodule.exports=',updateStart);
if(updateStart<0||exportStart<0)throw new Error('RC1017 updateTeam Bereich nicht gefunden');
let update=src.slice(updateStart,exportStart);
if(!update.includes('const subShipmentMode=!!String(record.subShipmentId||\'\').trim();')){
  update=replaceOnce(update,'  if(sh){',"  const subShipmentMode=!!String(record.subShipmentId||'').trim();\n  if(sh&&subShipmentMode){const iso=String(last&&last.confirmedAt||record.confirmedAt||record.lastPartialPickupAt||now());applyPickupRecordToShipment(sh,record);sh._syncUpdatedAt=iso;sh._syncDeviceId='qr-pickup'}else if(sh){",'RC1017 updateTeam Verzweigung');
}
if(!update.includes('const shipmentCompleteForTasks=')){
  update=replaceOnce(update,'  if(complete){for(const t of doc.state.tasks){',"  const shipmentCompleteForTasks=subShipmentMode?!!(sh&&sh.status==='Abgeholt'):complete;\n  if(shipmentCompleteForTasks){for(const t of doc.state.tasks){",'RC1017 Aufgabenabschluss erst nach gesamter Hauptsendung');
}
src=src.slice(0,updateStart)+update+src.slice(exportStart);

if(!src.includes('applyPickupRecordToShipment,aggregateShipmentFromSubs,')){
  src=replaceOnce(src,'publicRecord,updateTeam,safeName','publicRecord,updateTeam,applyPickupRecordToShipment,aggregateShipmentFromSubs,safeName','RC1017 Helper-Exports');
}
fs.writeFileSync(storeFile,src);

const confirmFile='api/pickup-confirm-v2/index.js';
let confirm=fs.readFileSync(confirmFile,'utf8');
if(!confirm.includes("shipmentStatus:complete?(rec.subShipmentId?'Teilsendung abgeholt':'Abgeholt'):'Teilweise abgeholt'")){
  confirm=replaceOnce(confirm,"shipmentStatus:complete?'Abgeholt':'Teilweise abgeholt'","shipmentStatus:complete?(rec.subShipmentId?'Teilsendung abgeholt':'Abgeholt'):'Teilweise abgeholt'",'RC1017 Pickup-Antwort Hauptstatus');
}
fs.writeFileSync(confirmFile,confirm);
console.log('RC1017 Task 6 angewendet: Pickup/POD je Teilsendung und Hauptstatusaggregation aktiv.');
