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
const registrationProof=require('../shared/pickup-transport-registration-proof');
const pickupAccess=require('../shared/public-access-store');
const pickupStore=require('../shared/pickup-store');
const bindingStore=require('../shared/pickup-transport-binding-store');

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
   // Explicit read-only proof request. All evidence is resolved server-side;
   // never accept browser-supplied "registered" or source data.
   const query=req&&req.query||{};
   if(Object.prototype.hasOwnProperty.call(query,'verifyShipmentId')){
     const shipmentId=String(query.verifyShipmentId||'').trim(),
       pickupTargetId=String(query.pickupTargetId||'').trim(),
       pickupDate=String(query.pickupDate||'').trim();
     if(!shipmentId||shipmentId.length>256||!pickupTargetId||pickupTargetId.length>128||
       !/^\d{4}-\d{2}-\d{2}$/.test(pickupDate))
       throw auth.error('TRANSPORT_SCOPE_INVALID',apiI18n.t(req,'api.pickupLinks.loadFailed'),400);
     // Always consult the requested environment's saved team state. Login
     // credentials may be shared with production during TESTSERVICE migration.
     const clients=await auth.clientsForEnvironment(environment);
     const doc=await auth.readJson(clients.team,auth.emptyTeam());
     const transport=await registrationProof.inspect({
       environment,companyKey:tenant.companyKey,pickupDate,pickupTargetId,
       shipmentId,team:doc.value||auth.emptyTeam(),accessStore:pickupAccess,
       pickupStore,fixedStore:fixed,bindingStore
     });
     context.res=auth.json(200,{ok:true,verified:true,transport});
     return;
   }
   const auditWanted=String(query.includeAudit||'')==='1';
   const includeAudit=auditWanted&&rights.canEditAny(current.user,['pickupcalendar']);
   const snapshot=await ledger.read({companyKey:tenant.companyKey,environment},{includeAudit});
   context.res=auth.json(200,{ok:true,...snapshot,canEdit:!!rights.canEditAny(current.user,['pickupcalendar'])});
 }catch(e){
   const status=Number(e&&(e.status||e.statusCode))||500,code=String(e&&e.code||'');
   // Keep unexpected Azure errors (including account names and paths) private.
   const known=status<500&&/^(?:AUTH_REQUIRED|SESSION_INVALID|SESSION_REVOKED|ACCOUNT_DISABLED|PASSWORD_CHANGE_REQUIRED|COMPANY_FORBIDDEN|ENVIRONMENT_INVALID|ENVIRONMENT_MISMATCH|METHOD_NOT_ALLOWED|PICKUP_LINK_READ_FORBIDDEN|LINK_[A-Z0-9_]+|TRANSPORT_[A-Z0-9_]+)$/.test(code);
   context.res=auth.json(status,{
     ok:false,code:known?code:'PICKUP_TRANSPORT_LINK_READ_FAILED',
     message:apiI18n.t(req,'api.pickupLinks.loadFailed')
   });
 }
};
