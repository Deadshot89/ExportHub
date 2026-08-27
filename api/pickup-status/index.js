'use strict';
const store=require('../shared/pickup-store');
function text(v){return String(v==null?'':v).trim()}
function json(status,body){return store.json(status,body,{'Cache-Control':'no-store, no-cache, must-revalidate'})}
module.exports=async function(context,req){
  if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'GET, OPTIONS','Cache-Control':'no-store'},body:''};return}
  if(req.method!=='GET'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Nur GET ist erlaubt.'});return}
  try{
    const token=text(req.query&&req.query.token).toLowerCase();
    if(!token)throw store.err('TOKEN_REQUIRED','QR-Token fehlt.',400);
    if(!store.validToken(token))throw store.err('INVALID_TOKEN','Ungültiger QR-Code.',404);
    const got=await store.getRecord(token),rec=got.record||{},pub=store.publicRecord(rec),confirmed=!!rec.confirmedAt||String(rec.status||'').toLowerCase()==='confirmed';
    context.res=json(200,Object.assign({},pub,{confirmed,used:confirmed,completedAt:rec.confirmedAt||null,pickupConfirmedAt:rec.confirmedAt||null,serverTime:new Date().toISOString(),version:'RC872'}));
  }catch(e){
    context.log&&context.log.error&&context.log.error('pickup-status RC872',e&&e.code,e&&e.message);
    context.res=json(e.status||e.statusCode||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Pickup-Status konnte nicht geladen werden.'});
  }
}
