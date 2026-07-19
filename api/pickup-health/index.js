'use strict';
const store=require('../shared/pickup-store');
const auth=require('../shared/auth-store');
module.exports=async function(context,req){
  try{
    await auth.validateSession(req);
    await store.clients();
    context.res=store.json(200,{ok:true,api:true,storage:true,version:'RC544',containers:{records:store.RECORD_CONTAINER,pod:store.POD_CONTAINER,team:store.TEAM_CONTAINER}})
  }catch(e){context.log.error(e);context.res=store.json(e.status||500,{ok:false,api:true,storage:false,code:e.code||'SERVER_ERROR',message:e.message||'Unbekannter Fehler.'})}
};
