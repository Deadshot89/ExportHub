'use strict';
const store=require('../shared/pickup-store');
module.exports=async function(context,req){
  if(req.method!=='POST'){context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'POST'});return}
  if(!store.principal(req)&&process.env.AZURE_FUNCTIONS_ENVIRONMENT!=='Development'){context.res=store.json(401,{ok:false,code:'AUTH_REQUIRED',message:'Microsoft-Anmeldung erforderlich.'});return}
  try{
    const b=store.body(req),token=String(b.token||'').toLowerCase();
    if(!store.validToken(token))throw store.err('INVALID_TOKEN','Ungültiges QR-Token.',400);
    const c=await store.clients(),blob=store.recordBlob(c.records,token),old=await store.readJson(blob),days=Math.min(365,Math.max(1,Number(b.expiresDays||180))),created=old.value&&old.value.createdAt||store.now();
    const rec=Object.assign({},old.value||{}, {
      token,
      shipmentId:String(b.shipmentId||''),
      reference:String(b.reference||''),
      customer:String(b.customer||''),
      recipient:String(b.recipient||''),
      palletOut:Math.max(0,Math.round(Number(b.palletOut||0))),
      partyKey:String(b.partyKey||''),
      partyType:String(b.partyType||''),
      partyName:String(b.partyName||''),
      customerId:String(b.customerId||''),
      customerName:String(b.customerName||b.customer||''),
      status:old.value&&old.value.confirmedAt?'confirmed':'open',
      createdAt:created,
      updatedAt:store.now(),
      expiresAt:old.value&&old.value.confirmedAt?old.value.expiresAt:new Date(Date.now()+days*86400000).toISOString(),
      confirmedAt:old.value&&old.value.confirmedAt||null,
      palletReturned:old.value&&old.value.confirmedAt?Math.max(0,Number(old.value.palletReturned||0)):0,
      failedAttempts:old.value&&old.value.failedAttempts||0,
      lockedUntil:old.value&&old.value.lockedUntil||null,
      podFiles:Array.isArray(old.value&&old.value.podFiles)?old.value.podFiles:[]
    });
    await store.writeJson(blob,rec,old.etag);
    context.res=store.json(200,Object.assign(store.publicRecord(rec),{registered:true,version:'RC541',updatedBy:store.actor(req)}));
  }catch(e){context.log.error(e);context.res=store.json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Initialisierung fehlgeschlagen.'})}
};
