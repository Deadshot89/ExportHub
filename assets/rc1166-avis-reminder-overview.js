// ExportHUB RC1166 – Avis-Erinnerung aus der Sendungsübersicht.
(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1166_AVIS_REMINDER__)return;
w.__EXPORTHUB_RC1166_AVIS_REMINDER__=true;

var timer=0,dialog=null;
function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLocaleLowerCase('de-DE')}
function normalizeLanguage(v){var m=low(v).replace('_','-').match(/^(de|en|pl|es|fr|it)(?:-|$)/);return m?m[1]:'de'}
function arr(v){return Array.isArray(v)?v:[]}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function refOf(sh){sh=sh||{};return q(sh.reference||sh.ref||sh.shipmentRef||sh.id||sh.shipmentId).toUpperCase()}
function idOf(sh){sh=sh||{};return q(sh.id||sh.shipmentId||sh.uuid||sh.reference||sh.ref).toUpperCase()}
function stamp(sh){var n=Date.parse(q(sh&&(sh._syncUpdatedAt||sh.updatedAt||sh.modifiedAt||sh.createdAt)));return Number.isFinite(n)?n:0}
function allShipments(){
 var s=state(),out=[];
 ['shipments','savedShipments','salesSharedShipments','sharedShipments','shipmentArchive','archivedShipments','archive'].forEach(function(k){arr(s[k]).forEach(function(sh){if(sh&&typeof sh==='object')out.push(sh)})});
 ['shipment','currentShipment','selectedShipment'].forEach(function(k){var sh=s[k];if(sh&&typeof sh==='object')out.push(sh)});
 var map=new Map();out.forEach(function(sh){var key=refOf(sh)||idOf(sh),old=map.get(key);if(key&&(!old||stamp(sh)>=stamp(old)))map.set(key,sh)});return Array.from(map.values())
}
function cardShipment(card,shipments){
 if(!card)return null;var ds=card.dataset||{},ids=[ds.shipmentId,ds.shipment,ds.id,ds.shipmentRef,ds.ref,ds.reference].map(function(v){return q(v).toUpperCase()}).filter(Boolean);
 var hit=arr(shipments).find(function(sh){return ids.indexOf(idOf(sh))>=0||ids.indexOf(refOf(sh))>=0});if(hit)return hit;
 var raw=q(card.textContent).toUpperCase(),hits=arr(shipments).filter(function(sh){var ref=refOf(sh);return ref&&raw.indexOf(ref)>=0});return hits.sort(function(a,b){return stamp(b)-stamp(a)})[0]||null
}
function customerKey(c){return q(c&&(c.id||c.customerId||c.account||c.customerNumber||c.kundennummer||c.name||c.customerName)).toUpperCase()}
function customerFor(sh){
 var s=state(),list=arr(s.customers),keys=[sh&&sh.customerId,sh&&sh.customerNumber,sh&&sh.customerAccount,sh&&sh.account,sh&&sh.customerName,sh&&sh.customer].map(function(x){return q(x&&typeof x==='object'?(x.id||x.customerId||x.account||x.customerNumber||x.name):x).toUpperCase()}).filter(Boolean);
 return list.find(function(c){var ck=customerKey(c),name=q(c&&(c.name||c.customerName)).toUpperCase(),account=q(c&&(c.account||c.customerNumber||c.kundennummer)).toUpperCase();return keys.indexOf(ck)>=0||keys.indexOf(name)>=0||keys.indexOf(account)>=0})||null
}
function emails(v){
 var out=[],seen={};
 function take(x){
  if(Array.isArray(x)){x.forEach(take);return}
  if(x&&typeof x==='object'){take(x.email||x.mail||x.address);return}
  String(x==null?'':x).replace(/mailto:/gi,' ').split(/[;,\n\r\t ]+/).forEach(function(part){var m=String(part||'').match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i);if(!m)return;var e=q(m[0]).replace(/[.,;:]+$/,''),k=low(e);if(e&&!seen[k]){seen[k]=1;out.push(e)}})
 }
 take(v);return out
}
function addContact(out,seen,name,email,source){
 emails(email).forEach(function(e){var key=low(e),old=seen[key];if(old){if(!old.name&&name)old.name=q(name);return}var row={name:q(name),email:e,source:q(source)};seen[key]=row;out.push(row)})
}
function directoryContacts(c,target){
 var out=[],seen={};
 if(!c)return out;
 if(target==='customer'){
  addContact(out,seen,q(c.contactName||c.customerContactName),[c.customerEmail,c.customerMail,c.email,c.mail],'Kunde');
  arr(c.ccContacts).concat(arr(c.customerCcContacts)).forEach(function(x){addContact(out,seen,x&&x.name,x&&x.email,'Kundenordner')});
  var api=w.ExportHUBRC1092CustomerContacts;if(api&&typeof api.mailContacts==='function'){try{api.mailContacts(c,'cc').forEach(function(x){addContact(out,seen,x&&x.name,x&&x.email,'Kundenordner')})}catch(_){}}
 }else{
  addContact(out,seen,q(c.carrierName||c.speditionName),[c.carrierEmail,c.carrierMail,c.speditionMail,c.forwarderEmail,c.forwarderMail],'Spedition');
  arr(c.carrierContacts).concat(arr(c.speditionContacts),arr(c.forwarderContacts)).forEach(function(x){addContact(out,seen,x&&x.name,x&&x.email,'Spedition')});
 }
 arr(c.customerContactDirectory).concat(arr(c.contactDirectory)).forEach(function(x){
  var roles=arr(x&&x.roles).concat([x&&x.role]).map(low),carrier=roles.some(function(r){return /carrier|spedition|forwarder|fracht/.test(r)});
  if(target==='carrier'&&carrier)addContact(out,seen,x&&x.name,x&&x.email,'Kontakt');
  if(target==='customer'&&!carrier&&!roles.some(function(r){return r==='sales'}))addContact(out,seen,x&&x.name,x&&x.email,'Kontakt')
 });
 return out
}
function shipmentContacts(sh,target){
 var out=[],seen={},c=customerFor(sh);
 directoryContacts(c,target).forEach(function(x){addContact(out,seen,x.name,x.email,x.source)});
 if(target==='carrier')addContact(out,seen,q(sh&& (sh.carrierName||sh.speditionName||sh.carrier)),[sh&&sh.carrierEmail,sh&&sh.carrierMail,sh&&sh.speditionEmail,sh&&sh.speditionMail,sh&&sh.forwarderEmail,sh&&sh.forwarderMail],'Sendung');
 else addContact(out,seen,q(sh&& (sh.recipientName||sh.customerName)),[sh&&sh.customerEmail,sh&&sh.customerMail,sh&&sh.recipientEmail],'Sendung');
 return out
}
function exception(sh){
 var name=low(sh&& (sh.customerName||sh.customer&&sh.customer.name||sh.customer));
 var c=customerFor(sh);name+=' '+low(c&& (c.name||c.customerName));
 return /\bbmp\b/.test(name)||/b[oö]llhof/.test(name)
}
function closed(sh){
 if(!sh)return true;
 if(q(sh.actualPickupAt||sh.pickedUpAt||sh.pickupConfirmedAt||sh.qrPickupConfirmedAt||sh.pickupCompletedAt))return true;
 return /^(?:abgeholt|pod vorhanden|abgeschlossen|archiviert|picked up|pod available|completed|archived)$/i.test(q(sh.status||sh.shipmentStatus||sh.processStatus))
}
function avisLink(sh){
 if(!sh||exception(sh)||closed(sh))return'';
 var direct=q(sh.customerAvisUrl||sh.avisUrl||sh.customerAvisLink||sh.avisLink);
 if(/^https:\/\//i.test(direct))return direct;
 var api=w.ExportHUBCustomerAvis706||w.ExportHUBCustomerAvis705;
 try{if(api&&typeof api.link==='function'){var u=q(api.link(sh));if(/^https:\/\//i.test(u))return u}}catch(_){}
 return''
}
function localizedLink(url,lang){
 lang=normalizeLanguage(lang);
 try{var u=new URL(url,w.location&&w.location.href||'https://exporthub.invalid/');u.searchParams.set('lang',lang);return u.toString()}catch(_){return url}
}
function subject(sh,target,lang){
 var ref=refOf(sh);lang=normalizeLanguage(lang);
 var prefix={
  de:{carrier:'Erinnerung – Lieferavis Abholung ',customer:'Erinnerung – Lieferavis '},
  en:{carrier:'Reminder – collection notice ',customer:'Reminder – shipment notice '},
  pl:{carrier:'Przypomnienie – awizo odbioru ',customer:'Przypomnienie – awizo wysyłki '},
  es:{carrier:'Recordatorio – aviso de recogida ',customer:'Recordatorio – aviso de envío '},
  fr:{carrier:'Rappel – avis d’enlèvement ',customer:'Rappel – avis d’expédition '},
  it:{carrier:'Promemoria – avviso di ritiro ',customer:'Promemoria – avviso di spedizione '}
 }[lang];
 return prefix[target==='carrier'?'carrier':'customer']+ref
}
function body(sh,target,lang,url){
 var ref=refOf(sh);lang=normalizeLanguage(lang);target=target==='carrier'?'carrier':'customer';var u=localizedLink(url,lang);
 var templates={
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
 return templates[lang][target].replace(/\{\{ref\}\}/g,ref).replace(/\{\{url\}\}/g,u)
}
function authToken(){
 try{var rt=w.ExportHUBClean&&w.ExportHUBClean.runtime||{},t=q(rt.authToken||rt.sessionToken);if(t)return t}catch(_){}
 try{for(var i=0;w.sessionStorage&&i<w.sessionStorage.length;i++){var raw=w.sessionStorage.getItem(w.sessionStorage.key(i));if(!raw||raw.charAt(0)!=='{')continue;var x=JSON.parse(raw);if(x&&x.token)return q(x.token)}}catch(_){}
 return''
}
function environmentName(){try{return /-testservice\./i.test(String(w.location&&w.location.hostname||''))?'testservice':'production'}catch(_){return'production'}}
function apiHeaders(){
 var t=authToken();if(!t)throw new Error('ExportHUB-Sitzung ist nicht mehr gültig.');
 return{'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Token':t,'X-ExportHUB-Session':t,'Authorization':'Bearer '+t,'X-ExportHUB-Environment':environmentName()}
}
async function sendReminder(sh,email,target,lang,url){
 var response=await w.fetch('/api/avis-reminder-mail',{method:'POST',credentials:'same-origin',cache:'no-store',headers:apiHeaders(),body:JSON.stringify({shipmentId:idOf(sh),reference:refOf(sh),recipient:q(email),target:target==='carrier'?'carrier':'customer',language:normalizeLanguage(lang),avisUrl:url})});
 var raw=await response.text(),data={};try{data=raw?JSON.parse(raw):{}}catch(_){data={message:raw}}
 if(!response.ok||data.ok===false){var e=new Error(q(data.message)||('HTTP '+response.status));e.code=q(data.code);throw e}
 return data
}
function inOverview(){var b=d.body;return !!(b&&low(b.getAttribute('data-exporthub-view'))==='shipmentoverview')}
function ensureStyle(){
 if(d.getElementById('rc1166AvisReminderStyle'))return;
 var s=d.createElement('style');s.id='rc1166AvisReminderStyle';s.textContent='.rc1166-reminder-btn{background:#2563eb!important;color:#fff!important;border-color:#1d4ed8!important}.rc1166-reminder-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.rc1166-dialog{position:fixed;inset:0;z-index:130000;background:rgba(15,23,42,.65);display:grid;place-items:center;padding:16px}.rc1166-card{width:min(680px,100%);max-height:92vh;overflow:auto;background:#fff;color:#0f172a;border-radius:16px;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,.3)}.rc1166-card h3{margin:0 0 6px}.rc1166-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}.rc1166-card label{display:grid;gap:6px;font-weight:700}.rc1166-card select,.rc1166-card textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid #94a3b8;border-radius:9px;background:#fff;color:#0f172a}.rc1166-card textarea{min-height:190px;resize:vertical}.rc1166-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}.rc1166-note{font-size:12px;color:#64748b}.rc1166-warning{padding:9px 11px;border-radius:9px;background:#fff7ed;color:#9a3412;border:1px solid #fdba74;margin:10px 0}.rc1207-send-status{margin:10px 0 0;padding:9px 11px;border-radius:9px;font-size:13px;font-weight:700}.rc1207-send-status[data-kind="ok"]{background:#ecfdf5;color:#166534;border:1px solid #86efac}.rc1207-send-status[data-kind="bad"]{background:#fef2f2;color:#991b1b;border:1px solid #fca5a5}@media(max-width:640px){.rc1166-grid{grid-template-columns:1fr}.rc1166-reminder-row{grid-template-columns:1fr}.rc1166-actions button{width:100%}}';
 (d.head||d.documentElement).appendChild(s)
}
function closeDialog(){if(dialog&&dialog.parentNode)dialog.parentNode.removeChild(dialog);dialog=null}
function options(list){return list.map(function(x){return'<option value="'+esc(x.email)+'">'+esc((x.name?x.name+' · ':'')+x.email+(x.source?' · '+x.source:''))+'</option>'}).join('')}
function openDialog(sh){
 closeDialog();var url=avisLink(sh);if(!url)return false;ensureStyle();
 dialog=d.createElement('div');dialog.className='rc1166-dialog';dialog.id='rc1166AvisReminderDialog';dialog.innerHTML='<section class="rc1166-card" role="dialog" aria-modal="true" aria-labelledby="rc1166Title"><h3 id="rc1166Title">Avis-Erinnerung</h3><div class="rc1166-note">Referenz '+esc(refOf(sh))+' · der sichere Lieferavis-Link wird automatisch eingefügt.</div><div class="rc1166-grid"><label>Empfängergruppe<select data-target><option value="customer">Kunde</option><option value="carrier">Spedition</option></select></label><label>Sprache<select data-lang><option value="de">Deutsch</option><option value="en">English</option><option value="pl">Polski</option><option value="es">Español</option><option value="fr">Français</option><option value="it">Italiano</option></select></label></div><label>Empfänger<select data-recipient></select></label><div data-warning></div><label>Mailtext<textarea data-body readonly></textarea></label><div data-send-status class="rc1207-send-status" hidden></div><div class="rc1166-actions"><button type="button" class="ghost" data-close>Abbrechen</button><button type="button" class="btn rc1166-reminder-btn" data-open>Erinnerungsmail senden</button></div><p class="rc1166-note">Die Erinnerung wird direkt über ExportHUB versendet und anschließend in der Sendungshistorie protokolliert.</p></section>';
 d.body.appendChild(dialog);
 var target=dialog.querySelector('[data-target]'),lang=dialog.querySelector('[data-lang]'),recipient=dialog.querySelector('[data-recipient]'),text=dialog.querySelector('[data-body]'),warning=dialog.querySelector('[data-warning]'),open=dialog.querySelector('[data-open]'),sendStatus=dialog.querySelector('[data-send-status]');
 function refresh(){
  var t=target.value==='carrier'?'carrier':'customer',l=normalizeLanguage(lang.value),list=shipmentContacts(sh,t),previous=recipient.value;
  recipient.innerHTML=options(list);if(previous&&list.some(function(x){return x.email===previous}))recipient.value=previous;
  text.value=body(sh,t,l,url);var has=!!recipient.value;open.disabled=!has;warning.innerHTML=has?'':'<div class="rc1166-warning">Für '+(t==='carrier'?'die Spedition':'den Kunden')+' ist noch kein E-Mail-Empfänger hinterlegt.</div>'
 }
 target.addEventListener('change',refresh);lang.addEventListener('change',refresh);
 dialog.querySelector('[data-close]').addEventListener('click',closeDialog);
 dialog.addEventListener('click',function(e){if(e.target===dialog)closeDialog()});
 open.addEventListener('click',async function(){
  var email=q(recipient.value);if(!email)return;var t=target.value==='carrier'?'carrier':'customer',l=normalizeLanguage(lang.value),oldLabel=q(open.textContent);
  open.disabled=true;open.textContent='Wird gesendet …';sendStatus.hidden=true;sendStatus.textContent='';sendStatus.removeAttribute('data-kind');
  try{
   var result=await sendReminder(sh,email,t,l,url),event={id:q(result.historyId),at:q(result.sentAt)||new Date().toISOString(),type:'mail-sent',label:'Avis-Erinnerung versendet',details:{reference:refOf(sh),to:email,subject:q(result.subject),mailType:'avis-reminder',target:t,language:l}};
   sh.shipmentHistory=Array.isArray(sh.shipmentHistory)?sh.shipmentHistory:[];if(event.id&&!sh.shipmentHistory.some(function(x){return x&&x.id===event.id}))sh.shipmentHistory.push(event);
   sendStatus.hidden=false;sendStatus.setAttribute('data-kind','ok');sendStatus.textContent='Erinnerungsmail erfolgreich an '+email+' gesendet.';
   open.textContent='Gesendet ✓';
   try{w.dispatchEvent(new CustomEvent('exporthub:shipment-updated',{detail:{shipment:sh,source:'rc1207-avis-reminder'}}));w.dispatchEvent(new CustomEvent('exporthub:history-updated',{detail:{shipment:sh}}))}catch(_){}
  }catch(err){
   open.disabled=false;open.textContent=oldLabel||'Erinnerungsmail senden';sendStatus.hidden=false;sendStatus.setAttribute('data-kind','bad');sendStatus.textContent=q(err&&err.message)||'Erinnerungsmail konnte nicht gesendet werden.'
  }
 });
 refresh();return true
}
function ensureButton(card,sh){
 var url=avisLink(sh),old=card.querySelector&&card.querySelector('[data-rc1166-avis-reminder]');
 if(!url){if(old)old.remove();return false}
 if(old){old.__rc1166Shipment=sh;return true}
 var btn=d.createElement('button');btn.type='button';btn.className='btn rc1166-reminder-btn';btn.setAttribute('data-rc1166-avis-reminder','1');btn.textContent='Avis-Erinnerung senden';btn.__rc1166Shipment=sh;btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openDialog(btn.__rc1166Shipment)});
 var host=card.querySelector&&card.querySelector('.actions,.card-actions,.overview-actions,.rc524-actions,.rc485-actions,.rc229-actions,[data-actions]');
 if(!host){host=d.createElement('div');host.className='rc1166-reminder-row';card.appendChild(host)}
 host.appendChild(btn);return true
}
function render(){
 if(!inOverview()){d.querySelectorAll('[data-rc1166-avis-reminder]').forEach(function(x){x.remove()});closeDialog();return 0}
 ensureStyle();var shipments=allShipments(),cards=Array.from(d.querySelectorAll('.rc524-shipment-card,.rc485-overview-card,.rc229-shipment-card,.shipment-card,.overview-card,[data-shipment-id],[data-shipment-ref],[data-ref],[data-reference]')),count=0;
 cards.forEach(function(card){var sh=cardShipment(card,shipments);if(sh&&ensureButton(card,sh))count++;else if(!sh){var b=card.querySelector&&card.querySelector('[data-rc1166-avis-reminder]');if(b)b.remove()}});return count
}
function schedule(){if(timer)return;timer=w.setTimeout(function(){timer=0;try{render()}catch(e){try{console.warn('RC1166 Avis-Erinnerung',e)}catch(_){}}},0)}
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded','exporthub:shipment-updated','exporthub:overview-updated','exporthub:customer-avis-updated','exporthub:customer-mail-contacts-updated'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
w.ExportHUBRC1166AvisReminder=Object.freeze({version:'RC1207',shipmentContacts:shipmentContacts,avisLink:avisLink,subject:subject,body:body,sendReminder:sendReminder,render:render});
})(window,document);
