'use strict';
const auth=require('../shared/fast-auth-store');
const apiI18n=require('../shared/i18n');
const exporter=require('../shared/abd-analysis-export');

const MAX_OUTPUT_BYTES=8*1024*1024;
function text(value){return String(value==null?'':value).trim()}
function lower(value){return text(value).toLowerCase()}
function response(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)}}
function error(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e}
function allowed(user){
 if(auth.isAdmin&&auth.isAdmin(user))return true;
 const rights=user&&user.rights&&user.rights.abd||{},level=lower(rights.level||rights.access);
 return !!(rights.edit===true||rights.admin===true||rights.functionAdmin===true||level==='edit'||level==='admin')
}
function invoiceLabel(snapshot){return text(snapshot&&snapshot.header&&snapshot.header.invoiceNumber).replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,80)}
function fileBase(snapshot,format){
 const invoice=invoiceLabel(snapshot),prefix=format==='proforma'?'Proforma':'ABD-Auswertung';
 return prefix+(invoice?'-'+invoice:'')
}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
 if(req.method!=='POST'){context.res=response(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:apiI18n.t(req,'api.common.postOnly')});return}
 try{
  const current=await auth.validateSession(req);if(!allowed(current.user))throw error('ABD_EXPORT_FORBIDDEN',apiI18n.t(req,'api.abdAnalysis.forbidden'),403);
  const payload=auth.body(req),format=lower(payload.format),snapshot=payload.snapshot&&typeof payload.snapshot==='object'?payload.snapshot:null;
  if(!snapshot)throw error('ABD_EXPORT_SNAPSHOT_REQUIRED',apiI18n.t(req,'api.abdAnalysis.failed'),400);
  if(!['pdf','xlsx','proforma'].includes(format))throw error('ABD_EXPORT_FORMAT_INVALID',apiI18n.t(req,'api.abdAnalysis.actionInvalid'),400);
  const bytes=format==='pdf'?await exporter.createPdf(snapshot):format==='proforma'?await exporter.createProformaPdf(snapshot):await exporter.createXlsx(snapshot);
  if(bytes.length>MAX_OUTPUT_BYTES)throw error('ABD_EXPORT_TOO_LARGE',apiI18n.t(req,'api.abdAnalysis.failed'),413);
  const extension=format==='xlsx'?'xlsx':'pdf',base=fileBase(snapshot,format),mimeType=format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/pdf';
  context.res=response(200,{ok:true,file:{name:base+'.'+extension,mimeType,size:bytes.length,base64:Buffer.from(bytes).toString('base64')}})
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('RC1549 ABD export',e&&e.code,e&&e.message)}catch(_){}
  context.res=response(Number(e&&e.status||e&&e.statusCode||500),{ok:false,code:e&&e.code||'ABD_EXPORT_FAILED',message:e&&e.message||apiI18n.t(req,'api.abdAnalysis.failed')})
 }
};
