(function(){
'use strict';
if(window.__EXPORTHUB_RC1015_LIEFERAVIS_MAIL_FLOW__)return;
window.__EXPORTHUB_RC1015_LIEFERAVIS_MAIL_FLOW__=true;

var base=null,wrapper=null;
var RC1018_AVIS_EXCEPTIONS=Object.freeze({bmp:'Kunden-IT blockiert den Zugriff'});
var RC1018_AVIS_BLOCK_MESSAGE='Lieferavis für diesen Kunden nicht verfügbar – Kunden-IT blockiert den Zugriff.';
function q(v){return String(v==null?'':v).trim()}
function scalarName(v){
 if(v==null||typeof v==='object'||typeof v==='boolean')return'';
 var text=q(v);return !text||/^(?:true|false|null|undefined|\[object Object\])$/i.test(text)?'':text
}
function objectName(v){
 if(!v||typeof v!=='object')return'';
 var fields=[v.name,v.customerName,v.companyName,v.displayName,v.label];
 for(var i=0;i<fields.length;i++){var text=scalarName(fields[i]);if(text)return text}
 return''
}
function shipmentCustomerName(sh){
 sh=sh&&typeof sh==='object'?sh:{};
 var fields=[sh.customerName,sh.customerDisplay,sh.recipientCustomerName,sh.consigneeName,sh.recipientName,sh.companyName,sh.locationName];
 for(var i=0;i<fields.length;i++){var text=scalarName(fields[i]);if(text)return text}
 return scalarName(sh.customer)||objectName(sh.customer)||scalarName(sh.recipient)||objectName(sh.recipient)||''
}
function rc1018AvisException(sh){
 var name=shipmentCustomerName(sh),key=name.toLocaleLowerCase('de-DE').replace(/\s+/g,' ').trim();
 return Object.prototype.hasOwnProperty.call(RC1018_AVIS_EXCEPTIONS,key)?{customer:name,key:key,reason:RC1018_AVIS_EXCEPTIONS[key]}:null
}
function shipmentReference(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.referenceNo||sh.id||sh.shipmentId)).toUpperCase()}
function currentState(){
 try{if(typeof window.__EXPORTHUB_GET_STATE__==='function')return window.__EXPORTHUB_GET_STATE__()||{}}catch(_){}
 return window.ExportHUBClean&&window.ExportHUBClean.state||window.appState||{}
}
function currentShipmentForAvis(){
 var state=currentState(),ref=rc1015DraftReference(),lists=[state.shipments,state.savedShipments,state.salesSharedShipments,state.sharedShipments],candidates=[];
 [state.currentShipment,state.shipment].forEach(function(item){if(item&&typeof item==='object')candidates.push(item)});
 lists.forEach(function(list){if(Array.isArray(list))list.forEach(function(item){if(item&&typeof item==='object')candidates.push(item)})});
 if(ref){for(var i=0;i<candidates.length;i++){if(shipmentReference(candidates[i])===ref)return candidates[i]}}
 return candidates.length===1?candidates[0]:null
}
function rc1018Enabled(sh){
 if(rc1018AvisException(sh))return false;
 try{return !!(base&&typeof base.enabled==='function'&&base.enabled(sh))}catch(_){return false}
}
function referenceInput(){
 return Array.from(document.querySelectorAll('#content input')).find(function(input){
  var label=input.closest&&input.closest('label,.field');
  return /sendungsreferenz|referenznummer/i.test((input.id||'')+' '+(input.name||'')+' '+(label&&label.textContent||''));
 })||null
}
function rc1015DraftReference(){
 var input=referenceInput(),value=q(input&&input.value).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
 return /^[A-Z0-9]{6}$/.test(value)?value:''
}
async function persist(reason){
 var core=window.ExportHUBRC565;
 if(core&&typeof core.persistShipment==='function'){
  var result=await core.persistShipment();
  if(result!==true)throw new Error('Die Sendung konnte nicht dauerhaft gespeichert werden.');
  return true
 }
 var clean=window.ExportHUBClean;
 if(!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')throw new Error('Die Azure-Speicherung ist noch nicht verfügbar.');
 await clean.queueSave(reason);
 var ok=await clean.flushSave(reason,{force:true,userInitiated:true});
 if(ok!==true)throw new Error('Die Azure-Speicherung wurde nicht bestätigt.');
 return true
}
async function rc1015PersistBeforeAvis(){
 if(!rc1015DraftReference())throw new Error('Bitte zuerst eine gültige sechsstellige Sendungsreferenz eingeben.');
 await persist('Sendung vor Lieferavis automatisch gespeichert');
 return true
}
async function rc1015Toggle(on){
 if(!base||typeof base.toggle!=='function')return false;
 if(on&&rc1018AvisException(currentShipmentForAvis())){
  alert(RC1018_AVIS_BLOCK_MESSAGE);
  return false
 }
 if(on&&!rc1015DraftReference()){
  alert('Bitte zuerst eine gültige sechsstellige Sendungsreferenz eingeben.');
  return false
 }
 try{
  if(on)await rc1015PersistBeforeAvis();
  return await base.toggle(on)
 }catch(e){
  console.error('RC1015 Lieferavis automatisch speichern',e);
  alert('Der Lieferavis konnte nicht aktiviert werden. Die Sendung wurde vorher nicht sicher gespeichert.\n\n'+q(e&&e.message||e));
  return false
 }
}
function stripAvisBlocks(text){
 text=String(text==null?'':text).replace(/\r\n/g,'\n');
 text=text.replace(/\n*--- ExportHUB Kunden-Avis ---[\s\S]*?\n---(?=\n|$)/g,'');
 text=text.replace(/\n*─{8,}\n(?:LIEFERAVIS \/ KUNDENPORTAL|COLLECTION NOTICE \/ CUSTOMER PORTAL|KUNDEN-AVIS – LIVE-ZUGANG|CUSTOMER COLLECTION NOTICE – LIVE AVIS|LIEFERAVIS – LIVE-ZUGANG|COLLECTION NOTICE – LIVE ACCESS)[\s\S]*?\n─{8,}(?=\n|$)/g,'');
 text=text.replace(/\n*-{20,}\n(?:KUNDEN-AVIS – DAUERHAFTER ZUGANG|CUSTOMER COLLECTION NOTICE – PERSISTENT ACCESS|KUNDEN-AVIS – LIVE-ZUGANG|CUSTOMER COLLECTION NOTICE – LIVE AVIS|LIEFERAVIS – LIVE-ZUGANG|COLLECTION NOTICE – LIVE ACCESS)[\s\S]*?\n-{20,}(?=\n|$)/g,'');
 return text.replace(/\n{3,}/g,'\n\n').trim()
}
function mailEnvelope(clean,lang){
 var text=String(clean||'').replace(/\r\n/g,'\n').trim(),greeting='',closing='';
 var greetingRx=lang==='en'?/^(?:Dear\b[^\n]*|Hello\b[^\n]*|Good (?:morning|afternoon)\b[^\n]*)\n(?:[ \t]*\n)?/i:/^(?:Sehr geehrte\b[^\n]*|Guten Tag\b[^\n]*|Hallo\b[^\n]*)\n(?:[ \t]*\n)?/i;
 var gm=text.match(greetingRx);if(gm){greeting=gm[0].trim();text=text.slice(gm[0].length)}
 var closingRx=lang==='en'?/(?:Kind regards|Best regards|Yours sincerely|Yours faithfully)[\s\S]*$/i:/(?:Mit freundlichen Grüßen|Freundliche Grüße|Viele Grüße)[\s\S]*$/i;
 var cm=text.match(closingRx);if(cm)closing=cm[0].trim();
 if(!closing)closing=lang==='en'?'Kind regards':'Mit freundlichen Grüßen';
 return{greeting:greeting,closing:closing}
}
function rc1015AvisMailVariant(clean,u,reference,lang){
 var parts=mailEnvelope(stripAvisBlocks(clean),lang),en=lang==='en',line='────────────────────────────',block;
 if(en){
  block=line+'\nCOLLECTION NOTICE – LIVE ACCESS\n\nA collection notice is available for this shipment.\n\nPlease open the link below and enter the planned collection date and time window and, if already known, the vehicle licence plate. The released shipment information and documents can be viewed directly in the collection notice.\n\nCollection notice:\n'+u+'\nReference: '+reference+'\n\nPlease provide the collection information through this collection notice; the shipment details do not need to be confirmed again by email.\n\nThe link can be opened again and is automatically deactivated three business days after the actual collection. Saturday and Sunday are not counted as business days.\n\nPlease contact us if you have any questions.\n'+line;
 }else{
  block=line+'\nLIEFERAVIS – LIVE-ZUGANG\n\nFür diese Sendung steht Ihnen unser Lieferavis zur Verfügung.\n\nBitte öffnen Sie den folgenden Link und tragen Sie dort den geplanten Abholtermin mit Zeitfenster sowie, sofern bereits bekannt, das Kennzeichen des Abholfahrzeugs ein. Die freigegebenen Sendungsinformationen und Dokumente können Sie direkt im Lieferavis einsehen.\n\nLieferavis:\n'+u+'\nReferenz: '+reference+'\n\nBitte übermitteln Sie die Abholdaten über diesen Lieferavis; die Sendungsdetails müssen nicht zusätzlich per E-Mail bestätigt werden.\n\nDer Link kann erneut geöffnet werden und wird drei Arbeitstage nach der tatsächlichen Abholung automatisch deaktiviert. Samstag und Sonntag zählen dabei nicht als Arbeitstage.\n\nBei Rückfragen stehen wir Ihnen gerne zur Verfügung.\n'+line;
 }
 return[parts.greeting,block,parts.closing].filter(Boolean).join('\n\n')
}
function rc1015InjectMailBody(sh,target,body,langOverride){
 if(!base)return String(body==null?'':body);
 if(target==='customer'&&rc1018AvisException(sh))return stripAvisBlocks(body);
 if(target!=='customer'||!rc1018Enabled(sh))return typeof base.injectMailBody==='function'?base.injectMailBody(sh,target,body,langOverride):String(body==null?'':body);
 var clean=stripAvisBlocks(body),u=q(base.link&&base.link(sh)),reference=q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.id||sh.shipmentId)),lang=q(langOverride).toLowerCase()==='en'?'en':'de';
 if(!u)return clean;
 return rc1015AvisMailVariant(clean,u,reference,lang)
}
function rc1015UpdateLieferavisButton(){
 var panel=document.getElementById('rc897LieferavisPanel'),btn=panel&&panel.querySelector('[data-rc897-avis-action="toggle"]');
 if(!btn)return false;
 var active=panel.getAttribute('data-active')==='1'||/deaktivieren/i.test(q(btn.textContent)),blocked=rc1018AvisException(currentShipmentForAvis());
 if(!active)btn.disabled=!!blocked||!wrapper||!rc1015DraftReference();
 var help=panel.querySelectorAll('.rc897-avis-help'),last=help&&help.length?help[help.length-1]:null;
 if(last&&!active)last.textContent=blocked?RC1018_AVIS_BLOCK_MESSAGE:'Der Lieferavis kann direkt aktiviert werden. ExportHUB speichert die Sendung davor automatisch und erzeugt anschließend den Kundenlink.';
 return true
}
function mailModeLabel(type,sh,lang){
 var active=false,blocked=type==='customer'&&rc1018AvisException(sh||currentShipmentForAvis());
 try{active=!blocked&&type==='customer'&&!!(wrapper&&sh&&wrapper.enabled(sh))}catch(_){}
 if(!blocked&&!active&&type==='customer'){var panel=document.getElementById('rc897LieferavisPanel');active=!!(panel&&panel.getAttribute('data-active')==='1')}
 if(active)return lang==='en'?'Collection notice':'Lieferavis';
 return type==='customer'?'Kundenmail':type==='carrier'?'Speditionsmail':type==='own'?'Eigene Info-Mail':'Mail'
}
function patchMailMode(){
 var area=document.getElementById('rc543MailArea');if(!area)return false;
 var active=area.querySelector('[data-rc543-target].active'),type=q(active&&active.getAttribute('data-rc543-target'))||'customer',lang=q((document.getElementById('rc543MailLang')||{}).value).toLowerCase()==='en'?'en':'de',standard=document.getElementById('rc543MailStandard');
 if(standard){var label=mailModeLabel(type,null,lang)+' · '+(lang==='en'?'Englisch':'Deutsch');if(standard.value!==label)standard.value=label;standard.setAttribute('data-rc1015-mail-mode',type==='customer'&&/lieferavis|collection notice/i.test(label)?'lieferavis':'sendungsdetails')}
 return true
}
function refreshUi(){requestAnimationFrame(function(){rc1015UpdateLieferavisButton();patchMailMode()})}
function install(){
 var current=window.ExportHUBCustomerAvis706||window.ExportHUBCustomerAvis705;
 if(!current)return false;
 if(current.__rc1018===true){wrapper=current;base=current.__base||base;refreshUi();return true}
 if(current.__rc1015===true&&current.__base)current=current.__base;
 base=current;
 wrapper=Object.freeze(Object.assign({},base,{version:'RC1015',enabled:rc1018Enabled,toggle:rc1015Toggle,injectMailBody:rc1015InjectMailBody,avisException:rc1018AvisException,__rc1018:true,__rc1015:true,__base:base}));
 window.ExportHUBCustomerAvis706=wrapper;
 window.ExportHUBCustomerAvis705=wrapper;
 refreshUi();
 return true
}
function boot(){if(!install())setTimeout(install,80);refreshUi()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync','exporthub:shipment-saved','exporthub:customer-avis-updated','exporthub:mail-language-changed'].forEach(function(name){window.addEventListener(name,function(){install();refreshUi()})});
document.addEventListener('input',function(e){var input=e.target;if(input&&input.matches&&input.matches('#content input'))refreshUi()},true);
document.addEventListener('change',function(){refreshUi()},true);
})();
