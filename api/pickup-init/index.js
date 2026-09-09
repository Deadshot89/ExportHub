'use strict';
const access=require('../shared/public-access-store');
const store=require('../shared/pickup-store');
const auth=require('../shared/fast-auth-store');
const multiTruckPickup=require('../shared/multi-truck-pickup');

function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function rowsOf(src){for(const k of ['rows','colli','collis','packages','packageRows'])if(Array.isArray(src&&src[k])&&src[k].length)return src[k];return[]}
function carrier(src){return store.sanitizeText(src.carrierName||src.speditionName||src.carrier||src.spedition||'',180)}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res=store.json(204,{}, {Allow:'POST, OPTIONS'});return}
 if(req.method!=='POST'){context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Nur POST ist erlaubt.'},{Allow:'POST, OPTIONS'});return}
 try{
  const session=await auth.validateSession(req);if(!auth.hasAnyEditRight(session.user))throw auth.error('WRITE_FORBIDDEN','Für das Erstellen eines Abhol-QR-Codes fehlen Bearbeitungsrechte.',403);
  const b=store.body(req),src=b.shipment&&typeof b.shipment==='object'?Object.assign({},b.shipment,b):b,reference=text(src.reference||src.ref||src.shipmentRef).toUpperCase(),shipmentId=text(src.shipmentId||src.id||reference),loadUnitId=text(b.loadUnitId||src.loadUnitId),splitVersion=Math.max(0,Math.round(Number(b.splitVersion||src.splitVersion||src.multiTruck&&src.multiTruck.splitVersion)||0));
  if(!shipmentId||!reference)throw store.err('SHIPMENT_REQUIRED','Sendung oder Referenz fehlt.',400);
  const unitSnapshot=loadUnitId?multiTruckPickup.buildLoadUnitSnapshot(src,loadUnitId,splitVersion):null,rows=unitSnapshot?unitSnapshot.rows:rowsOf(src),expected=store.expectedCollis(Object.assign({},src,{rows}));
  if(!expected)throw store.err('COLLI_REQUIRED','Die Soll-Colli-Anzahl fehlt. Bitte die Sendung mit vollständigen Colli-Daten speichern.',400);
  const ttlDays=Math.min(30,Math.max(1,Number(b.expiresDays||src.expiresDays||14)||14));
  const snapshot={shipmentId,reference,customer:text(src.customerName||src.customer||src.recipientCustomerName),recipient:text(src.recipient||src.recipientName),address:text(src.recipientAddress||src.deliveryAddress||src.shipToAddress||src.address),locationName:text(src.locationName),carrierName:carrier(src),palletOut:Math.max(0,Number(src.palletOut||src.euroPallets||0)||0),rows:store.clone(rows),expectedColliCount:expected,plannedPickupDate:text(src.pickdate||src.plannedPickupDate||src.pickupDate),loadUnitId:unitSnapshot&&unitSnapshot.loadUnitId||'',loadUnitSequence:unitSnapshot&&unitSnapshot.loadUnitSequence||0,loadUnitTotal:unitSnapshot&&unitSnapshot.loadUnitTotal||0,splitVersion:unitSnapshot&&unitSnapshot.splitVersion||0,loadUnitLabel:unitSnapshot&&unitSnapshot.displayLabel||''};
  const subjectId=multiTruckPickup.pickupSubjectId(shipmentId,snapshot.loadUnitId,snapshot.splitVersion);
  const issued=await access.issue(req,'pickup',{subjectId,shipmentId,reference,snapshot,actor:session.user.name||session.user.user||'ExportHUB'},ttlDays*86400000,b);
  const c=await store.clients(issued.environment),record={schemaVersion:2,registrationVersion:'RC1017',metadataVersion:17,environment:issued.environment,accessKey:issued.tokenHash,shipmentId,reference,customer:snapshot.customer,recipient:snapshot.recipient,address:snapshot.address,locationName:snapshot.locationName,carrierName:snapshot.carrierName,speditionName:snapshot.carrierName,carrier:snapshot.carrierName,spedition:snapshot.carrierName,palletOut:snapshot.palletOut,rows:snapshot.rows,expectedColliCount:expected,colliCount:expected,totalColli:expected,packageCount:expected,loadUnitId:snapshot.loadUnitId,loadUnitSequence:snapshot.loadUnitSequence,loadUnitTotal:snapshot.loadUnitTotal,splitVersion:snapshot.splitVersion,loadUnitLabel:snapshot.loadUnitLabel,status:'open',createdAt:store.now(),updatedAt:store.now(),expiresAt:issued.expiresAt,failedAttempts:0,lockedUntil:null,podFiles:[]};
  await store.writeJson(store.recordBlob(c.records,issued.tokenHash,issued.environment),record,null);
  context.res=store.json(200,Object.assign({ok:true,registered:true,token:issued.token,environment:issued.environment,oneTime:false,version:'RC1017'},store.publicRecord(record,issued.token)));
 }catch(e){context.log&&context.log.error&&context.log.error('pickup-init RC1017',e&&e.code,e&&e.message);context.res=store.json(e.status||e.statusCode||500,{ok:false,code:e.code||'INIT_FAILED',message:e.message||'QR-Code konnte nicht registriert werden.'})}
};