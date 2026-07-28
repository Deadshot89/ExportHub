
'use strict';
const crypto=require('crypto');
const store=require('../shared/pickup-store');
module.exports=async function(context,req){
  if(req.method!=='POST'){context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'POST'});return}
  try{
    const b=store.body(req),token=String(b.token||'').toLowerCase(),pin=String(b.pin||''),signature=store.first(b,['driverSignature','signatureDataUrl','pickupSignature','signature','qrPickupSignature']);
    if(!signature)throw store.err('SIGNATURE_REQUIRED','Die digitale Unterschrift ist Pflicht.',400);
    let uploadKey='';
    let rec=await store.mutateRecord(token,async function(r,clients){
      if(store.expired(r)&&!r.confirmedAt)throw store.err('EXPIRED','QR-Code ist abgelaufen.',410);
      if(r.confirmedAt&&r.signatureBlobName)throw store.err('ALREADY_CONFIRMED','Abholung und digitale Unterschrift wurden bereits gespeichert.',409);
      if(r.lockedUntil&&Date.now()<Date.parse(r.lockedUntil))throw store.err('LOCKED','Zu viele falsche Eingaben.',423);
      if(!store.safeEqualHex(r.pinHash,store.hash(pin))){r.failedAttempts=Number(r.failedAttempts||0)+1;r.updatedAt=store.now();if(r.failedAttempts>=5)r.lockedUntil=new Date(Date.now()+15*60000).toISOString();const e=store.err(r.failedAttempts>=5?'LOCKED':'INVALID_PIN',r.failedAttempts>=5?'Zu viele falsche Eingaben.':'PIN ist nicht korrekt.',r.failedAttempts>=5?423:401);e.recordToSave=r;throw e}
      const signatureMeta=await store.saveDriverSignature(clients,r,signature),iso=r.confirmedAt||store.now();
      uploadKey=crypto.randomBytes(32).toString('hex');r.status='confirmed';r.confirmedAt=iso;r.updatedAt=store.now();r.failedAttempts=0;r.lockedUntil=null;r.uploadKeyHash=store.hash(uploadKey);r.uploadKeyExpiresAt=new Date(Date.now()+2*3600000).toISOString();
      r.driverName=store.sanitizeText(store.first(b,['driverName','pickupDriverName','confirmedBy']),180);r.licensePlate=store.sanitizeText(store.first(b,['licensePlate','vehicleLicensePlate','kennzeichen','plate']),80);r.loaderName=store.sanitizeText(store.first(b,['loaderName','loadedBy','loader','verlader','pickupLoaderName','pickupConfirmedByLoader']),180);r.loaderId=store.sanitizeText(b.loaderId||'',120);r.returnedEuroPallets=Math.max(0,Math.round(Number(b.returnedEuroPallets||b.returnPallets||0)||0));r.signatureBlobName=signatureMeta.signatureBlobName;r.signatureType=signatureMeta.signatureType;r.signatureSize=signatureMeta.signatureSize;r.signatureStoredAt=signatureMeta.signatureStoredAt;r.podType='signed-loadlist';r.podFiles=store.realPodFiles(r);return r
    }).catch(async function(e){if(e.recordToSave){try{await store.mutateRecord(token,async()=>e.recordToSave)}catch(_){}}throw e});
    try{await store.updateTeam(rec,[])}catch(e){context.log.error('Team state update failed',e)}
    context.res=store.json(200,Object.assign(store.publicRecord(rec),{uploadKey,uploadExpiresAt:rec.uploadKeyExpiresAt,signatureStored:true,repairedLegacyConfirmation:!!rec.confirmedAt}));
  }catch(e){context.res=store.json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Bestätigung fehlgeschlagen.'})}
};
