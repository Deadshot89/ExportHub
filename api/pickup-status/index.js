'use strict';
const store=require('../shared/pickup-store');
module.exports=async function(context,req){try{const token=String(req.query&&req.query.token||'').toLowerCase(),got=await store.getRecord(token);if(store.expired(got.record)&&!got.record.confirmedAt){context.res=store.json(410,{ok:false,code:'EXPIRED',message:'QR-Code ist abgelaufen.'});return}context.res=store.json(200,store.publicRecord(got.record))}catch(e){context.res=store.json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Status konnte nicht gelesen werden.'})}}
