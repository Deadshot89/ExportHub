'use strict';

const auth=require('../shared/auth-store');
const store=require('../shared/customer-portal-store');

function text(v){return String(v==null?'':v).trim()}
function body(req){return auth.body(req)}
function response(status,value){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','X-Content-Type-Options':'nosniff'},body:JSON.stringify(value)}}
function rights(user){
 if(auth.isAdmin(user))return{use:true,manage:true};
 const r=user&&user.rights&&user.rights.customerPortal||{};
 return{use:r.use===true||r.manage===true,manage:r.manage===true};
}
function customerIdOf(c){return text(c&&(c.id||c.customerId||c.account||c.customerNumber||c.number||c.name))}
function customerExists(team,customerId){
 const key=text(customerId),state=team&&team.state||{},lists=[state.customers,team&&team.customers];
 return lists.some(list=>Array.isArray(list)&&list.some(c=>customerIdOf(c)===key));
}
function actorName(user){return text(user&&(user.name||user.displayName||user.user||user.username))||'Benutzer'}
async function audit(req,type,user,details){
 await auth.mutateTeamForRequest(req,team=>{auth.addAudit(team,type,actorName(user),details);return true});
}
function ensureUse(r){if(!r.use)throw auth.error('CUSTOMER_PORTAL_USE_REQUIRED','Für Kundenportal-Zugangsdaten fehlt die Berechtigung.',403)}
function ensureManage(r){if(!r.manage)throw auth.error('CUSTOMER_PORTAL_MANAGE_REQUIRED','Für die Verwaltung von Kundenportal-Zugangsdaten fehlt die Berechtigung.',403)}
function ensureCustomer(current,customerId){
 const id=text(customerId);if(!id)throw auth.error('CUSTOMER_REQUIRED','Bitte einen Kunden auswählen.',400);
 if(!customerExists(current.team,id))throw auth.error('CUSTOMER_NOT_FOUND','Kunde wurde nicht gefunden.',404);
 return id;
}
async function revealDenied(req,current,customerId,portalId){
 try{await audit(req,'CUSTOMER_PORTAL_REVEAL_DENIED',current.user,{customerId,portalId})}catch(_){}
}

module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:''};return}
 if(req.method!=='POST'){context.res=response(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Nur POST ist erlaubt.'});return}
 try{
  const payload=body(req),current=await auth.validateSession(req),r=rights(current.user),action=text(payload.action||'list').toLowerCase();
  ensureUse(r);
  const customerId=ensureCustomer(current,payload.customerId),environment=auth.environmentFromRequest(req);
  if(action==='list'){
   let portals=await store.listMetadata(environment,customerId);
   if(!r.manage)portals=portals.filter(p=>p.active!==false);
   context.res=response(200,{ok:true,customerId,portals,canManage:r.manage,version:'RC1159'});return;
  }
  if(action==='create'){
   ensureManage(r);
   const portal=await store.create(environment,customerId,payload.portal,actorName(current.user));
   await audit(req,'CUSTOMER_PORTAL_CREATED',current.user,{customerId,portalId:portal.id,portalName:portal.name});
   context.res=response(201,{ok:true,customerId,portal,version:'RC1159'});return;
  }
  if(action==='update'){
   ensureManage(r);
   const portal=await store.update(environment,customerId,payload.portalId,payload.portal,actorName(current.user));
   await audit(req,'CUSTOMER_PORTAL_UPDATED',current.user,{customerId,portalId:portal.id,portalName:portal.name});
   context.res=response(200,{ok:true,customerId,portal,version:'RC1159'});return;
  }
  if(action==='delete'){
   ensureManage(r);
   const portal=await store.remove(environment,customerId,payload.portalId);
   await audit(req,'CUSTOMER_PORTAL_DELETED',current.user,{customerId,portalId:portal.id,portalName:portal.name});
   context.res=response(200,{ok:true,customerId,deleted:true,portalId:portal.id,version:'RC1159'});return;
  }
  if(action==='reveal'){
   const password=String(payload.password||'');
   const credential=auth.credentialOf(current.user);
   if(!password||!credential||!auth.verifyCredential(password,credential)){
    await revealDenied(req,current,customerId,text(payload.portalId));
    throw auth.error('REAUTH_FAILED','Das ExportHUB-Passwort ist nicht korrekt.',401);
   }
   const revealed=await store.reveal(environment,customerId,payload.portalId);
   await audit(req,'CUSTOMER_PORTAL_REVEALED',current.user,{customerId,portalId:revealed.portal.id,portalName:revealed.portal.name});
   context.res=response(200,{ok:true,customerId,portal:revealed.portal,username:revealed.username,password:revealed.password,expiresInSeconds:60,version:'RC1159'});return;
  }
  throw auth.error('ACTION_INVALID','Unbekannte Kundenportal-Aktion.',400);
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('customer-portal-credentials',e&&e.code,e&&e.message)}catch(_){}
  context.res=response(Number(e&&e.status||e&&e.statusCode||500),{ok:false,code:e&&e.code||'SERVER_ERROR',message:e&&e.message||'Kundenportal-Zugangsdaten konnten nicht verarbeitet werden.'});
 }
};
