'use strict';
const store=require('../shared/pickup-store');
const cfg=require('../shared/pickup-config');
const policy=require('../shared/user-policy');
function text(v){return String(v==null?'':v).trim().toLowerCase()}
async function adminAllowed(req){
  if(process.env.AZURE_FUNCTIONS_ENVIRONMENT==='Development')return true;
  const p=store.principal(req);if(!p)return false;
  if((p.userRoles||[]).some(r=>/admin/i.test(String(r))))return true;
  const c=await store.clients(),d=await store.readJson(c.team.getBlockBlobClient(store.TEAM_BLOB)),doc=d.value||{},users=[...(Array.isArray(doc.users)?doc.users:[]),...(doc.state&&Array.isArray(doc.state.users)?doc.state.users:[])];
  const ids=[p.userDetails,p.userId].map(text).filter(Boolean);
  const u=users.find(x=>[x.microsoftEmail,x.email,x.mail,x.user,x.login,x.username,x.name].map(text).some(v=>v&&ids.includes(v)));
  return policy.isAdmin(u);
}
module.exports=async function(context,req){
  try{
    const p=store.principal(req);if(!p&&process.env.AZURE_FUNCTIONS_ENVIRONMENT!=='Development'){context.res=store.json(401,{ok:false,code:'AUTH_REQUIRED',message:'Microsoft-Anmeldung erforderlich.'});return}
    if(req.method==='GET'){
      const got=await cfg.current(store);context.res=store.json(200,{ok:true,pin:got.value.pin,revision:Number(got.value.revision||1),updatedAt:got.value.updatedAt||null,updatedBy:got.value.updatedBy||''});return;
    }
    if(req.method!=='POST'){context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'GET, POST'});return}
    if(!(await adminAllowed(req))){context.res=store.json(403,{ok:false,code:'ADMIN_REQUIRED',message:'Nur Administratoren dürfen die zentrale QR-PIN ändern.'});return}
    const b=store.body(req),value=await cfg.setPin(store,String(b.pin||''),store.actor(req));
    context.res=store.json(200,{ok:true,pin:value.pin,revision:value.revision,updatedAt:value.updatedAt,updatedBy:value.updatedBy});
  }catch(e){context.log&&context.log.error&&context.log.error(e);context.res=store.json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'PIN-Konfiguration fehlgeschlagen.'})}
};
