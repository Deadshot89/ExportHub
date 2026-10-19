'use strict';

// RC1577: admin-only, read-only POD quality report (see api/shared/pod-quality-audit.js).
const auth=require('../shared/auth-store');
const audit=require('../shared/pod-quality-audit');

function json(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)};}
function body(req){if(req&&req.body&&typeof req.body==='object')return req.body;try{return JSON.parse(req&&req.body||'{}')}catch(_){return{}}}
function text(v){return String(v==null?'':v).trim()}

module.exports=async function(context,req){
  if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return;}
  if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED',version:audit.VERSION});return;}
  try{
    const payload=body(req),current=await auth.validateSession(req);
    if(!auth.isAdmin(current.user))throw auth.error('GLOBAL_ADMIN_REQUIRED','Only global administrators may run the POD audit.',403);
    const action=text(payload.action||'report').toLowerCase();
    if(action!=='report')throw auth.error('INVALID_ACTION','Unknown POD audit action.',400);
    const result=await audit.report(auth.environmentFromRequest(req),{cursor:payload.cursor,limit:payload.limit,references:payload.references});
    context.res=json(200,result);
  }catch(e){
    try{context.log&&context.log.error&&context.log.error('RC1577 POD quality audit failed',e&&e.code,e&&e.message)}catch(_){}
    context.res=json(e.status||e.statusCode||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'POD audit failed.',version:audit.VERSION});
  }
};
