'use strict';
const access=require('../shared/public-access-store');
const store=require('../shared/pickup-store');
const auth=require('../shared/auth-store');

function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function rowsOf(src){for(const k of ['rows','colli','collis','packages','packageRows'])if(Array.isArray(src&&src[k])&&src[k].length)return src[k];return[]}
function carrier(src){return store.sanitizeText(src.carrierName||src.speditionName||src.carrier||src.spedition||'',180)}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res=store.json(204,{}, {Allow:'POST, OPTIONS'});return}
 if(req.method!=='POST'){context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Nur POST ist erlaubt.'},{Allow:'POST, OPTIONS'});return}
 try{
  const session=await auth.validateSession(req);if(!auth.hasAnyEditRight(session.user))throw auth.error('WRITE_FORBIDDEN','Für das Erstellen eines Abhol-QR-Codes fehlen Bearbeitungsrechte.',403);
  const b=store.body(req),src=b.shipment&&typeof b.shipment==='object'?Object.assign({},b.shipment,b):b,reference=text(src.reference||src.ref||src.shipmentRef).toUpperCase(),shipmentId=text(src.shipmentId||src.id||reference),rows=rowsOf(src),expected=store.expectedCollis(Object.assign({},src,{rows}));
  if(!shipmentId||!reference)throw store.err('SHIPMENT_REQUIRED','Sendung oder Referenz fehlt.',400);if(!expected)throw store.err('COLLI_REQUIRED','Die Soll-Colli-Anzahl fehlt. Bitte die Sendung mit vollständigen Colli-Daten speichern.',400);
  const ttlDays=Math.min(30,Math.max(1,Number(b.expiresDays||src.expiresDays||14)||14));
  const snapshot={shipmentId,reference,customer:text(src.customerName||src.customer||src.recipientCustomerName),recipient:text(src.recipient||src.recipientName),address:text(src.recipientAddress||src.deliveryAddress||src.shipToAddress||src.address),locationName:text(src.locationName),carrierName:carrier(src),palletOut:Math.max(0,Number(src.palletOut||src.euroPallets||0)||0),rows:store.clone(rows),expectedColliCount:expected,plannedPickupDate:text(src.pickdate||src.plannedPickupDate||src.pickupDate)};
  const issued=await access.issue(req,'pickup',{subjectId:shipmentId,shipmentId,reference,snapshot,actor:session.user.name||session.user.user||'ExportHUB'},ttlDays*86400000,b);
  const c=await store.clients(issued.environment),record={schemaVersion:2,registrationVersion:'RC995',metadataVersion:16,environment:issued.environment,accessKey:issued.tokenHash,shipmentId,reference,customer:snapshot.customer,recipient:snapshot.recipient,address:snapshot.address,locationName:snapshot.locationName,carrierName:snapshot.carrierName,speditionName:snapshot.carrierName,carrier:snapshot.carrierName,spedition:snapshot.carrierName,palletOut:snapshot.palletOut,rows:snapshot.rows,expectedColliCount:expected,colliCount:expected,totalColli:expected,packageCount:expected,status:'open',createdAt:store.now(),updatedAt:store.now(),expiresAt:issued.expiresAt,failedAttempts:0,lockedUntil:null,podFiles:[]};
  await store.writeJson(store.recordBlob(c.records,issued.tokenHash,issued.environment),record,null);
  context.res=store.json(200,Object.assign({ok:true,registered:true,token:issued.token,environment:issued.environment,oneTime:true,version:'RC995'},store.publicRecord(record,issued.token)));
 }catch(e){context.log&&context.log.error&&context.log.error('pickup-init RC995',e&&e.code,e&&e.message);context.res=store.json(e.status||e.statusCode||500,{ok:false,code:e.code||'INIT_FAILED',message:e.message||'QR-Code konnte nicht registriert werden.'})}
};
