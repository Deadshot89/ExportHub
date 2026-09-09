import fs from 'node:fs';

const file='api/shared/pickup-store.js';
let src=fs.readFileSync(file,'utf8');

function replaceOnce(from,to,label){
 const at=src.indexOf(from);
 if(at<0){
  if(src.includes(to)) return;
  throw new Error('RC1017 pickup patch: '+label+' not found');
 }
 src=src.slice(0,at)+to+src.slice(at+from.length);
}

replaceOnce(
 "const {BlobServiceClient}=require('@azure/storage-blob');\n",
 "const {BlobServiceClient}=require('@azure/storage-blob');\nconst multiTruckPickup=require('./multi-truck-pickup');\n",
 'multi-truck-pickup require'
);

replaceOnce(
 "shipmentId:r.shipmentId||'',palletOut:",
 "shipmentId:r.shipmentId||'',loadUnitId:r.loadUnitId||'',loadUnitSequence:Number(r.loadUnitSequence||0)||0,loadUnitTotal:Number(r.loadUnitTotal||0)||0,splitVersion:Number(r.splitVersion||0)||0,loadUnitLabel:r.loadUnitLabel||'',palletOut:",
 'publicRecord load-unit fields'
);

replaceOnce(
 "  if(sh){const iso=String(last&&last.confirmedAt||record.confirmedAt||record.lastPartialPickupAt||now()),carrier=sanitizeText(first(record,['carrierName','speditionName','carrier','spedition']),180);",
 "  if(sh&&record.loadUnitId){const updated=multiTruckPickup.applyPickupRecordToShipment(sh,record);Object.keys(sh).forEach(k=>delete sh[k]);Object.assign(sh,updated);}else if(sh){const iso=String(last&&last.confirmedAt||record.confirmedAt||record.lastPartialPickupAt||now()),carrier=sanitizeText(first(record,['carrierName','speditionName','carrier','spedition']),180);",
 'load-unit team update branch'
);

fs.writeFileSync(file,src);
console.log('RC1017 pickup-store patch applied');
