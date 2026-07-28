'use strict';
const crypto=require('crypto');
const store=require('../shared/pickup-store');

function pinHash(pin){
  const secret=process.env.EXPORTHUB_PICKUP_SECRET||process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||'exporthub-local-secret';
  return crypto.createHmac('sha256',secret).update(String(pin||'')).digest('hex');
}

module.exports=async function(context,req){
  if(req.method==='OPTIONS'){
    context.res={status:204,headers:{'Cache-Control':'no-store'},body:''};
    return;
  }
  if(req.method!=='POST'){
    context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Nur POST ist erlaubt.'},{Allow:'POST, OPTIONS'});
    return;
  }
  try{
    const b=store.body(req),token=String(b.token||'').trim().toLowerCase(),pin=String(b.pin||'').trim();
    if(!store.validToken(token))throw store.err('INVALID_TOKEN','Ungültiges QR-Token. Erlaubt sind 6 bis 64 alphanumerische Zeichen.',400);
    if(!/^\d{4}$/.test(pin))throw store.err('INVALID_PIN','Die persönliche Verlader-PIN muss vier Ziffern enthalten.',400);

    const c=await store.clients(),blob=store.recordBlob(c.records,token),old=await store.readJson(blob),previous=old.value||{};
    const days=Math.min(365,Math.max(1,Number(b.expiresDays||180)||180)),created=previous.createdAt||store.now();
    const hasSignature=!!previous.signatureBlobName;
    const allowPinRefresh=!hasSignature&&(b.force===true||b.reactivate===true||!previous.pinHash);
    const rec=Object.assign({},previous,{
      token:token,
      shipmentId:String(b.shipmentId||previous.shipmentId||''),
      reference:String(b.reference||b.ref||previous.reference||previous.ref||''),
      customer:String(b.customer||b.customerName||previous.customer||previous.customerName||''),
      recipient:String(b.recipient||previous.recipient||''),
      pinHash:allowPinRefresh?pinHash(pin):(previous.pinHash||pinHash(pin)),
      status:previous.confirmedAt?'confirmed':'open',
      createdAt:created,
      updatedAt:store.now(),
      expiresAt:previous.confirmedAt&&previous.expiresAt?previous.expiresAt:new Date(Date.now()+days*86400000).toISOString(),
      confirmedAt:previous.confirmedAt||null,
      failedAttempts:Number(previous.failedAttempts||0),
      lockedUntil:previous.lockedUntil||null,
      podFiles:Array.isArray(previous.podFiles)?previous.podFiles:[],
      pickupQrVersion:Number(b.pickupQrVersion||b.version||9),
      loaderId:String(b.loaderId||previous.loaderId||''),
      loaderName:String(b.loaderName||b.loadedBy||b.loader||b.verlader||previous.loaderName||''),
      disabled:b.disabled===true,
      active:b.active!==false
    });
    await store.writeJson(blob,rec,old.etag);
    context.res=store.json(200,Object.assign(store.publicRecord(rec),{
      registered:true,
      registrationVersion:'RC266',
      tokenLength:token.length,
      recordCreated:!old.value,
      pinRefreshed:allowPinRefresh
    }));
  }catch(e){
    if(context.log&&context.log.error)context.log.error('pickup-init error',e&&e.code,e&&e.message);
    context.res=store.json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Initialisierung fehlgeschlagen.'});
  }
};
