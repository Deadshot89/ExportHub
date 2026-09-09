'use strict';
const fs=require('fs');

function patch(path,replacements,marker){
  let src=fs.readFileSync(path,'utf8');
  if(marker&&src.includes(marker)){console.log(path+': RC1017 task5 already applied');return false}
  for(const [from,to] of replacements){
    if(!src.includes(from))throw new Error(path+': anchor not found: '+from.slice(0,120));
    src=src.replace(from,to);
  }
  fs.writeFileSync(path,src);
  console.log(path+': RC1017 task5 applied');
  return true;
}

patch('api/pickup-init/index.js',[
 [
  "  const b=store.body(req),src=b.shipment&&typeof b.shipment==='object'?Object.assign({},b.shipment,b):b,reference=text(src.reference||src.ref||src.shipmentRef).toUpperCase(),shipmentId=text(src.shipmentId||src.id||reference),rows=rowsOf(src),expected=store.expectedCollis(Object.assign({},src,{rows}));",
  "  const b=store.body(req),src=b.shipment&&typeof b.shipment==='object'?Object.assign({},b.shipment,b):b,reference=text(src.reference||src.ref||src.shipmentRef).toUpperCase(),shipmentId=text(src.shipmentId||src.id||reference),subShipmentId=text(src.subShipmentId),subShipmentSequence=Math.max(0,Math.round(Number(src.subShipmentSequence)||0)),subShipmentTotal=Math.max(0,Math.round(Number(src.subShipmentTotal)||0)),subShipmentLabel=subShipmentId&&subShipmentSequence&&subShipmentTotal?`Sendung ${subShipmentSequence} von ${subShipmentTotal}`:'',pickupSubjectId=subShipmentId?`${shipmentId}::${subShipmentId}`:shipmentId,rows=rowsOf(src),expected=store.expectedCollis(Object.assign({},src,{rows}));"
 ],
 [
  "  const snapshot={shipmentId,reference,customer:text(src.customerName||src.customer||src.recipientCustomerName),recipient:text(src.recipient||src.recipientName),address:text(src.recipientAddress||src.deliveryAddress||src.shipToAddress||src.address),locationName:text(src.locationName),carrierName:carrier(src),palletOut:Math.max(0,Number(src.palletOut||src.euroPallets||0)||0),rows:store.clone(rows),expectedColliCount:expected,plannedPickupDate:text(src.pickdate||src.plannedPickupDate||src.pickupDate)};",
  "  const snapshot={shipmentId,subShipmentId,subShipmentSequence,subShipmentTotal,subShipmentLabel,reference,customer:text(src.customerName||src.customer||src.recipientCustomerName),recipient:text(src.recipient||src.recipientName),address:text(src.recipientAddress||src.deliveryAddress||src.shipToAddress||src.address),locationName:text(src.locationName),carrierName:carrier(src),palletOut:Math.max(0,Number(src.palletOut||src.euroPallets||0)||0),rows:store.clone(rows),expectedColliCount:expected,plannedPickupDate:text(src.pickdate||src.plannedPickupDate||src.pickupDate)};"
 ],
 [
  "  const issued=await access.issue(req,'pickup',{subjectId:shipmentId,shipmentId,reference,snapshot,actor:session.user.name||session.user.user||'ExportHUB'},ttlDays*86400000,b);",
  "  const issued=await access.issue(req,'pickup',{subjectId:pickupSubjectId,shipmentId,subShipmentId,subShipmentSequence,subShipmentTotal,subShipmentLabel,reference,snapshot,actor:session.user.name||session.user.user||'ExportHUB'},ttlDays*86400000,b);"
 ],
 [
  "  const c=await store.clients(issued.environment),record={schemaVersion:2,registrationVersion:'RC995',metadataVersion:16,environment:issued.environment,accessKey:issued.tokenHash,shipmentId,reference,customer:snapshot.customer,recipient:snapshot.recipient,address:snapshot.address,locationName:snapshot.locationName,carrierName:snapshot.carrierName,speditionName:snapshot.carrierName,carrier:snapshot.carrierName,spedition:snapshot.carrierName,palletOut:snapshot.palletOut,rows:snapshot.rows,expectedColliCount:expected,colliCount:expected,totalColli:expected,packageCount:expected,status:'open',createdAt:store.now(),updatedAt:store.now(),expiresAt:issued.expiresAt,failedAttempts:0,lockedUntil:null,podFiles:[]};",
  "  const c=await store.clients(issued.environment),record={schemaVersion:2,registrationVersion:'RC995',metadataVersion:17,environment:issued.environment,accessKey:issued.tokenHash,shipmentId,subShipmentId,subShipmentSequence,subShipmentTotal,subShipmentLabel,reference,customer:snapshot.customer,recipient:snapshot.recipient,address:snapshot.address,locationName:snapshot.locationName,carrierName:snapshot.carrierName,speditionName:snapshot.carrierName,carrier:snapshot.carrierName,spedition:snapshot.carrierName,palletOut:snapshot.palletOut,rows:snapshot.rows,expectedColliCount:expected,colliCount:expected,totalColli:expected,packageCount:expected,status:'open',createdAt:store.now(),updatedAt:store.now(),expiresAt:issued.expiresAt,failedAttempts:0,lockedUntil:null,podFiles:[]};"
 ],
 [
  "  context.res=store.json(200,Object.assign({ok:true,registered:true,token:issued.token,environment:issued.environment,oneTime:false,version:'RC1014'},store.publicRecord(record,issued.token)));",
  "  context.res=store.json(200,Object.assign({ok:true,registered:true,token:issued.token,environment:issued.environment,oneTime:false,version:'RC1017'},store.publicRecord(record,issued.token)));"
 ]
],"metadataVersion:17");

patch('api/shared/pickup-store.js',[
 [
  "shipmentId:r.shipmentId||'',palletOut:",
  "shipmentId:r.shipmentId||'',subShipmentId:r.subShipmentId||'',subShipmentSequence:Number(r.subShipmentSequence||0)||0,subShipmentTotal:Number(r.subShipmentTotal||0)||0,subShipmentLabel:r.subShipmentLabel||'',palletOut:"
 ]
],"subShipmentId:r.subShipmentId||''");
