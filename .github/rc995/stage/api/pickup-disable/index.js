'use strict';
const access=require('../shared/public-access-store');
const store=require('../shared/pickup-store');
const auth=require('../shared/auth-store');
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{'Cache-Control':'no-store','Allow':'POST, OPTIONS'},body:''};return}if(req.method!=='POST'){context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'POST, OPTIONS'});return}
 try{const session=await auth.validateSession(req);if(!auth.hasAnyEditRight(session.user))throw auth.error('WRITE_FORBIDDEN','Für das Deaktivieren fehlen Bearbeitungsrechte.',403);const b=store.body(req),subjectId=String(b.shipmentId||b.id||b.reference||b.ref||'').trim();if(!subjectId)throw store.err('SHIPMENT_REQUIRED','Sendung für QR-Deaktivierung fehlt.',400);const result=await access.revokeSubject(req,'pickup',subjectId,String(b.reason||'manual').slice(0,160),session.user.name||session.user.user||'ExportHUB',b);context.res=store.json(200,{ok:true,disabled:true,environment:result.environment,version:'RC995'})}catch(e){context.log&&context.log.error&&context.log.error('pickup-disable RC995',e&&e.code,e&&e.message);context.res=store.json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Deaktivieren fehlgeschlagen.'})}
};
