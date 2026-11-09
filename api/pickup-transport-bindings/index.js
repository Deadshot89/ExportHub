'use strict';

// RC1877: deliberately narrow, authenticated main-shipment-to-FIX binding.
// No public pickup token, browser-provided source evidence or full team write.
// This endpoint NEVER modifies shipment, QR, POD, ABD or pickup status.
const auth=require('../shared/auth-store');
const fastAuth=require('../shared/fast-auth-store');
const companies=require('../shared/company-context');
const rights=require('../shared/state-write-guard');
const fixed=require('../shared/fixed-pickup-store');
const accessStore=require('../shared/public-access-store');
const pickupStore=require('../shared/pickup-store');
const proof=require('../shared/pickup-transport-registration-proof');
const bindings=require('../shared/pickup-transport-binding-store');
const i18n=require('../shared/i18n');
async function session(req){
 return fastAuth&&typeof fastAuth.isSource==='function'&&fastAuth.isSource(auth)?
   fastAuth.validateSession(req):auth.validateSession(req);
}
function message(req){return i18n.t(req,'api.pickupLinks.loadFailed')}
function bad(req,code,status){throw auth.error(code,message(req),status)}
module.exports=async function(context,req){
 const method=String(req&&req.method||'GET').toUpperCase();
 if(method==='OPTIONS'){context.res=auth.json(204,{}, {'Allow':'GET, POST, OPTIONS'});return}
 try{
  if(!['GET','POST'].includes(method))bad(req,'METHOD_NOT_ALLOWED',405);
  const current=await session(req);
  const tenant=companies.resolveCompanyContext(req,current.user);
  const payload=method==='POST'?auth.body(req):{};
  const environment=fixed.resolveEnvironment(req,payload);
  if(auth.environmentFromRequest(req)!==environment)bad(req,'ENVIRONMENT_MISMATCH',409);
  if(!rights.canReadAny(current.user,['pickupcalendar']))bad(req,'PICKUP_LINK_READ_FORBIDDEN',403);
  const canEdit=rights.canEditAny(current.user,['planning'])&&rights.canReadAny(current.user,['shipment']);
  if(method==='GET'){
   const snapshot=await bindings.read({environment,companyKey:tenant.companyKey},{
     includeAudit:canEdit&&String(req.query&&req.query.includeAudit||'')==='1'
   });
   context.res=auth.json(200,{ok:true,...snapshot,canEdit});return;
  }
  if(!canEdit)bad(req,'PICKUP_LINK_WRITE_FORBIDDEN',403);
  const shipmentId=String(payload.shipmentId||'').trim(),
    pickupTargetId=String(payload.pickupTargetId||'').trim(),
    pickupDate=String(payload.pickupDate||'').trim();
  if(!shipmentId||shipmentId.length>256||!pickupTargetId||pickupTargetId.length>128||
     !/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)||!Number.isSafeInteger(payload.expectedRevision))
   bad(req,'BINDING_INPUT_INVALID',400);
  // Load fresh team state in the requested storage environment. A legacy
  // TESTSERVICE login may authenticate against production credentials;
  // its team snapshot must NEVER be mistaken for TESTSERVICE source evidence.
  const clients=await auth.clientsForEnvironment(environment);
  const doc=await auth.readJson(clients.team,auth.emptyTeam());
  const trustedTeam=doc.value||auth.emptyTeam();
  const verified=await proof.inspect({
   environment,companyKey:tenant.companyKey,pickupDate,pickupTargetId,shipmentId,
   team:trustedTeam,accessStore,pickupStore,fixedStore:fixed,
   bindingStore:bindings,permitNewBinding:true,confirmOverride:payload.confirmOverride===true
  });
  const actor=String(current.user.id||current.user.user||current.user.login||current.user.name||'').trim();
  const result=await bindings.applyBinding({
   environment,companyKey:tenant.companyKey,pickupTargetId,expectedRevision:payload.expectedRevision,
   actor,reason:String(payload.reason||'Sammeltransport im Abholkalender verbunden').trim(),
   confirmOverride:payload.confirmOverride===true,proof:verified
  });
  context.res=auth.json(200,{ok:true,...result});
 }catch(e){
  const status=Number(e&&(e.status||e.statusCode))||500;
  const safe=/^(?:AUTH_|SESSION_|ACCOUNT_DISABLED|PASSWORD_CHANGE_REQUIRED|COMPANY_FORBIDDEN|ENVIRONMENT_|PICKUP_LINK_|METHOD_NOT_ALLOWED|BINDING_|TRANSPORT_)/.test(String(e&&e.code||''));
  // Never serialize raw Azure error details or their authentication material.
  context.res=auth.json(status,{ok:false,
   code:status<500&&safe?e.code:'PICKUP_TRANSPORT_BINDING_FAILED',
   message:message(req)
  });
 }
};
