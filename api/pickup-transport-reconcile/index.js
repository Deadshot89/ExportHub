'use strict';

// RC1878: authenticated, event-driven REF reconciliation using only current
// server-side team, pickup, FIX and main transport-binding evidence.
const auth=require('../shared/auth-store');
const fast=require('../shared/fast-auth-store');
const company=require('../shared/company-context');
const rights=require('../shared/state-write-guard');
const fixed=require('../shared/fixed-pickup-store');
const access=require('../shared/public-access-store');
const pickup=require('../shared/pickup-store');
const bindings=require('../shared/pickup-transport-binding-store');
const links=require('../shared/pickup-transport-link-store');
const registration=require('../shared/pickup-transport-registration-proof');
const service=require('../shared/pickup-transport-reconcile');
const i18n=require('../shared/i18n');
async function session(req){
 return fast&&typeof fast.isSource==='function'&&fast.isSource(auth)?
  fast.validateSession(req):auth.validateSession(req);
}
function deny(req,code,status){throw auth.error(code,i18n.t(req,'api.pickupLinks.loadFailed'),status)}
module.exports=async function(context,req){
 const method=String(req&&req.method||'POST').toUpperCase();
 if(method==='OPTIONS'){context.res=auth.json(204,{}, {'Allow':'POST, OPTIONS'});return}
 try{
  if(method!=='POST')deny(req,'METHOD_NOT_ALLOWED',405);
  const logged=await session(req),tenant=company.resolveCompanyContext(req,logged.user);
  if(!rights.canReadAny(logged.user,['pickupcalendar'])||
     !rights.canEditAny(logged.user,['planning'])||
     !rights.canReadAny(logged.user,['shipment']))
   deny(req,'RECONCILE_FORBIDDEN',403);
  const payload=auth.body(req),environment=fixed.resolveEnvironment(req,payload);
  if(auth.environmentFromRequest(req)!==environment)deny(req,'ENVIRONMENT_MISMATCH',409);
  const requested=Array.isArray(payload.dates)?payload.dates:[payload.pickupDate];
  if(!requested.length||requested.length>5||
     requested.some(d=>typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)))
   deny(req,'RECONCILE_DATES_INVALID',400);
  const dates=[...new Set(requested)];
  const clients=await auth.clientsForEnvironment(environment);
  const d=await auth.readJson(clients.team,auth.emptyTeam()),team=d.value||auth.emptyTeam();
  const actor=String(logged.user.id||logged.user.user||logged.user.login||logged.user.name||'').trim();
  const reports=[];
  for(const pickupDate of dates){
   reports.push(await service.reconcile({
    environment,companyKey:tenant.companyKey,pickupDate,team,actor,
    bindingStore:bindings,linkStore:links,registrationProof:registration,
    accessStore:access,pickupStore:pickup,fixedStore:fixed
   }));
  }
  context.res=auth.json(200,{ok:true,environment,companyKey:tenant.companyKey,
   reports,totalAdded:reports.reduce((n,r)=>n+(r.added||[]).length,0)});
 }catch(e){
  const status=Number(e&&(e.status||e.statusCode))||500;
  const code=String(e&&e.code||'');
  // Return only whitelisted business codes, not Azure diagnostics.
  const known=status<500&&/^(?:AUTH_|SESSION_|ACCOUNT_DISABLED|PASSWORD_CHANGE_REQUIRED|COMPANY_FORBIDDEN|ENVIRONMENT_|METHOD_NOT_ALLOWED|RECONCILE_|LINK_)/.test(code);
  context.res=auth.json(status,{ok:false,code:known?code:'PICKUP_TRANSPORT_RECONCILE_FAILED',
   message:i18n.t(req,'api.pickupLinks.loadFailed')});
 }
};
