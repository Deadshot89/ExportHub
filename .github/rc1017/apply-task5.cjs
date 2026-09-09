'use strict';
const fs=require('fs');

function replaceOnce(source,search,replacement,label){
  const count=source.split(search).length-1;
  if(count!==1)throw new Error(label+': erwartet 1 Treffer, gefunden '+count);
  return source.replace(search,replacement);
}

const initFile='api/pickup-init/index.js';
let init=fs.readFileSync(initFile,'utf8');
const oldParse="  const b=store.body(req),src=b.shipment&&typeof b.shipment==='object'?Object.assign({},b.shipment,b):b,reference=text(src.reference||src.ref||src.shipmentRef).toUpperCase(),shipmentId=text(src.shipmentId||src.id||reference),rows=rowsOf(src),expected=store.expectedCollis(Object.assign({},src,{rows}));";
const newParse=`  const b=store.body(req),src=b.shipment&&typeof b.shipment==='object'?Object.assign({},b.shipment,b):b,reference=text(src.reference||src.ref||src.shipmentRef).toUpperCase(),shipmentId=text(src.shipmentId||src.id||reference),subShipmentId=text(src.subShipmentId||b.subShipmentId);
  let selectedSubShipment=null,rows=rowsOf(src);
  if(subShipmentId){
   const subs=Array.isArray(src.subShipments)?src.subShipments:(Array.isArray(b.subShipments)?b.subShipments:[]);
   selectedSubShipment=subs.find(x=>text(x&&x.subShipmentId)===subShipmentId)||null;
   if(!selectedSubShipment)throw store.err('SUBSHIPMENT_NOT_FOUND','Die gewählte LKW-Teilsendung wurde in der Hauptsendung nicht gefunden.',409);
   rows=rowsOf(selectedSubShipment);
   if(!rows.length)throw store.err('SUBSHIPMENT_COLLI_REQUIRED','Die gewählte LKW-Teilsendung enthält keine Colli.',409);
  }
  const subShipmentSequence=subShipmentId?Math.max(0,Math.round(Number(selectedSubShipment&&selectedSubShipment.sequence||src.subShipmentSequence||b.subShipmentSequence)||0)):0,
        subShipmentTotal=subShipmentId?Math.max(0,Math.round(Number(selectedSubShipment&&selectedSubShipment.total||src.subShipmentTotal||b.subShipmentTotal||src.requiredTruckCount)||0)):0,
        subShipmentLabel=subShipmentId?(text(selectedSubShipment&&selectedSubShipment.label)||(subShipmentSequence&&subShipmentTotal?('Sendung '+subShipmentSequence+' von '+subShipmentTotal):'')):'',
        expected=store.expectedCollis(Object.assign({},src,{rows})),pickupSubjectId=subShipmentId?(shipmentId+'::'+subShipmentId):shipmentId;`;
if(!init.includes('pickupSubjectId=subShipmentId?'))init=replaceOnce(init,oldParse,newParse,'RC1017 Teilsendungs-Kontext parsen');

const oldSnapshot="  const snapshot={shipmentId,reference,customer:text(src.customerName||src.customer||src.recipientCustomerName),recipient:text(src.recipient||src.recipientName),address:text(src.recipientAddress||src.deliveryAddress||src.shipToAddress||src.address),locationName:text(src.locationName),carrierName:carrier(src),palletOut:Math.max(0,Number(src.palletOut||src.euroPallets||0)||0),rows:store.clone(rows),expectedColliCount:expected,plannedPickupDate:text(src.pickdate||src.plannedPickupDate||src.pickupDate)};";
const newSnapshot="  const snapshot={shipmentId,subShipmentId,subShipmentSequence,subShipmentTotal,subShipmentLabel,reference,customer:text(src.customerName||src.customer||src.recipientCustomerName),recipient:text(src.recipient||src.recipientName),address:text(src.recipientAddress||src.deliveryAddress||src.shipToAddress||src.address),locationName:text(src.locationName),carrierName:carrier(src),palletOut:Math.max(0,Number(src.palletOut||src.euroPallets||0)||0),rows:store.clone(rows),expectedColliCount:expected,plannedPickupDate:text(src.pickdate||src.plannedPickupDate||src.pickupDate)};";
if(!init.includes('const snapshot={shipmentId,subShipmentId,'))init=replaceOnce(init,oldSnapshot,newSnapshot,'RC1017 Teilsendungs-Snapshot');

const oldIssue="  const issued=await access.issue(req,'pickup',{subjectId:shipmentId,shipmentId,reference,snapshot,actor:session.user.name||session.user.user||'ExportHUB'},ttlDays*86400000,b);";
const newIssue="  const issued=await access.issue(req,'pickup',{subjectId:pickupSubjectId,shipmentId,subShipmentId,subShipmentSequence,subShipmentTotal,subShipmentLabel,reference,snapshot,actor:session.user.name||session.user.user||'ExportHUB'},ttlDays*86400000,b);";
if(!init.includes("subjectId:pickupSubjectId"))init=replaceOnce(init,oldIssue,newIssue,'RC1017 eindeutige Public-Access-Identität');

const oldRecord="record={schemaVersion:2,registrationVersion:'RC995',metadataVersion:16,environment:issued.environment,accessKey:issued.tokenHash,shipmentId,reference,customer:snapshot.customer";
const newRecord="record={schemaVersion:2,registrationVersion:'RC995',metadataVersion:17,environment:issued.environment,accessKey:issued.tokenHash,shipmentId,subShipmentId,subShipmentSequence,subShipmentTotal,subShipmentLabel,reference,customer:snapshot.customer";
if(!init.includes("metadataVersion:17"))init=replaceOnce(init,oldRecord,newRecord,'RC1017 Pickup-Record Metadaten');
fs.writeFileSync(initFile,init);

const storeFile='api/shared/pickup-store.js';
let store=fs.readFileSync(storeFile,'utf8');
const oldPublic="shipmentId:r.shipmentId||'',palletOut:";
const newPublic="shipmentId:r.shipmentId||'',subShipmentId:r.subShipmentId||'',subShipmentSequence:Number(r.subShipmentSequence||0)||0,subShipmentTotal:Number(r.subShipmentTotal||0)||0,subShipmentLabel:r.subShipmentLabel||'',palletOut:";
if(!store.includes("subShipmentId:r.subShipmentId||''"))store=replaceOnce(store,oldPublic,newPublic,'RC1017 publicRecord Teilsendungsmetadaten');
fs.writeFileSync(storeFile,store);

console.log('RC1017 Task 5 angewendet: eigener Public-Access-/Pickup-Kontext je LKW-Teilsendung.');
