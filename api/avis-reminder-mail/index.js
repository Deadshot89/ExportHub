'use strict';
const crypto=require('crypto');
const auth=require('../shared/auth-store');
const graphMail=require('../shared/graph-mail');

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function response(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)}}
function payload(req){return auth.body(req)}
function allowed(user){
 if(auth.isAdmin(user))return true;
 const r=user&&user.rights&&user.rights.shipmentoverview;
 return !!(r&&(r.edit===true||r.admin===true||r.functionAdmin===true||r.level==='edit'||r.level==='admin'))
}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(v))}
const PRODUCTION_PUBLIC_HOST=lower(process.env.EXPORTHUB_PRODUCTION_PUBLIC_HOST||'wonderful-forest-0f315e310.7.azurestaticapps.net');
const TESTSERVICE_PUBLIC_HOST=lower(process.env.EXPORTHUB_TESTSERVICE_PUBLIC_HOST||'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net');
function safeAvisUrl(req,value){
 let u;try{u=new URL(text(value))}catch(_){throw auth.error('AVIS_URL_INVALID','Der Avis-Link ist ungültig.',400)}
 if(u.protocol!=='https:'||!/\/customer-avis\.html$/i.test(u.pathname))throw auth.error('AVIS_URL_INVALID','Der Avis-Link ist ungültig.',400);
 const environment=auth.environmentFromRequest(req);
 const expectedHost=environment==='testservice'?TESTSERVICE_PUBLIC_HOST:PRODUCTION_PUBLIC_HOST;
 if(lower(u.hostname)!==expectedHost)throw auth.error('AVIS_URL_INVALID','Der Avis-Link gehört nicht zu dieser ExportHUB-Umgebung.',400);
 return u.toString()
}
function subject(ref,target,lang){
 if(lang==='en')return(target==='carrier'?'Reminder – collection notice ':'Reminder – shipment notice ')+ref;
 return(target==='carrier'?'Erinnerung – Lieferavis Abholung ':'Erinnerung – Lieferavis ')+ref
}
function body(ref,target,lang,url){
 const u=new URL(url);u.searchParams.set('lang',lang==='en'?'en':'de');url=u.toString();
 if(lang==='en'){
  if(target==='carrier')return'Dear Sir or Madam,\n\nthis is a reminder for the digital collection notice for shipment '+ref+'.\n\nPlease use the link below to check or update the planned pickup date, time window and vehicle licence plate:\n'+url+'\n\nNo separate confirmation by email is required.\n\nKind regards';
  return'Dear Sir or Madam,\n\nthis is a reminder for the digital shipment notice for reference '+ref+'.\n\nPlease use the following link to review the released shipment documents and check or update the planned pickup details:\n'+url+'\n\nThank you.\n\nKind regards'
 }
 if(target==='carrier')return'Sehr geehrte Damen und Herren,\n\nhiermit erinnern wir an das digitale Lieferavis zur Abholung der Sendung '+ref+'.\n\nBitte prüfen bzw. aktualisieren Sie über den folgenden Link Abholdatum, Zeitfenster und – sofern bekannt – das Kennzeichen des Abholfahrzeugs:\n'+url+'\n\nEine zusätzliche Bestätigung per E-Mail ist nicht erforderlich.\n\nMit freundlichen Grüßen';
 return'Sehr geehrte Damen und Herren,\n\nhiermit erinnern wir an das digitale Lieferavis zur Sendung '+ref+'.\n\nBitte nutzen Sie den folgenden Link, um die freigegebenen Sendungsunterlagen einzusehen und die geplanten Abholdaten zu prüfen bzw. zu aktualisieren:\n'+url+'\n\nVielen Dank.\n\nMit freundlichen Grüßen'
}
function sameShipment(sh,id,ref){
 const sid=text(sh&&(sh.id||sh.shipmentId||sh.uuid)).toUpperCase(),sref=text(sh&&(sh.reference||sh.ref||sh.shipmentRef)).toUpperCase();
 return !!((id&&sid===id)||(ref&&sref===ref))
}
function historyEvent(current,ref,to,sub,target,lang){
 const now=new Date().toISOString();
 return{id:'H-'+crypto.randomBytes(10).toString('hex'),at:now,type:'mail-sent',label:'Avis-Erinnerung versendet',actor:{id:text(current.user&&current.user.id),name:text(current.user&&(current.user.name||current.user.user))||'Benutzer'},details:{reference:ref,to,subject:sub,mailType:'avis-reminder',target,language:lang}}
}
async function record(req,current,id,ref,event){
 await auth.mutateTeamForRequest(req,team=>{
  team.state=team.state&&typeof team.state==='object'?team.state:{};
  const names=['shipments','savedShipments','salesSharedShipments','sharedShipments','shipmentArchive','archivedShipments','archive'];
  let found=false;
  for(const name of names){
   const list=Array.isArray(team.state[name])?team.state[name]:[];
   for(const sh of list){
    if(!sameShipment(sh,id,ref))continue;
    sh.shipmentHistory=Array.isArray(sh.shipmentHistory)?sh.shipmentHistory:[];
    if(!sh.shipmentHistory.some(x=>x&&x.id===event.id))sh.shipmentHistory.push(event);
    sh.mailHistory=Array.isArray(sh.mailHistory)?sh.mailHistory:[];
    sh.mailHistory.push({id:event.id,at:event.at,type:'avis-reminder',to:event.details.to,subject:event.details.subject,actor:event.actor});
    found=true
   }
  }
  auth.addAudit(team,'AVIS_REMINDER_SENT',event.actor.name,{reference:ref,to:event.details.to,target:event.details.target,language:event.details.language});
  return{found}
 })
}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
 if(req.method!=='POST'){context.res=response(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Nur POST ist erlaubt.'});return}
 try{
  const current=await auth.validateSession(req);
  if(!allowed(current.user))throw auth.error('MAIL_SEND_FORBIDDEN','Für den Versand von Avis-Erinnerungen ist Bearbeitungsrecht in der Sendungsübersicht erforderlich.',403);
  const p=payload(req),id=text(p.shipmentId).toUpperCase(),ref=text(p.reference).toUpperCase(),to=text(p.recipient),target=lower(p.target)==='carrier'?'carrier':'customer',lang=lower(p.language)==='en'?'en':'de';
  if(!ref||ref.length>40)throw auth.error('REFERENCE_INVALID','Die Sendungsreferenz ist ungültig.',400);
  if(!validEmail(to))throw auth.error('MAIL_RECIPIENT_INVALID','Die Empfängeradresse ist ungültig.',400);
  const url=safeAvisUrl(req,p.avisUrl),sub=subject(ref,target,lang),content=body(ref,target,lang,url);
  const sent=await graphMail.sendTextMail({to,subject:sub,body:content});
  const event=historyEvent(current,ref,to,sub,target,lang);
  await record(req,current,id,ref,event);
  context.res=response(200,{ok:true,version:'RC1207',reference:ref,recipient:to,subject:sub,sentAt:event.at,historyId:event.id,attempts:sent.attempts})
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('RC1207 Avis reminder mail failed',e&&e.code,e&&e.message)}catch(_){}
  context.res=response(e.status||e.statusCode||500,{ok:false,code:e.code||'MAIL_SEND_FAILED',message:e.message||'Die Avis-Erinnerung konnte nicht versendet werden.',version:'RC1207',missing:Array.isArray(e.missing)?e.missing:undefined})
 }
};
