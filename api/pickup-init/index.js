'use strict';
const store=require('../shared/pickup-store');
const pins=require('../shared/loader-pin-store');
function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function count(v){const n=Math.round(Number(v));return Number.isFinite(n)&&n>0?n:0}
function carrier(body,existing){return store.sanitizeText(body.carrierName||body.speditionName||body.carrier||body.spedition||(existing&&(existing.carrierName||existing.speditionName||existing.carrier||existing.spedition))||'',180)}
function clearConfirmation(r){['confirmedAt','driverName','licensePlate','loaderName','loaderId','signatureBlobName','signatureType','signatureSize','signatureStoredAt','uploadKeyHash','uploadKeyExpiresAt'].forEach(k=>delete r[k]);r.status='open';r.failedAttempts=0;r.lockedUntil=null;r.returnedEuroPallets=0;r.enteredColliCount=0;r.colliCountConfirmed=false;r.colliConfirmed=false;r.pickupColliCountConfirmed=false;r.podType='';r.podFiles=[];return r}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res=store.json(204,{}, {Allow:'POST, OPTIONS'});return}
 if(req.method!=='POST'){context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Nur POST ist erlaubt.'},{Allow:'POST, OPTIONS'});return}
 try{
  const b=store.body(req),token=text(b.token).toLowerCase();if(!store.validToken(token))throw store.err('INVALID_TOKEN','Ungültiger QR-Code.',400);
  const expected=count(b.expectedColliCount||b.totalColli||b.colliCount||b.packageCount),spedition=carrier(b,null);if(!expected)throw store.err('COLLI_REQUIRED','Die Soll-Colli-Anzahl fehlt. Bitte die Sendung mit vollständigen Colli-Daten speichern.',400);if(!spedition)throw store.err('CARRIER_REQUIRED','Speditionsname fehlt. Der Speditionsname ist Pflicht.',400);
  const c=await store.clients(),blob=store.recordBlob(c.records,token);let current=await store.readJson(blob),existing=current.value||{},record=Object.assign({},existing);
  if((b.resetPickup===true||b.reactivate===true)&&existing){record=clearConfirmation(record)}
  record.token=token;record.reference=text(b.reference||b.shipmentRef||existing.reference);record.shipmentId=text(b.shipmentId||existing.shipmentId);record.customer=text(b.customerName||b.customer||b.recipientCustomerName||existing.customer);record.recipient=text(b.recipient||b.recipientName||existing.recipient);record.address=text(b.recipientAddress||b.deliveryAddress||b.shipToAddress||b.address||existing.address);record.locationName=text(b.locationName||existing.locationName);record.palletOut=Math.max(0,Number(b.palletOut||b.euroPallets||existing.palletOut||0)||0);record.expectedColliCount=expected;record.colliCount=expected;record.totalColli=expected;record.packageCount=expected;record.carrierName=spedition;record.speditionName=spedition;record.carrier=spedition;record.spedition=spedition;record.pinHash=store.hash(pins.bridgePin());record.disabled=Boolean(b.disabled===true||b.active===false);record.createdAt=existing.createdAt||store.now();record.updatedAt=store.now();record.expiresAt=existing.expiresAt||new Date(Date.now()+Math.max(1,Number(b.expiresDays||180))*86400000).toISOString();record.registrationVersion='RC610';record.metadataVersion=14;if(!record.status)record.status='open';
  for(let attempt=0;attempt<4;attempt++){try{await store.writeJson(blob,record,current.etag);break}catch(e){if(!(e&&e.statusCode===412)||attempt===3)throw e;current=await store.readJson(blob);existing=current.value||{};record=Object.assign({},existing,record)}}
  context.res=store.json(200,Object.assign({registered:true},store.publicRecord(record)));
 }catch(e){context.log&&context.log.error&&context.log.error('pickup-init RC610',e&&e.code,e&&e.message);context.res=store.json(e.status||500,{ok:false,code:e.code||'INIT_FAILED',message:e.message||'QR-Code konnte nicht registriert werden.'})}
};
