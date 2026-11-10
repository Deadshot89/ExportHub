'use strict';
const auth=require('../shared/auth-store');
const notice=require('../shared/avis-notice-store');
function response(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'},body:JSON.stringify(body)}}
module.exports=async function(context,req){
 try{
  const env=auth.environmentFromRequest(req),method=String(req.method||'GET').toUpperCase();
  if(method==='OPTIONS'){context.res={status:204,headers:{Allow:'GET, POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
  if(method==='GET'){
   const admin=String((req.query||{}).admin||'')==='1';
   if(admin){const current=await auth.validateSession(req);if(!auth.isAdmin(current.user))throw auth.error('AVIS_NOTICE_FORBIDDEN','Nur Administratoren dürfen Avis-Einstellungen verwalten.',403)}
   const wantsMail=String((req.query||{}).mail||'')==='1';
   if(wantsMail){
    const current=await auth.validateSession(req),rights=current.user&&current.user.rights||{};
    const canEdit=r=>r&&(r.edit===true||r.admin===true||r.functionAdmin===true||['edit','admin'].includes(String(r.level||r.access||'').toLowerCase()));
    if(!auth.isAdmin(current.user)&&!canEdit(rights.shipmentoverview)&&!canEdit(rights.shipment))throw auth.error('AVIS_NOTICE_FORBIDDEN','Für Mailvorlagen ist Bearbeitungsrecht in der Sendungsübersicht erforderlich.',403);
   }
   const data=(await notice.load(env)).value;
   context.res=response(200,admin?{ok:true,config:data}:wantsMail?{ok:true,mailText:notice.emailBlock(data,(req.query||{}).lang,new Date())}:{ok:true,notice:notice.publicNotice(data,(req.query||{}).lang,new Date())});
   return;
  }
  if(method==='POST'){
   const headers=req.headers||{},csrf=headers['x-exporthub-avis-settings']||headers['X-ExportHUB-Avis-Settings']||'';
   const contentType=headers['content-type']||headers['Content-Type']||'';
   if(csrf!=='1'||!/^application\/json(?:;|$)/i.test(String(contentType)))throw auth.error('AVIS_NOTICE_REQUEST_INVALID','Nur bestätigte JSON-Einstellungsanfragen sind erlaubt.',403);
   const current=await auth.validateSession(req);
   if(!auth.isAdmin(current.user))throw auth.error('AVIS_NOTICE_FORBIDDEN','Nur Administratoren dürfen Avis-Einstellungen verwalten.',403);
   // This endpoint updates only the isolated notice document, never shipment or team-state.
   const config=await notice.save(env,auth.body(req));
   context.res=response(200,{ok:true,config});
   return;
  }
  context.res=response(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
 }catch(e){
  const status=e.status||e.statusCode||500;
  context.res=response(status,{ok:false,code:status>=500?'AVIS_NOTICE_UNAVAILABLE':e.code||'AVIS_NOTICE_INVALID',message:status>=500?'Avis-Einstellungen sind momentan nicht verfügbar.':e.message||'Ungültige Avis-Einstellung.'});
 }
};