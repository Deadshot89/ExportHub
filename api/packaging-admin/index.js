'use strict';
const auth=require('../shared/auth-store');
const packaging=require('../shared/packaging-admin-store');
const apiI18n=require('../shared/i18n');

const ERROR_KEYS=Object.freeze({
  METHOD_NOT_ALLOWED:'api.packaging.methodNotAllowed',
  GLOBAL_ADMIN_REQUIRED:'api.packaging.adminRequired',
  INVALID_ACTION:'api.packaging.invalidAction',
  PACKAGING_TIME_INVALID:'api.packaging.timeInvalid',
  PACKAGING_NOT_FOUND:'api.packaging.notFound',
  PACKAGING_NAME_REQUIRED:'api.packaging.nameRequired',
  PACKAGING_NAME_EXISTS:'api.packaging.nameExists',
  PACKAGING_CODE_EXISTS:'api.packaging.codeExists',
  AUTH_REQUIRED:'api.common.authRequired',
  SESSION_INVALID:'api.common.sessionInvalid',
  SESSION_REVOKED:'api.common.sessionRevoked',
  ACCOUNT_DISABLED:'api.common.accountDisabled',
  PASSWORD_CHANGE_REQUIRED:'api.common.passwordChangeRequired',
  STORAGE_NOT_CONFIGURED:'api.common.storageNotConfigured',
  ENVIRONMENT_INVALID:'api.common.environmentInvalid',
  SERVER_ERROR:'api.packaging.serverError'
});
function text(v){return String(v==null?'':v).trim();}
function json(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)};}
function body(req){if(req&&req.body&&typeof req.body==='object')return req.body;try{return JSON.parse(req&&req.body||'{}')}catch(_){return{}}}
function adminName(user){return text(user&&(user.name||user.displayName||user.user||user.username))||'Administrator';}
function messageFor(req,code){return apiI18n.t(req,ERROR_KEYS[code]||'api.packaging.serverError');}
function audit(team,event,actor,result,extra){const p=result&&result.packaging||{},before=result&&Object.prototype.hasOwnProperty.call(result,'before')?result.before:null,after=result&&Object.prototype.hasOwnProperty.call(result,'after')?result.after:(p&&Object.keys(p).length?p:null);auth.addAudit(team,event,actor,Object.assign({packagingId:text(p.id||before&&before.id||after&&after.id),packagingName:text(p.name||before&&before.name||after&&after.name),active:p.active!==false,before,after},extra||{}));}

module.exports=async function(context,req){
  if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return;}
  if(req.method!=='POST'){const code='METHOD_NOT_ALLOWED';context.res=json(405,{ok:false,code,message:messageFor(req,code)});return;}
  try{
    const payload=body(req),current=await auth.validateSession(req),user=current.user;
    if(!auth.isAdmin(user)){const code='GLOBAL_ADMIN_REQUIRED';throw auth.error(code,messageFor(req,code),403);}
    const environment=auth.environmentFromRequest(req),action=text(payload.action||'list').toLowerCase(),actor=adminName(user);
    if(action==='list'){
      const list=packaging.listPackaging(current.team&&current.team.state||{});
      context.res=json(200,{ok:true,packaging:list,count:list.length,environment});return;
    }
    const changed=await auth.mutateTeamForEnvironment(environment,team=>{
      team.state=team.state&&typeof team.state==='object'?team.state:{};
      let result;
      if(action==='create'){
        result=packaging.createPackaging(team.state,payload,actor,new Date().toISOString());
        team.state=result.state;audit(team,'PACKAGING_CREATED',actor,result,{code:text(result.packaging.code)});
      }else if(action==='update'){
        result=packaging.updatePackaging(team.state,payload.id,payload,actor,new Date().toISOString());
        team.state=result.state;audit(team,'PACKAGING_UPDATED',actor,result,{code:text(result.packaging.code)});
      }else if(action==='toggle'){
        const active=payload.active!==false;
        result=packaging.setPackagingActive(team.state,payload.id,active,actor,new Date().toISOString());
        team.state=result.state;audit(team,active?'PACKAGING_ACTIVATED':'PACKAGING_DEACTIVATED',actor,result);
      }else if(action==='delete'){
        result=packaging.removePackaging(team.state,payload.id,actor,new Date().toISOString());
        team.state=result.state;audit(team,result.archived?'PACKAGING_ARCHIVED':'PACKAGING_DELETED',actor,result,{archived:!!result.archived,deleted:!!result.deleted});
      }else{const code='INVALID_ACTION';throw auth.error(code,messageFor(req,code),400);}
      return result;
    });
    const result=changed.result||{};
    context.res=json(200,{ok:true,packaging:result.packaging||null,deleted:!!result.deleted,archived:!!result.archived,changed:result.changed!==false,environment});
  }catch(e){
    context.log&&context.log.error&&context.log.error('packaging-admin',e&&e.code,e&&e.message);
    const code=e&&e.code||'SERVER_ERROR';
    context.res=json(e&&e.status||e&&e.statusCode||500,{ok:false,code,message:messageFor(req,code)});
  }
};
