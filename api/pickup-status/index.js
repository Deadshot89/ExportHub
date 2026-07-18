'use strict';
const store=require('../shared/pickup-store');
module.exports=async function(context,req){
  try{
    const token=String(req.query&&req.query.token||'').toLowerCase();
    const got=await store.getRecord(token);
    if(got.record.confirmedAt){
      context.res=store.json(410,{ok:false,code:'USED',message:'Dieser QR-Code wurde bereits verwendet und ist dauerhaft gesperrt.'});
      return;
    }
    if(store.expired(got.record)){
      context.res=store.json(410,{ok:false,code:'EXPIRED',message:'Dieser QR-Code ist abgelaufen.'});
      return;
    }
    context.res=store.json(200,store.publicRecord(got.record));
  }catch(e){
    context.res=store.json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Status konnte nicht gelesen werden.'});
  }
};
