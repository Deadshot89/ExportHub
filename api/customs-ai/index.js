'use strict';

const auth=require('../shared/fast-auth-store');
const service=require('../shared/customs-ai-service');
const apiI18n=require('../shared/i18n');

const RATE_WINDOW_MS=60_000;
const RATE_MAX=20;
const rateBuckets=new Map();

function text(value,max=400){return String(value==null?'':value).trim().slice(0,max)}
function lower(value){return text(value).toLowerCase()}
function response(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)}}
function error(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e}
function allowed(user){
 if(auth.isAdmin&&auth.isAdmin(user))return true;
 const rights=user&&user.rights&&user.rights.abd||{},level=lower(rights.level||rights.access);
 return !!(rights.read===true||rights.view===true||rights.edit===true||rights.admin===true||rights.functionAdmin===true||['read','view','edit','admin'].includes(level))
}
function userKey(user){return text(user&&(user.id||user.userId||user.username||user.email||user.name),180)||'authenticated-session'}
function consumeRate(key,now=Date.now()){
 const current=rateBuckets.get(key),bucket=current&&now-current.startedAt<RATE_WINDOW_MS?current:{startedAt:now,count:0};
 bucket.count+=1;rateBuckets.set(key,bucket);
 if(rateBuckets.size>1000){for(const [id,item] of rateBuckets){if(now-item.startedAt>=RATE_WINDOW_MS)rateBuckets.delete(id)}}
 return{allowed:bucket.count<=RATE_MAX,retryAfterMs:Math.max(0,RATE_WINDOW_MS-(now-bucket.startedAt))}
}

module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
 if(req.method!=='POST'){context.res=response(405,{ok:false,code:'METHOD_NOT_ALLOWED',answer:apiI18n.t(req,'api.customsAi.methodNotAllowed')});return}
 try{
  const current=await auth.validateSession(req);
  if(!current||!allowed(current.user))throw error('CUSTOMS_AI_FORBIDDEN',apiI18n.t(req,'api.customsAi.forbidden'),403);
  const rate=consumeRate(userKey(current.user));
  if(!rate.allowed){
   context.res=response(429,{ok:false,code:'RATE_LIMITED',answer:apiI18n.t(req,'api.customsAi.rateLimited'),recoverable:true,retryAfterSeconds:Math.max(1,Math.ceil(rate.retryAfterMs/1000))});return
  }
  const payload=auth.body(req),question=String(payload&&payload.question==null?'':payload.question),language=apiI18n.language(req,payload);
  if(question.length>2000){context.res=response(400,{ok:false,code:'QUESTION_TOO_LONG',answer:apiI18n.t(req,'api.customsAi.questionTooLong',null,payload),recoverable:true});return}
  const result=await service.answerCustomsQuestion({
   question,
   language:apiI18n.language(req,payload),
   reference:payload&&payload.reference,
   destinationCountry:payload&&payload.destinationCountry,
   abdRequest:payload&&payload.abdRequest,
   invoiceAnalysis:payload&&payload.invoiceAnalysis
  });
  const status=result&&result.code==='QUESTION_REQUIRED'?400:200;
  context.res=response(status,result)
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('RC1532 customs AI',e&&e.code,e&&e.message)}catch(_){}
  context.res=response(Number(e&&e.status||e&&e.statusCode||500),{ok:false,code:e&&e.code||'CUSTOMS_AI_FAILED',answer:e&&e.status&&e.status<500?text(e.message,300):apiI18n.t(req,'api.customsAi.unavailable'),recoverable:true})
 }
};
