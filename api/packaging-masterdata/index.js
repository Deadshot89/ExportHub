'use strict';

const auth=require('../shared/auth-store');
const packaging=require('../shared/packaging-masterdata');

const ARCHIVE_MESSAGE='Diese Verpackung wurde bereits verwendet und kann aus Gründen der Datenhistorie nicht vollständig gelöscht werden. Sie wird deaktiviert und künftig nicht mehr zur Auswahl angeboten.';
function text(value){return String(value==null?'':value).trim();}
function actorOf(user){return{id:text(user&&user.id),name:text(user&&(user.name||user.displayName||user.user||user.username))||'Admin'};}
function audit(team,type,actor,change){
  auth.addAudit(team,type,actor.name,{entityType:'packaging_type',entityId:text(change&&change.after&&change.after.id||change&&change.before&&change.before.id),packagingName:text(change&&change.after&&change.after.name||change&&change.before&&change.before.name),before:change&&change.before||null,after:change&&change.after||null});
}
function errorResponse(req,e){const status=Number(e&&(e.status||e.statusCode))||500;return auth.json(status,{ok:false,code:e&&e.code||'PACKAGING_MASTERDATA_FAILED',message:text(e&&e.message)||'Verpackungsstammdaten konnten nicht verarbeitet werden.'});}

module.exports=async function(context,req){
  const method=String(req&&req.method||'GET').toUpperCase();
  if(method==='OPTIONS'){context.res=auth.json(204,{});return;}
  try{
    if(!['GET','POST','PATCH','DELETE'].includes(method))throw auth.error('METHOD_NOT_ALLOWED','Methode nicht erlaubt.',405);
    const current=await auth.validateSession(req),user=current&&current.user||{},canEdit=auth.isAdmin(user),payload=auth.body(req),state=current&&current.team&&current.team.state||{};
    if(method==='GET'){
      packaging.migratePackagingState(state);
      const includeInactive=canEdit&&String(req&&req.query&&req.query.includeInactive||'')==='1';
      context.res=auth.json(200,{ok:true,items:packaging.listPackaging(state,{includeInactive,admin:canEdit}),canEdit});
      return;
    }
    if(!canEdit)throw auth.error('ADMIN_REQUIRED','Nur Administratoren dürfen Verpackungsstammdaten ändern.',403);
    const who=actorOf(user);
    const result=await auth.mutateTeamForRequest(req,team=>{
      if(!team.state||typeof team.state!=='object')team.state={};
      packaging.migratePackagingState(team.state);
      let change,type;
      if(method==='POST'){
        const action=text(payload.action||'create').toLowerCase();
        if(action==='create'){change=packaging.createPackaging(team.state,payload,who);type='packaging.created';}
        else if(action==='duplicate'){change=packaging.duplicatePackaging(team.state,payload.id,payload,who);type='packaging.created';}
        else throw auth.error('PACKAGING_ACTION_INVALID','Ungültige Verpackungsaktion.',400);
      }else if(method==='PATCH'){
        const action=text(payload.action||'update').toLowerCase();
        if(action==='update'){change=packaging.updatePackaging(team.state,payload.id,payload,who);type='packaging.updated';}
        else if(action==='activate'){change=packaging.setPackagingActive(team.state,payload.id,true,who);type='packaging.activated';}
        else if(action==='deactivate'){change=packaging.setPackagingActive(team.state,payload.id,false,who);type='packaging.deactivated';}
        else throw auth.error('PACKAGING_ACTION_INVALID','Ungültige Verpackungsaktion.',400);
      }else{
        change=packaging.deleteOrArchivePackaging(team.state,payload.id,who);
        type=change.archived?'packaging.deactivated':'packaging.deleted';
      }
      audit(team,type,who,change);
      return change;
    });
    if(method==='DELETE'){
      context.res=auth.json(200,{ok:true,...result,message:result.archived?ARCHIVE_MESSAGE:'Verpackung wurde gelöscht.'});
      return;
    }
    context.res=auth.json(method==='POST'?201:200,{ok:true,item:result.after,before:result.before||null});
  }catch(e){context.res=errorResponse(req,e);}
};

module.exports.ARCHIVE_MESSAGE=ARCHIVE_MESSAGE;
