'use strict';
const crypto=require('crypto');
const access=require('../shared/public-access-store');
const pins=require('../shared/loader-pin-store');
const store=require('../shared/pickup-store');
function count(v){const n=Math.round(Number(v));return Number.isFinite(n)&&n>0?n:0}
function json(status,body){return store.json(status,body,{'Cache-Control':'no-store, no-cache, must-revalidate'})}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res=json(204,{});return}if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Nur POST ist erlaubt.'});return}
 let resolved=null;
 try{
  const b=store.body(req),token=String(b.token||'').trim();resolved=await access.resolve(req,'pickup',token,{allowUsed:false},b);
  const personalPin=pins.text(b.pin||b.loaderPin||b.personalLoaderPin);if(!pins.validPin(personalPin)){await access.registerFailure(resolved.environment,'pickup',resolved.tokenHash,'pin-format');throw pins.error('INVALID_PIN','Bitte die vierstellige persönliche Verlader-PIN eingeben.',400)}
  const loader=await pins.findByPin(personalPin);if(!loader){const failed=await access.registerFailure(resolved.environment,'pickup',resolved.tokenHash,'pin');if(failed.lockedUntil)throw access.error('ACCESS_LOCKED','Zu viele falsche PIN-Eingaben. Der QR-Code ist vorübergehend gesperrt.',429);throw pins.error('INVALID_PIN','Verlader-PIN ist nicht korrekt oder deaktiviert.',401)}
  const got=await store.getRecord(resolved.tokenHash,resolved.environment),current=got.record||{},providedRef=String(b.reference||b.shipmentRef||'').trim().toUpperCase();if(providedRef&&providedRef!==String(current.reference||'').trim().toUpperCase()){await access.registerFailure(resolved.environment,'pickup',resolved.tokenHash,'reference');throw store.err('REFERENCE_MISMATCH','Referenz stimmt nicht mit der Sendung überein.',403)}
  const signature=store.first(b,['driverSignature','signatureDataUrl','pickupSignature','signature','qrPickupSignature']);if(!signature)throw store.err('SIGNATURE_REQUIRED','Die digitale Unterschrift ist Pflicht.',400);
  let uploadKey='';
  const rec=await store.mutateRecord(resolved.tokenHash,resolved.environment,async function(r,clients){
   if(store.expired(r)&&!r.confirmedAt)throw store.err('EXPIRED','QR-Code ist abgelaufen.',410);if(r.confirmedAt||r.status==='confirmed')throw store.err('ALREADY_CONFIRMED','Diese Abholung wurde bereits gespeichert.',410);
   const spedition=store.sanitizeText(store.first(b,['carrierName','speditionName','carrier','spedition'])||store.first(r,['carrierName','speditionName','carrier','spedition']),180);if(!spedition)throw store.err('CARRIER_REQUIRED','Speditionsname fehlt. Die Abholung darf nicht abgeschlossen werden.',409);
   const plate=store.sanitizeText(store.first(b,['licensePlate','vehicleLicensePlate','kennzeichen','plate']),80);if(!plate)throw store.err('LICENSE_PLATE_REQUIRED','Kennzeichen fehlt. Die Abholung darf nicht abgeschlossen werden.',409);
   const expected=store.expectedCollis(r),entered=count(store.first(b,['enteredColliCount','colliCount','pickupColliCount']));if(!expected)throw store.err('COLLI_EXPECTED_MISSING','Die Soll-Colli-Anzahl fehlt im QR-Datensatz. Bitte den QR-Code in ExportHUB neu erzeugen.',409);if(!entered)throw store.err('COLLI_REQUIRED','Bitte die gezählte Colli-Anzahl eingeben.',400);if(entered!==expected)throw store.err('COLLI_MISMATCH','Colli-Anzahl stimmt nicht. Bitte alle Collis erneut zählen.',409);
   const signatureMeta=await store.saveDriverSignature(clients,r,signature),iso=store.now();uploadKey=crypto.randomBytes(32).toString('hex');r.status='confirmed';r.confirmedAt=iso;r.updatedAt=iso;r.failedAttempts=0;r.lockedUntil=null;r.uploadKeyHash=store.hash(uploadKey);r.uploadKeyExpiresAt=new Date(Date.now()+2*3600000).toISOString();r.driverName=store.sanitizeText(store.first(b,['driverName','pickupDriverName','confirmedBy']),180);r.licensePlate=plate;r.loaderName=loader.name;r.loadedBy=loader.name;r.loader=loader.name;r.verlader=loader.name;r.loaderId=loader.id;r.returnedEuroPallets=Math.max(0,Math.round(Number(b.returnedEuroPallets||b.returnPallets||0)||0));r.carrierName=spedition;r.speditionName=spedition;r.carrier=spedition;r.spedition=spedition;r.enteredColliCount=entered;r.confirmedColliCount=entered;r.colliCountConfirmed=true;r.colliConfirmed=true;r.pickupColliCountConfirmed=true;r.signatureBlobName=signatureMeta.signatureBlobName;r.signatureType=signatureMeta.signatureType;r.signatureSize=signatureMeta.signatureSize;r.signatureStoredAt=signatureMeta.signatureStoredAt;r.podType='signed-loadlist';r.podFiles=store.realPodFiles(r);r.confirmationVersion='RC995';return r
  });
  await access.consume(resolved.environment,'pickup',resolved.tokenHash,{reason:'pickup-confirmed',fields:{confirmedAt:rec.confirmedAt,loaderId:loader.id}});
  try{await store.updateTeam(rec,[],'')}catch(e){context.log&&context.log.error&&context.log.error('RC995 team state update failed',e&&e.code,e&&e.message)}
  context.res=json(200,Object.assign(store.publicRecord(rec,token),{ok:true,pickedUp:true,status:'confirmed',shipmentStatus:'Abgeholt',uploadKey,uploadExpiresAt:rec.uploadKeyExpiresAt,signatureStored:true,loaderName:loader.name,loadedBy:loader.name,loader:loader.name,verlader:loader.name,loaderId:loader.id,personalPinValidated:true,oneTimeConsumed:true,version:'RC995'}));
 }catch(e){context.log&&context.log.error&&context.log.error('pickup-confirm-v2 RC995',e&&e.code,e&&e.message);context.res=json(e.status||e.statusCode||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Abholung konnte nicht bestätigt werden.'})}
};
