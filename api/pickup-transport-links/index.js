'use strict';

// RC1876: authenticated read-only window into concrete pickup/transport links.
// No browser-originated write request is accepted here. Manual and automatic
// writes require a future server-side evidence reader and edit authorization.
const auth=require('../shared/auth-store');
const fastAuth=require('../shared/fast-auth-store');
const company=require('../shared/company-context');
const rights=require('../shared/state-write-guard');
const fixed=require('../shared/fixed-pickup-store');
const ledger=require('../shared/pickup-transport-link-store');
const apiI18n=require('../shared/i18n');

async function session(req){
 if(fastAuth&&typeof fastAuth.isSource==='function'&&fastAuth.isSource(auth))
   return fastAuth.validateSession(req);
 return auth.validateSession(req);
}
module.exports=async function(context,req){
 const method=String(req&&req.method||'GET').toUpperCase();
 if(method==='OPTIONS'){context.res=auth.json(204,{}, {'Allow':'GET, OPTIONS'});return}
 try{
   if(method!=='GET')throw auth.error('METHOD_NOT_ALLOWED',apiI18n.t(req,'api.common.getOnly'),405);
   const current=await session(req);
   if(!rights.canReadAny(current.user,['pickupcalendar']))
     throw auth.error('PICKUP_LINK_READ_FORBIDDEN',apiI18n.t(req,'api.pickupLinks.readForbidden'),403);
   const tenant=company.resolveCompanyContext(req,current.user);
   const environment=fixed.resolveEnvironment(req,{});
   const auditWanted=String(req&&req.query&&req.query.includeAudit||'')==='1';
   const includeAudit=auditWanted&&rights.canEditAny(current.user,['pickupcalendar']);
   const snapshot=await ledger.read({companyKey:tenant.companyKey,environment},{includeAudit});
   context.res=auth.json(200,{ok:true,...snapshot,canEdit:!!rights.canEditAny(current.user,['pickupcalendar'])});
 }catch(e){
   context.res=auth.json(Number(e&&(e.status||e.statusCode))||500,{
     ok:false,code:e&&e.code||'PICKUP_TRANSPORT_LINK_READ_FAILED',
     message:String(e&&e.message||apiI18n.t(req,'api.pickupLinks.loadFailed'))
   });
 }
};
