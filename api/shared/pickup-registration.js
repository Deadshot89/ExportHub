'use strict';
function failure(code,message,status){const e=new Error(message);e.code=code;e.status=status||400;return e}
function positiveInt(value,fallback){const n=Number(value);return Number.isInteger(n)&&n>0?n:fallback}
function prepareRegistration(existing,input,helpers){
  const old=existing&&typeof existing==='object'?existing:null,hash=helpers&&helpers.hash,now=helpers&&helpers.now;
  if(typeof hash!=='function'||typeof now!=='function')throw failure('REGISTRATION_CONFIG','QR-Registrierung ist nicht vollständig konfiguriert.',500);
  if(!/^\d{4}$/.test(String(input.pin||'')))throw failure('INVALID_PIN','Die zentrale QR-PIN ist ungültig.',500);
  const stamp=now(),pinHash=hash(input.pin),oldHash=old&&old.pinHash||'',rotated=Boolean(oldHash&&oldHash!==pinHash);
  const currentVersion=positiveInt(old&&old.credentialVersion,old?1:0),credentialVersion=rotated?currentVersion+1:(currentVersion||1);
  const pinRevision=Math.max(1,Number(input.pinRevision||old&&old.pinRevision||1));
  const days=Math.min(365,Math.max(1,Number(input.expiresDays||180)));
  const record=Object.assign({},old||{}, {
    token:String(input.token||''),shipmentId:String(input.shipmentId||''),reference:String(input.reference||''),
    customer:String(input.customer||''),recipient:String(input.recipient||''),pinHash,pinLocked:true,
    credentialVersion,pinRevision,status:old&&old.suspended?'cancelled':(old&&old.confirmedAt?'confirmed':'open'),
    createdAt:old&&old.createdAt||stamp,updatedAt:stamp,
    expiresAt:old&&old.confirmedAt?old.expiresAt:new Date(Date.now()+days*86400000).toISOString(),
    confirmedAt:old&&old.confirmedAt||null,failedAttempts:old&&old.failedAttempts||0,lockedUntil:old&&old.lockedUntil||null,
    suspended:Boolean(old&&old.suspended),podFiles:Array.isArray(old&&old.podFiles)?old.podFiles:[]
  });
  return {record,idempotent:Boolean(oldHash&&oldHash===pinHash),rotated,credentialVersion,pinRevision};
}
module.exports={prepareRegistration};
