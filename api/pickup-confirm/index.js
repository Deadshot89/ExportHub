'use strict';
const crypto=require('crypto');
const store=require('../shared/pickup-store');
const config=require('../shared/pickup-config');
module.exports=async function(context,req){
 if(req.method!=='POST'){context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'POST'});return}
 try{
  const b=store.body(req),token=String(b.token||'').toLowerCase(),pin=String(b.pin||''),cc=await config.current(store),activePin=String(cc.value.pin||'');let uploadKey='';
  let rec=await store.mutateRecord(token,async function(r){
   if(r.suspended)throw store.err('CANCELLED','Diese Sendung ist storniert. Der QR-Code ist gesperrt.',410);
   if(store.expired(r)&&!r.confirmedAt)throw store.err('EXPIRED','QR-Code ist abgelaufen.',410);
   if(r.confirmedAt)throw store.err('ALREADY_CONFIRMED','Abholung wurde bereits bestätigt.',409);
   if(r.lockedUntil&&Date.now()<Date.parse(r.lockedUntil))throw store.err('LOCKED','Zu viele falsche Eingaben.',423);
   if(!/^\d{4}$/.test(pin)||!store.safeEqualHex(store.hash(activePin),store.hash(pin))){r.failedAttempts=Number(r.failedAttempts||0)+1;r.updatedAt=store.now();if(r.failedAttempts>=5)r.lockedUntil=new Date(Date.now()+15*60000).toISOString();const e=store.err(r.failedAttempts>=5?'LOCKED':'INVALID_PIN',r.failedAttempts>=5?'Zu viele falsche Eingaben.':'PIN ist nicht korrekt.',r.failedAttempts>=5?423:401);e.recordToSave=r;throw e}
   const iso=store.now();uploadKey=crypto.randomBytes(32).toString('hex');r.status='confirmed';r.confirmedAt=iso;r.updatedAt=iso;r.failedAttempts=0;r.lockedUntil=null;r.pinRevision=Number(cc.value.revision||1);r.uploadKeyHash=store.hash(uploadKey);r.uploadKeyExpiresAt=new Date(Date.now()+2*3600000).toISOString();return r;
  }).catch(async e=>{if(e.recordToSave){try{await store.mutateRecord(token,async()=>e.recordToSave)}catch(_){}}throw e});
  const scanPod=await store.createConfirmationPod(rec);rec=await store.mutateRecord(token,async r=>{r.podFiles=Array.isArray(r.podFiles)?r.podFiles:[];if(!r.podFiles.some(x=>x.id===scanPod.id||x.kind==='scan-confirmation'))r.podFiles.unshift(scanPod);r.updatedAt=store.now();return r});
  await store.updateTeam(rec,[scanPod]);
  context.res=store.json(200,{ok:true,status:'confirmed',confirmedAt:rec.confirmedAt,uploadKey,uploadExpiresAt:rec.uploadKeyExpiresAt,podCount:rec.podFiles.length,scanPod:true,pinRevision:Number(cc.value.revision||1)});
 }catch(e){context.log&&context.log.error&&context.log.error(e);context.res=store.json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Bestätigung fehlgeschlagen.'})}
};
