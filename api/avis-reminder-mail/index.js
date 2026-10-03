'use strict';
const crypto=require('crypto');
const auth=require('../shared/auth-store');
const graphMail=require('../shared/graph-mail');

const FIXED_CC='TobiasLimberg@essentra.com';

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function normalizeLanguage(v){const m=lower(v).replace('_','-').match(/^(de|en|pl|es|fr|it)(?:-|$)/);return m?m[1]:'de'}
function response(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)}}
function payload(req){return auth.body(req)}
function allowed(user){
 if(auth.isAdmin(user))return true;
 const r=user&&user.rights&&user.rights.shipmentoverview;
 return !!(r&&(r.edit===true||r.admin===true||r.functionAdmin===true||r.level==='edit'||r.level==='admin'))
}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(v))}
function configuredMailSender(){return text(process.env.EXPORTHUB_MAIL_SENDER||process.env.EXPORTHUB_POD_DRIVE_USER)}
function avisRecipientExcluded(v){return lower(v)==='dispo@holenstein.de'}
const PRODUCTION_PUBLIC_HOST='www.exporthub360.de';
const LEGACY_BRANDED_PRODUCTION_PUBLIC_HOST='exporthub360.de';
const LEGACY_COM_PRODUCTION_PUBLIC_HOST='exporthub360.com';
const LEGACY_COM_WWW_PRODUCTION_PUBLIC_HOST='www.exporthub360.com';
function isBrandedProductionHost(host){return host===PRODUCTION_PUBLIC_HOST||host===LEGACY_BRANDED_PRODUCTION_PUBLIC_HOST||host===LEGACY_COM_PRODUCTION_PUBLIC_HOST||host===LEGACY_COM_WWW_PRODUCTION_PUBLIC_HOST}
const LEGACY_PRODUCTION_PUBLIC_HOST=lower(process.env.EXPORTHUB_LEGACY_PRODUCTION_PUBLIC_HOST||'wonderful-forest-0f315e310.7.azurestaticapps.net');
const TESTSERVICE_PUBLIC_HOST=lower(process.env.EXPORTHUB_TESTSERVICE_PUBLIC_HOST||'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net');
function safeAvisUrl(req,value){
 let u;try{u=new URL(text(value))}catch(_){throw auth.error('AVIS_URL_INVALID','Der Avis-Link ist ungültig.',400)}
 if(u.protocol!=='https:')throw auth.error('AVIS_URL_INVALID','Der Avis-Link ist ungültig.',400);
 const environment=auth.environmentFromRequest(req),host=lower(u.hostname),legacyPath=/\/customer-avis\.html$/i.test(u.pathname),brandedPath=/^\/avis\/[^/]+\/?$/i.test(u.pathname);
 const valid=environment==='testservice'?((host===TESTSERVICE_PUBLIC_HOST&&legacyPath)||(isBrandedProductionHost(host)&&brandedPath&&lower(u.searchParams.get('environment'))==='testservice')):((isBrandedProductionHost(host)&&(brandedPath||legacyPath))||(host===LEGACY_PRODUCTION_PUBLIC_HOST&&legacyPath));
 if(!valid)throw auth.error('AVIS_URL_INVALID','Der Avis-Link gehört nicht zu dieser ExportHUB-Umgebung.',400);
 return u.toString()
}
function subject(ref,target,lang){
 lang=normalizeLanguage(lang);
 const prefix={
  de:{carrier:'Erinnerung – Lieferavis Abholung ',customer:'Erinnerung – Lieferavis '},
  en:{carrier:'Reminder – collection notice ',customer:'Reminder – shipment notice '},
  pl:{carrier:'Przypomnienie – awizo odbioru ',customer:'Przypomnienie – awizo wysyłki '},
  es:{carrier:'Recordatorio – aviso de recogida ',customer:'Recordatorio – aviso de envío '},
  fr:{carrier:'Rappel – avis d’enlèvement ',customer:'Rappel – avis d’expédition '},
  it:{carrier:'Promemoria – avviso di ritiro ',customer:'Promemoria – avviso di spedizione '}
 }[lang];
 return prefix[target==='carrier'?'carrier':'customer']+ref
}
function body(ref,target,lang,url){
 lang=normalizeLanguage(lang);target=target==='carrier'?'carrier':'customer';
 const u=new URL(url);u.searchParams.set('lang',lang);url=u.toString();
 const templates={
  de:{
   carrier:'Sehr geehrte Damen und Herren,\n\nhiermit erinnern wir an das digitale Lieferavis zur Abholung der Sendung {{ref}}.\n\nBitte prüfen bzw. aktualisieren Sie über den folgenden Link Abholdatum, Zeitfenster und – sofern bekannt – das Kennzeichen des Abholfahrzeugs:\n{{url}}\n\nEine zusätzliche Bestätigung per E-Mail ist nicht erforderlich.\n\nMit freundlichen Grüßen',
   customer:'Sehr geehrte Damen und Herren,\n\nhiermit erinnern wir an das digitale Lieferavis zur Sendung {{ref}}.\n\nBitte nutzen Sie den folgenden Link, um die freigegebenen Sendungsunterlagen einzusehen und die geplanten Abholdaten zu prüfen bzw. zu aktualisieren:\n{{url}}\n\nVielen Dank.\n\nMit freundlichen Grüßen'
  },
  en:{
   carrier:'Dear Sir or Madam,\n\nthis is a reminder for the digital collection notice for shipment {{ref}}.\n\nPlease use the link below to check or update the planned pickup date, time window and vehicle licence plate:\n{{url}}\n\nNo separate confirmation by email is required.\n\nKind regards',
   customer:'Dear Sir or Madam,\n\nthis is a reminder for the digital shipment notice for reference {{ref}}.\n\nPlease use the following link to review the released shipment documents and check or update the planned pickup details:\n{{url}}\n\nThank you.\n\nKind regards'
  },
  pl:{
   carrier:'Szanowni Państwo,\n\nprzypominamy o cyfrowym awizo odbioru przesyłki {{ref}}.\n\nProsimy użyć poniższego linku, aby sprawdzić lub zaktualizować datę odbioru, przedział czasowy oraz – jeśli jest znany – numer rejestracyjny pojazdu:\n{{url}}\n\nDodatkowe potwierdzenie e-mailem nie jest wymagane.\n\nZ poważaniem',
   customer:'Szanowni Państwo,\n\nprzypominamy o cyfrowym awizo przesyłki o numerze referencyjnym {{ref}}.\n\nProsimy użyć poniższego linku, aby przejrzeć udostępnione dokumenty wysyłkowe oraz sprawdzić lub zaktualizować planowane dane odbioru:\n{{url}}\n\nDziękujemy.\n\nZ poważaniem'
  },
  es:{
   carrier:'Estimados señores:\n\nLes recordamos el aviso digital de recogida del envío {{ref}}.\n\nUtilicen el siguiente enlace para comprobar o actualizar la fecha de recogida, la franja horaria y, si se conoce, la matrícula del vehículo:\n{{url}}\n\nNo es necesaria una confirmación adicional por correo electrónico.\n\nAtentamente',
   customer:'Estimados señores:\n\nLes recordamos el aviso digital del envío con referencia {{ref}}.\n\nUtilicen el siguiente enlace para consultar los documentos de envío disponibles y comprobar o actualizar los datos previstos de recogida:\n{{url}}\n\nMuchas gracias.\n\nAtentamente'
  },
  fr:{
   carrier:'Madame, Monsieur,\n\nNous vous rappelons l’avis numérique d’enlèvement de l’expédition {{ref}}.\n\nVeuillez utiliser le lien ci-dessous pour vérifier ou mettre à jour la date d’enlèvement, le créneau horaire et, si elle est connue, l’immatriculation du véhicule :\n{{url}}\n\nAucune confirmation supplémentaire par e-mail n’est nécessaire.\n\nCordialement',
   customer:'Madame, Monsieur,\n\nNous vous rappelons l’avis numérique de l’expédition portant la référence {{ref}}.\n\nVeuillez utiliser le lien ci-dessous pour consulter les documents d’expédition disponibles et vérifier ou mettre à jour les informations d’enlèvement prévues :\n{{url}}\n\nMerci.\n\nCordialement'
  },
  it:{
   carrier:'Gentili Signore e Signori,\n\nvi ricordiamo l’avviso digitale di ritiro della spedizione {{ref}}.\n\nUtilizzate il seguente link per verificare o aggiornare la data di ritiro, la fascia oraria e, se nota, la targa del veicolo:\n{{url}}\n\nNon è necessaria un’ulteriore conferma via e-mail.\n\nCordiali saluti',
   customer:'Gentili Signore e Signori,\n\nvi ricordiamo l’avviso digitale della spedizione con riferimento {{ref}}.\n\nUtilizzate il seguente link per consultare i documenti di spedizione disponibili e verificare o aggiornare i dati di ritiro pianificati:\n{{url}}\n\nGrazie.\n\nCordiali saluti'
  }
 };
 return templates[lang][target].replace(/\{\{ref\}\}/g,ref).replace(/\{\{url\}\}/g,url)
}

function initialSubject(ref,target,lang){
 lang=normalizeLanguage(lang);
 const prefix={
  de:{carrier:'Lieferavis Abholung ',customer:'Lieferavis '},
  en:{carrier:'Collection notice ',customer:'Shipment notice '},
  pl:{carrier:'Awizo odbioru ',customer:'Awizo wysyłki '},
  es:{carrier:'Aviso de recogida ',customer:'Aviso de envío '},
  fr:{carrier:'Avis d’enlèvement ',customer:'Avis d’expédition '},
  it:{carrier:'Avviso di ritiro ',customer:'Avviso di spedizione '}
 }[lang];
 return prefix[target==='carrier'?'carrier':'customer']+ref
}
function initialBody(ref,target,lang,url){
 lang=normalizeLanguage(lang);target=target==='carrier'?'carrier':'customer';
 const u=new URL(url);u.searchParams.set('lang',lang);url=u.toString();
 const templates={
  de:{
   carrier:'Sehr geehrte Damen und Herren,\n\nfür die geplante Abholung der Sendung {{ref}} steht ein digitales Lieferavis bereit.\n\nBitte erfassen Sie über den folgenden Link Abholdatum, Zeitfenster und – sofern bekannt – das Kennzeichen des Abholfahrzeugs. Die freigegebenen Sendungsunterlagen können dort ebenfalls eingesehen werden:\n{{url}}\n\nEine zusätzliche Bestätigung per E-Mail ist nicht erforderlich.\n\nMit freundlichen Grüßen',
   customer:'Sehr geehrte Damen und Herren,\n\nfür die Sendung {{ref}} steht Ihnen unser digitales Lieferavis zur Verfügung.\n\nBitte nutzen Sie den folgenden Link, um die freigegebenen Sendungsunterlagen einzusehen und Abholdatum, Zeitfenster sowie – sofern bekannt – das Kennzeichen des Abholfahrzeugs zu erfassen:\n{{url}}\n\nEine zusätzliche Bestätigung per E-Mail ist nicht erforderlich.\n\nMit freundlichen Grüßen'
  },
  en:{
   carrier:'Dear Sir or Madam,\n\na digital collection notice is available for the planned pickup of shipment {{ref}}.\n\nPlease use the link below to enter the pickup date, time window and, if known, the vehicle licence plate. The released shipment documents are also available there:\n{{url}}\n\nNo separate confirmation by email is required.\n\nKind regards',
   customer:'Dear Sir or Madam,\n\na digital shipment notice is available for shipment {{ref}}.\n\nPlease use the link below to review the released shipment documents and enter the pickup date, time window and, if known, the vehicle licence plate:\n{{url}}\n\nNo separate confirmation by email is required.\n\nKind regards'
  },
  pl:{
   carrier:'Szanowni Państwo,\n\ndla planowanego odbioru przesyłki {{ref}} dostępne jest cyfrowe awizo.\n\nProsimy użyć poniższego linku, aby podać datę odbioru, przedział czasowy oraz – jeśli jest znany – numer rejestracyjny pojazdu. Dostępne są tam również udostępnione dokumenty wysyłkowe:\n{{url}}\n\nDodatkowe potwierdzenie e-mailem nie jest wymagane.\n\nZ poważaniem',
   customer:'Szanowni Państwo,\n\ndla przesyłki {{ref}} dostępne jest cyfrowe awizo.\n\nProsimy użyć poniższego linku, aby przejrzeć udostępnione dokumenty wysyłkowe oraz podać datę odbioru, przedział czasowy i – jeśli jest znany – numer rejestracyjjny pojazdu:\n{{url}}\n\nDodatkowe potwierdzenie e-mailem nie jest wymagane.\n\nZ poważaniem'
  },
  es:{
   carrier:'Estimados señores:\n\nHay disponible un aviso digital para la recogida prevista del envío {{ref}}.\n\nUtilicen el siguiente enlace para indicar la fecha de recogida, la franja horaria y, si se conoce, la matrícula del vehículo. Allí también están disponibles los documentos de envío autorizados:\n{{url}}\n\nNo es necesaria una confirmación adicional por correo electrónico.\n\nAtentamente',
   customer:'Estimados señores:\n\nHay disponible un aviso digital para el envío {{ref}}.\n\nUtilicen el siguiente enlace para consultar los documentos de envío autorizados e indicar la fecha de recogida, la franja horaria y, si se conoce, la matrícula del vehículo:\n{{url}}\n\nNo es necesaria una confirmación adicional por correo electrónico.\n\nAtentamente'
  },
  fr:{
   carrier:'Madame, Monsieur,\n\nun avis numérique est disponible pour l’enlèvement prévu de l’expédition {{ref}}.\n\nVeuillez utiliser le lien ci-dessous pour indiquer la date d’enlèvement, le créneau horaire et, si elle est connue, l’immatriculation du véhicule. Les documents d’expédition validés y sont également disponibles :\n{{url}}\n\nAucune confirmation supplémentaire par e-mail n’est nécessaire.\n\nCordialement',
   customer:'Madame, Monsieur,\n\nun avis numérique est disponible pour l’expédition {{ref}}.\n\nUtilisez le lien ci-dessous pour consulter les documents d’expédition validés et indiquer la date d’enlèvement, le créneau horaire ainsi que, si elle est connue, l’immatriculation du véhicule :\n{{url}}\n\nAucune confirmation supplémentaire par e-mail n’est nécessaire.\n\nCordialement'
  },
  it:{
   carrier:'Gentili Signore e Signori,\n\nè disponibile un avviso digitale per il ritiro pianificato della spedizione {{ref}}.\n\nUtilizzate il seguente link per indicare la data di ritiro, la fascia oraria e, se nota, la targa del veicolo. Sono disponibili anche i documenti di spedizione approvati:\n{{url}}\n\nNon è necessaria un’ulteriore conferma via e-mail.\n\nCordiali saluti',
   customer:'Gentili Signore e Signori,\n\nè disponibile un avviso digitale per la spedizione {{ref}}.\n\nUtilizzate il seguente link per consultare i documenti di spedizione approvati e indicare la data di ritiro, la fascia oraria e, se nota, la targa del veicolo:\n{{url}}\n\nNon è necessaria un’ulteriore conferma via e-mail.\n\nCordiali saluti'
  }
 };
 return templates[lang][target].replace(/\{\{ref\}\}/g,ref).replace(/\{\{url\}\}/g,url)
}
function emailItems(value){
 const out=[],seen=new Set();
 function take(v){
  if(Array.isArray(v)){v.forEach(take);return}
  if(v&&typeof v==='object'){take(v.email||v.mail||v.address);return}
  String(v==null?'':v).replace(/mailto:/gi,' ').split(/[;,\n\r\t ]+/).forEach(part=>{
   const m=String(part||'').match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i);if(!m)return;
   const email=text(m[0]).replace(/[.,;:]+$/,''),key=lower(email);if(email&&!seen.has(key)){seen.add(key);out.push(email)}
  })
 }
 take(value);return out
}
function customerKey(v){return text(v).toUpperCase()}
function customerFor(team,sh){
 const state=team&&team.state||{},customers=Array.isArray(state.customers)?state.customers:[],keys=[
  sh&&sh.customerId,sh&&sh.customerNumber,sh&&sh.customerAccount,sh&&sh.account,sh&&sh.customerName,
  sh&&sh.customer&&typeof sh.customer==='object'&&(sh.customer.id||sh.customer.account||sh.customer.name),
  sh&&typeof sh.customer==='string'&&sh.customer
 ].map(customerKey).filter(Boolean);
 return customers.find(c=>{
  const values=[c&&c.id,c&&c.customerId,c&&c.account,c&&c.customerNumber,c&&c.kundennummer,c&&c.name,c&&c.customerName].map(customerKey).filter(Boolean);
  return values.some(v=>keys.includes(v))
 })||null
}
function prefBool(v){if(v===true||v===false)return v;const x=lower(v);if(/^(?:1|true|yes|ja|on|enabled|aktiv)$/.test(x))return true;if(/^(?:0|false|no|nein|off|disabled|inaktiv)$/.test(x))return false;return null}
function customerAvisAllowed(team,sh){
 const c=customerFor(team,sh)||{},keys=['customerAvisLinkEnabled','avisLinkEnabled'];
 for(const key of keys)if(Object.prototype.hasOwnProperty.call(c,key)){const parsed=prefBool(c[key]);if(parsed!==null)return parsed}
 const ids=[c.id,c.customerId,c.account,c.customerNumber,c.kundennummer,sh&&sh.customerId,sh&&sh.customerNumber,sh&&sh.customerAccount,sh&&sh.account].map(customerKey).filter(Boolean);
 if(ids.includes('3019100629'))return false;
 const name=lower(c.name||c.customerName||sh&&sh.customerName||sh&&sh.customer);
 if(name.includes('adolf würth')||name.includes('adolf wuerth')||name.startsWith('würth industrie')||name.startsWith('wuerth industrie')||name.includes('v-zug')||name.includes('v zug'))return false;
 const addresses=emailItems([c.email,c.mail,c.customerEmail,c.customerMail,c.cc,c.mailCc,c.ccContacts,c.customerCcContacts,c.customerContactDirectory,c.contactDirectory]);
 if(addresses.some(e=>lower(e)==='v-zug@lebert.com'))return false;
 return true
}
function shipmentFromTeam(team,id,ref){
 const state=team&&team.state||{},names=['shipments','savedShipments','salesSharedShipments','sharedShipments','shipmentArchive','archivedShipments','archive'];
 for(const name of names){for(const sh of Array.isArray(state[name])?state[name]:[]){if(sameShipment(sh,id,ref))return sh}}
 return null
}
function ccRecipients(team,sh,to,sender){
 const c=customerFor(team,sh),values=[FIXED_CC];
 if(c){
  values.push(c.salesContacts,c.customerSalesContacts,c.salesMail,c.salesEmail,c.salesPersonMail,c.salesPersonEmail,c.salesContactMail,c.salesContactEmail,c.rc385SalesMail,c.salesCc);
  values.push(c.ccContacts,c.customerCcContacts,c.cc,c.mailCc,c.rc385Cc)
 }
 values.push(sh&&sh.salesContacts,sh&&sh.customerSalesContacts,sh&&sh.salesMail,sh&&sh.salesEmail,sh&&sh.salesCc,sh&&sh.ccContacts,sh&&sh.customerCcContacts,sh&&sh.cc,sh&&sh.mailCc);
 const out=[],seen=new Set([lower(to),lower(sender)]);
 emailItems(values).forEach(email=>{const key=lower(email);if(key&&!seen.has(key)){seen.add(key);out.push(email)}});
 return out
}
function pickupDate(sh){return text(sh&&(sh.customerAvisPickupDate||sh.avisPickupDate||sh.plannedPickupDate||sh.pickupDate))}
function initialMailSentAt(sh){
 const explicit=text(sh&&(sh.avisFirstMailSentAt||sh.avisInitialMailSentAt));if(explicit)return explicit;
 const history=[].concat(Array.isArray(sh&&sh.mailHistory)?sh.mailHistory:[],Array.isArray(sh&&sh.shipmentHistory)?sh.shipmentHistory:[]);
 const hit=history.filter(x=>x&&(lower(x.type)==='avis-initial'||lower(x.mailType)==='avis-initial'||lower(x.details&&x.details.mailType)==='avis-initial')).sort((a,b)=>Date.parse(a.at||'')-Date.parse(b.at||''))[0];
 return text(hit&&hit.at)
}
function addBusinessDays(value,count){
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;
 let left=Math.max(0,Number(count)||0);
 while(left>0){date.setDate(date.getDate()+1);const day=date.getDay();if(day!==0&&day!==6)left--}
 return date
}
function reminderGate(sh,nowValue){
 const pickup=pickupDate(sh);if(pickup)return{allowed:false,reason:'PICKUP_DATE_EXISTS',pickupDate:pickup};
 const sentAt=initialMailSentAt(sh);if(!sentAt)return{allowed:false,reason:'INITIAL_AVIS_MAIL_REQUIRED'};
 const due=addBusinessDays(sentAt,3),nowDate=nowValue?new Date(nowValue):new Date();
 if(!due||!Number.isFinite(nowDate.getTime()))return{allowed:false,reason:'INITIAL_AVIS_MAIL_INVALID'};
 return{allowed:nowDate.getTime()>=due.getTime(),reason:nowDate.getTime()>=due.getTime()?'READY':'WAITING_3_BUSINESS_DAYS',sentAt,dueAt:due.toISOString()}
}

function sameShipment(sh,id,ref){
 const sid=text(sh&&(sh.id||sh.shipmentId||sh.uuid)).toUpperCase(),sref=text(sh&&(sh.reference||sh.ref||sh.shipmentRef)).toUpperCase();
 return !!((id&&sid===id)||(ref&&sref===ref))
}
function historyEvent(current,ref,to,sub,target,lang,mode,cc,sender){
 const now=new Date().toISOString(),initial=mode==='initial';
 return{id:'H-'+crypto.randomBytes(10).toString('hex'),at:now,type:'mail-sent',label:initial?'Lieferavis versendet':'Avis-Erinnerung versendet',actor:{id:text(current.user&&current.user.id),name:text(current.user&&(current.user.name||current.user.user))||'Benutzer'},details:{reference:ref,to,cc:Array.isArray(cc)?cc:[],subject:sub,mailType:initial?'avis-initial':'avis-reminder',target,language:lang,sender}}
}
async function record(req,current,id,ref,event,mode,sender){
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
    sh.mailHistory.push({id:event.id,at:event.at,type:mode==='initial'?'avis-initial':'avis-reminder',to:event.details.to,cc:event.details.cc,subject:event.details.subject,actor:event.actor});
    if(mode==='initial'&&!initialMailSentAt(sh)){sh.avisFirstMailSentAt=event.at;sh.avisInitialMailSentAt=event.at}
    found=true
   }
  }
  auth.addAudit(team,mode==='initial'?'AVIS_INITIAL_MAIL_SENT':'AVIS_REMINDER_SENT',event.actor.name,{reference:ref,to:event.details.to,cc:event.details.cc,target:event.details.target,language:event.details.language,sender});
  return{found}
 })
}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
 if(req.method!=='POST'){context.res=response(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Nur POST ist erlaubt.'});return}
 try{
  const current=await auth.validateSession(req);
  if(!allowed(current.user))throw auth.error('MAIL_SEND_FORBIDDEN','Für den Versand von Avis-Erinnerungen ist Bearbeitungsrecht in der Sendungsübersicht erforderlich.',403);
  const p=payload(req),id=text(p.shipmentId).toUpperCase(),ref=text(p.reference).toUpperCase(),to=text(p.recipient),target=lower(p.target)==='carrier'?'carrier':'customer',lang=normalizeLanguage(p.language),mode=lower(p.mode)==='initial'?'initial':'reminder';
  if(!ref||ref.length>40)throw auth.error('REFERENCE_INVALID','Die Sendungsreferenz ist ungültig.',400);
  if(!validEmail(to))throw auth.error('MAIL_RECIPIENT_INVALID','Die Empfängeradresse ist ungültig.',400);
  if(avisRecipientExcluded(to))throw auth.error('AVIS_RECIPIENT_EXCLUDED','Für dispo@holenstein.de darf kein Lieferavis-Link versendet werden.',409);
  const shipment=shipmentFromTeam(current.team,id,ref);if(!shipment)throw auth.error('SHIPMENT_NOT_FOUND','Die Sendung wurde nicht gefunden.',404);
  if(!customerAvisAllowed(current.team,shipment))throw auth.error('AVIS_CUSTOMER_DISABLED','AVIS-Link ist für diesen Kunden im Kundenordner deaktiviert.',409);
  if(mode==='initial'&&initialMailSentAt(shipment))throw auth.error('AVIS_INITIAL_ALREADY_SENT','Das erste Lieferavis wurde bereits versendet.',409);
  if(mode==='reminder'){
   const gate=reminderGate(shipment);if(!gate.allowed){const e=auth.error(gate.reason,gate.reason==='PICKUP_DATE_EXISTS'?'Für diese Sendung ist bereits ein Abholtag erfasst.':'Die Avis-Erinnerung ist erst drei Arbeitstage nach dem ersten Mailversand möglich.',409);e.dueAt=gate.dueAt||'';throw e}
  }
  const url=safeAvisUrl(req,p.avisUrl),sub=mode==='initial'?initialSubject(ref,target,lang):subject(ref,target,lang),content=mode==='initial'?initialBody(ref,target,lang,url):body(ref,target,lang,url);
  const sender=configuredMailSender(),cc=ccRecipients(current.team,shipment,to,sender);
  const sent=await graphMail.sendTextMail({to,subject:sub,body:content,cc});
  const event=historyEvent(current,ref,to,sub,target,lang,mode,cc,sender);
  await record(req,current,id,ref,event,mode,sender);
  const nextGate=mode==='initial'?reminderGate(Object.assign({},shipment,{avisFirstMailSentAt:event.at})):reminderGate(shipment);
  context.res=response(200,{ok:true,version:'RC1358',mode,reference:ref,recipient:to,sender,cc,subject:sub,sentAt:event.at,historyId:event.id,reminderDueAt:nextGate.dueAt||'',attempts:sent.attempts})
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('RC1292 Avis reminder mail failed',e&&e.code,e&&e.message)}catch(_){}
  context.res=response(e.status||e.statusCode||500,{ok:false,code:e.code||'MAIL_SEND_FAILED',message:e.message||'Die Avis-Erinnerung konnte nicht versendet werden.',version:'RC1358',dueAt:text(e&&e.dueAt),missing:Array.isArray(e.missing)?e.missing:undefined,upstreamStatus:Number(e&&e.upstreamStatus||0)||0,upstreamCode:text(e&&e.upstreamCode),upstreamMessage:text(e&&e.upstreamMessage),sender:text(e&&e.sender||configuredMailSender())})
 }
};