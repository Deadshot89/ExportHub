'use strict';
const crypto=require('crypto');
const store=require('../shared/pickup-store');
const config=require('../shared/pickup-config');
module.exports=async function(context,req){
 if(req.method!=='POST'){context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'POST'});return}
 try{
  const b=store.body(req),token=String(b.token||'').toLowerCase(),pin=String(b.pin||''),returned=Number(b.returnedPallets||0);
  if(!Number.isInteger(returned)||returned<0||returned>10000)throw store.err('INVALID_PALLET_RETURN','Die Rückgabemenge der Europaletten ist ungültig.',400);
  const cc=await config.current(store),activePin=String(cc.value.pin||''),initial=await store.getRecord(token),r=initial.record;
  if(r.suspended)throw store.err('CANCELLED','Diese Sendung ist storniert. Der QR-Code ist gesperrt.',410);
  if(store.expired(r)&&!r.confirmedAt)throw store.err('EXPIRED','QR-Code ist abgelaufen.',410);
  if(r.confirmedAt)throw store.err('ALREADY_CONFIRMED','Abholung wurde bereits bestätigt.',409);
  if(r.lockedUntil&&Date.now()<Date.parse(r.lockedUntil))throw store.err('LOCKED','Zu viele falsche Eingaben.',423);
  if(!/^\d{4}$/.test(pin)||!store.safeEqualHex(store.hash(activePin),store.hash(pin))){
   const failed=await store.mutateRecord(token,async x=>{x.failedAttempts=Number(x.failedAttempts||0)+1;x.updatedAt=store.now();if(x.failedAttempts>=5)x.lockedUntil=new Date(Date.now()+15*60000).toISOString();return x});
   throw store.err(failed.failedAttempts>=5?'LOCKED':'INVALID_PIN',failed.failedAttempts>=5?'Zu viele falsche Eingaben.':'PIN ist nicht korrekt.',failed.failedAttempts>=5?423:401);
  }
  const iso=store.now(),pending=Object.assign({},r,{confirmedAt:iso}),scanPod=await store.createConfirmationPod(pending);
  const teamResult=await store.updateTeam(pending,[scanPod],{returnedPallets:returned});
  const uploadKey=crypto.randomBytes(32).toString('hex');
  const rec=await store.mutateRecord(token,async x=>{
   if(x.suspended)throw store.err('CANCELLED','Diese Sendung ist storniert. Der QR-Code ist gesperrt.',410);
   if(x.confirmedAt)throw store.err('ALREADY_CONFIRMED','Abholung wurde bereits bestätigt.',409);
   x.status='confirmed';x.confirmedAt=iso;x.updatedAt=iso;x.failedAttempts=0;x.lockedUntil=null;x.pinRevision=Number(cc.value.revision||1);x.uploadKeyHash=store.hash(uploadKey);x.uploadKeyExpiresAt=new Date(Date.now()+2*3600000).toISOString();x.palletOutgoingCount=teamResult.pallet.outgoing;x.palletReturnedCount=teamResult.pallet.returned;x.palletAccountType=teamResult.pallet.partyType;x.palletAccountName=teamResult.pallet.partyName;x.palletAccountKey=teamResult.pallet.partyKey;x.podFiles=Array.isArray(x.podFiles)?x.podFiles:[];if(!x.podFiles.some(p=>p.id===scanPod.id||p.kind==='scan-confirmation'))x.podFiles.unshift(scanPod);return x;
  });
  context.res=store.json(200,{ok:true,status:'confirmed',confirmedAt:rec.confirmedAt,uploadKey,uploadExpiresAt:rec.uploadKeyExpiresAt,podCount:rec.podFiles.length,scanPod:true,pinRevision:Number(cc.value.revision||1),palletOutgoingCount:teamResult.pallet.outgoing,palletReturnedCount:teamResult.pallet.returned,palletAccountType:teamResult.pallet.partyType,palletAccountName:teamResult.pallet.partyName});
 }catch(e){context.log&&context.log.error&&context.log.error(e);context.res=store.json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Bestätigung fehlgeschlagen.'})}
};
