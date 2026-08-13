'use strict';
const store=require('../shared/pickup-store');
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res=store.json(204,{}, {Allow:'GET, OPTIONS'});return}
 if(req.method!=='GET'){context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Nur GET ist erlaubt.'},{Allow:'GET, OPTIONS'});return}
 try{const token=String(req.query&&req.query.token||'').toLowerCase();if(!store.validToken(token))throw store.err('INVALID_TOKEN','Ungültiger QR-Code.',400);const got=await store.getRecord(token);if(store.expired(got.record)&&!got.record.confirmedAt)throw store.err('EXPIRED','QR-Code ist abgelaufen.',410);context.res=store.json(200,store.publicRecord(got.record))}
 catch(e){if(context.log&&context.log.error)context.log.error('pickup-status RC644',e&&e.code,e&&e.message);context.res=store.json(e.status||e.statusCode||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Status konnte nicht gelesen werden.'})}
};
