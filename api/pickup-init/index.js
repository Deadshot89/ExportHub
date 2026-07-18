'use strict';
const store=require('../shared/pickup-store');
const registration=require('../shared/pickup-registration');
const config=require('../shared/pickup-config');
module.exports=async function(context,req){
 if(req.method!=='POST'){context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'POST'});return}
 if(!store.principal(req)&&process.env.AZURE_FUNCTIONS_ENVIRONMENT!=='Development'){context.res=store.json(401,{ok:false,code:'AUTH_REQUIRED',message:'Microsoft-Anmeldung erforderlich.'});return}
 try{
  const b=store.body(req),token=String(b.token||'').toLowerCase();if(!store.validToken(token))throw store.err('INVALID_TOKEN','Ungültiges QR-Token.',400);
  const cc=await config.current(store),pin=cc.value.pin,pinRevision=Number(cc.value.revision||1),clients=cc.clients,blob=store.recordBlob(clients.records,token);let result=null;
  for(let attempt=0;attempt<6;attempt++){
   const old=await store.readJson(blob);result=registration.prepareRegistration(old.value,{token,pin,pinRevision,shipmentId:b.shipmentId,reference:b.reference,customer:b.customer,recipient:b.recipient,expiresDays:b.expiresDays},{hash:store.hash,now:store.now});
   try{await store.writeJson(blob,result.record,old.etag);break}catch(e){if(e&&e.statusCode===412&&attempt<5)continue;throw e}
  }
  context.res=store.json(200,Object.assign(store.publicRecord(result.record),{registered:true,idempotent:result.idempotent,rotated:result.rotated,credentialVersion:result.credentialVersion,pinRevision,version:'RC538',updatedBy:store.actor(req)}));
 }catch(e){context.log&&context.log.error&&context.log.error(e);context.res=store.json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Initialisierung fehlgeschlagen.'})}
};
