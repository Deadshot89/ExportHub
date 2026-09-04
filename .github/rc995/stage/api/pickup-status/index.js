'use strict';
const access=require('../shared/public-access-store');
const store=require('../shared/pickup-store');
function json(status,payload){return store.json(status,payload)}
module.exports=async function(context,req){
 const method=String(req&&req.method||'GET').toUpperCase();if(method==='OPTIONS'){context.res={status:204,headers:{'Cache-Control':'no-store'}};return}if(method!=='GET'&&method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Methode nicht erlaubt.'});return}
 try{const b=store.body(req)||{},q=req&&req.query||{},token=String(q.token||b.token||'').trim();const resolved=await access.resolve(req,'pickup',token,{allowUsed:false},b),got=await store.getRecord(resolved.tokenHash,resolved.environment),record=got.record||{};if(record.status==='disabled')throw store.err('PICKUP_DISABLED','Dieser QR-Code wurde deaktiviert.',410);if(record.confirmedAt)throw store.err('PICKUP_USED','Dieser QR-Code wurde bereits verwendet.',410);context.res=json(200,Object.assign({ok:true,oneTime:true,version:'RC995'},store.publicRecord(record,token)))}catch(e){const status=Number(e&& (e.status||e.statusCode)||0)||500;context.log&&context.log.error&&context.log.error('pickup-status RC995',e&&e.code,e&&e.message);context.res=json(status,{ok:false,code:e.code||'PICKUP_STATUS_FAILED',message:e.message||'Pickup-Status konnte nicht geladen werden.'})}
};
