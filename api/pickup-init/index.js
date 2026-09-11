'use strict';
const access=require('../shared/public-access-store');
const store=require('../shared/pickup-store');
const auth=require('../shared/fast-auth-store');

function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function rowsOf(src){for(const k of ['rows','colli','collis','packages','packageRows'])if(Array.isArray(src&&src[k])&&src[k].length)return src[k];return[]}
function carrier(src){return store.sanitizeText(src.carrierName||src.speditionName||src.carrier||src.spedition||'',180)}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res=store.json(204,{}, {Allow:'POST, OPTIONS'});return}
 if(req.method!=='POST'){context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Nur POST ist erlaubt.'},{Allow:'POST, OPTIONS'});return}
 try{
  const session=await auth.validateSession(req);if(!auth.hasAnyEditRight(session.user))throw auth.error('WRITE_FORBIDDEN','Für das Erstellen eines Abhol-QR-Codes fehlen Bearbeitungsrechte.',403);
  const b=store.body(req),src=b.shipment&&typeof b.shipment==='object'?Object.assign({},b.shipment,b):b,reference=text(src.reference||src.ref||src.shipmentRef).toUpperCase(),shipmentId=text(src.shipmentId||src.id||reference),subShipmentId=text(src.subShipmentId),subShipmentSequence=Math.max(0,Math.round(Number(src.subShipmentSequence)||0)),subShipmentTotal=Math.max(0,Math.round(Number(src.subShipmentTotal)||0)),subShipmentLabel=subShipmentId&&subShipmentSequence&&subShipmentTotal?`Sendung ${subShipmentSequence} von ${subShipmentTotal}`:'',pickupSubjectId=subShipmentId?`${shipmentId}::${subShipmentId}`:shipmentId,rows=rowsOf(src),expected=store.expectedCollis(Object.assign({},src,{rows}));
  if(!shipmentId||!reference)throw store.err('SHIPMENT_REQUIRED','Sendung oder Referenz fehlt.',400);if(!expected)throw store.err('COLLI_REQUIRED','Die Soll-Colli-Anzahl fehlt. Bitte die Sendung mit vollständigen Colli-Daten speichern.',400);
  const ttlDays=Math.min(30,Math.max(1,Number(b.expiresDays||src.expiresDays||14)||14));
  const snapshot={shipmentId,subShipmentId,subShipmentSequence,subShipmentTotal,subShipmentLabel,reference,customer:text(src.customerName||src.customer||src.recipientCustomerName),recipient:text(src.recipient||src.recipientName),address:text(src.recipientAddress||src.deliveryAddress||src.shipToAddress||src.address),locationName:text(src.locationName),carrierName:carrier(src),palletOut:Math.max(0,Number(src.palletOut||src.euroPallets||0)||0),rows:store.clone(rows),expectedColliCount:expected,plannedPickupDate:text(src.pickdate||src.plannedPickupDate||src.pickupDate)};
  const issued=await access.issue(req,'pickup',{subjectId:pickupSubjectId,shipmentId,subShipmentId,subShipmentSequence,subShipmentTotal,subShipmentLabel,reference,snapshot,actor:session.user.name||session.user.user||'ExportHUB'},ttlDays*86400000,b);
  const accessKey=issued.resourceKey||issued.tokenHash,c=await store.clients(issued.environment),fresh={schemaVersion:3,registrationVersion:'RC1045',metadataVersion:18,environment:issued.environment,accessKey,shipmentId,subShipmentId,subShipmentSequence,subShipmentTotal,subShipmentLabel,reference,customer:snapshot.customer,recipient:snapshot.recipient,address:snapshot.address,locationName:snapshot.locationName,carrierName:snapshot.carrierName,speditionName:snapshot.carrierName,carrier:snapshot.carrierName,spedition:snapshot.carrierName,palletOut:snapshot.palletOut,rows:snapshot.rows,expectedColliCount:expected,colliCount:expected,totalColli:expected,packageCount:expected,status:'open',createdAt:store.now(),updatedAt:store.now(),expiresAt:issued.expiresAt,failedAttempts:0,lockedUntil:null,podFiles:[]};
  let record=fresh,existing=null;
  try{existing=await store.getRecord(accessKey,issued.environment)}catch(e){if(!(e&&e.code==='PICKUP_NOT_FOUND'))throw e}
  if(existing&&existing.record){
   record=await store.mutateRecord(accessKey,issued.environment,function(r){
    const started=(typeof store.pickupHistory==='function'&&store.pickupHistory(r).length>0)||(typeof store.pickupComplete==='function'&&store.pickupComplete(r))||r.status==='partial'||r.status==='confirmed';
    r.accessKey=accessKey;r.environment=issued.environment;r.shipmentId=shipmentId;r.subShipmentId=subShipmentId;r.subShipmentSequence=subShipmentSequence;r.subShipmentTotal=subShipmentTotal;r.subShipmentLabel=subShipmentLabel;r.reference=reference;
    if(snapshot.customer)r.customer=snapshot.customer;if(snapshot.recipient)r.recipient=snapshot.recipient;if(snapshot.address)r.address=snapshot.address;if(snapshot.locationName)r.locationName=snapshot.locationName;if(snapshot.carrierName){r.carrierName=snapshot.carrierName;r.speditionName=snapshot.carrierName;r.carrier=snapshot.carrierName;r.spedition=snapshot.carrierName}
    if(!started){r.rows=store.clone(snapshot.rows);r.expectedColliCount=expected;r.colliCount=expected;r.totalColli=expected;r.packageCount=expected;r.palletOut=snapshot.palletOut}
    r.registrationVersion='RC1045';r.metadataVersion=18;r.updatedAt=store.now();return r
   });
  }else await store.writeJson(store.recordBlob(c.records,accessKey,issued.environment),record,null);
  context.res=store.json(200,Object.assign({ok:true,registered:true,token:issued.token,environment:issued.environment,oneTime:false,reused:issued.reused===true,compatibility:'stable-qr-v1',version:'RC1045'},store.publicRecord(record,issued.token)));
 }catch(e){context.log&&context.log.error&&context.log.error('pickup-init RC1014',e&&e.code,e&&e.message);context.res=store.json(e.status||e.statusCode||500,{ok:false,code:e.code||'INIT_FAILED',message:e.message||'QR-Code konnte nicht registriert werden.'})}
};