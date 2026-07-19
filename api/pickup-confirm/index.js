'use strict';
const crypto=require('crypto');
const store=require('../shared/pickup-store');
module.exports=async function(context,req){
  if(req.method!=='POST'){context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'POST'});return}
  try{
    const b=store.body(req),token=String(b.token||'').toLowerCase(),pin=String(b.pin||''),returned=Math.max(0,Math.round(Number(b.palletReturned||0)));
    if(!/^\d{4}$/.test(pin))throw store.err('INVALID_PIN','Bitte die vierstellige PIN eingeben.',400);
    if(!Number.isFinite(returned)||returned<0)throw store.err('INVALID_PALLET_RETURN','Die Rückgabemenge ist ungültig.',400);
    const activePin=await store.globalPin();
    let uploadKey='';
    let rec=await store.mutateRecord(token,async function(r){
      if(store.expired(r)&&!r.confirmedAt)throw store.err('EXPIRED','QR-Code ist abgelaufen.',410);
      if(r.confirmedAt)throw store.err('ALREADY_CONFIRMED','Abholung wurde bereits bestätigt.',409);
      if(r.lockedUntil&&Date.now()<Date.parse(r.lockedUntil))throw store.err('LOCKED','Zu viele falsche Eingaben.',423);
      if(!store.safeEqualHex(store.hash(activePin),store.hash(pin))){
        r.failedAttempts=Number(r.failedAttempts||0)+1;r.updatedAt=store.now();
        if(r.failedAttempts>=5)r.lockedUntil=new Date(Date.now()+15*60000).toISOString();
        const e=store.err(r.failedAttempts>=5?'LOCKED':'INVALID_PIN',r.failedAttempts>=5?'Zu viele falsche Eingaben.':'PIN ist nicht korrekt.',r.failedAttempts>=5?423:401);e.recordToSave=r;throw e;
      }
      const iso=store.now();uploadKey=crypto.randomBytes(32).toString('hex');
      r.status='confirmed';r.confirmedAt=iso;r.updatedAt=iso;r.failedAttempts=0;r.lockedUntil=null;r.palletReturned=returned;
      r.uploadKeyHash=store.hash(uploadKey);r.uploadKeyExpiresAt=new Date(Date.now()+2*3600000).toISOString();
      return r;
    }).catch(async function(e){if(e.recordToSave){try{await store.mutateRecord(token,async()=>e.recordToSave)}catch(_){}}throw e});
    const scanPod=await store.createConfirmationPod(rec);
    rec=await store.mutateRecord(token,async function(r){r.podFiles=Array.isArray(r.podFiles)?r.podFiles:[];if(!r.podFiles.some(x=>x.id===scanPod.id||x.kind==='scan-confirmation'))r.podFiles.unshift(scanPod);r.updatedAt=store.now();return r});
    try{await store.updateTeam(rec,[scanPod])}catch(e){context.log.error('Team state update failed',e)}
    context.res=store.json(200,{ok:true,status:'confirmed',confirmedAt:rec.confirmedAt,uploadKey,uploadExpiresAt:rec.uploadKeyExpiresAt,podCount:rec.podFiles.filter(x=>x.kind!=='scan-confirmation').length,scanConfirmation:true,palletOut:Math.max(0,Number(rec.palletOut||0)),palletReturned:Math.max(0,Number(rec.palletReturned||0))});
  }catch(e){context.res=store.json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Bestätigung fehlgeschlagen.'})}
};
