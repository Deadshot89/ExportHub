'use strict';
const store=require('../shared/pickup-store');

function looseToken(value){
  const token=String(value||'').trim().toLowerCase();
  if(token.length<6||token.length>128)throw store.err('INVALID_TOKEN','Ungültiger QR-Code.',404);
  return token;
}
async function getRecordLoose(token){
  const c=await store.clients(),blob=store.recordBlob(c.records,token),r=await store.readJson(blob);
  if(!r.value)throw store.err('NOT_FOUND','QR-Code nicht gefunden.',404);
  return {clients:c,blob:blob,record:r.value,etag:r.etag};
}
module.exports=async function(context,req){
  if(req.method==='OPTIONS'){
    context.res={status:204,headers:{'Cache-Control':'no-store'},body:''};
    return;
  }
  if(req.method!=='GET'){
    context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'GET, OPTIONS'});
    return;
  }
  try{
    const token=looseToken(req.query&&(req.query.token||req.query.t)),got=await getRecordLoose(token);
    if(store.expired(got.record)&&!got.record.confirmedAt){context.res=store.json(410,{ok:false,code:'EXPIRED',message:'QR-Code ist abgelaufen.'});return}
    context.res=store.json(200,store.publicRecord(got.record));
  }catch(e){
    if(context.log&&context.log.error)context.log.error('pickup-status error',e&&e.code,e&&e.message);
    context.res=store.json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Status konnte nicht gelesen werden.'});
  }
};
