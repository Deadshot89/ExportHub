(function(){
'use strict';
if(window.__EXPORTHUB_RC1015_LIEFERAVIS_MAIL_FLOW__)return;
window.__EXPORTHUB_RC1015_LIEFERAVIS_MAIL_FLOW__=true;

var base=null,wrapper=null,autoEnablePending=Object.create(null),mailSourceCache=new Map(),visibleMailSyncing=false;
var RC1018_AVIS_EXCEPTIONS=Object.freeze({bmp:'Kunden-IT blockiert den Zugriff','böllhof':'Kein Lieferavis für diesen Kunden','böllhoff':'Kein Lieferavis für diesen Kunden',boellhof:'Kein Lieferavis für diesen Kunden',boellhoff:'Kein Lieferavis für diesen Kunden'});
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
 var name=shipmentCustomerName(sh),key=name.toLocaleLowerCase('de-DE').replace(/\s+/g,' ').trim(),matchKey='';
 for(var candidate in RC1018_AVIS_EXCEPTIONS)if(Object.prototype.hasOwnProperty.call(RC1018_AVIS_EXCEPTIONS,candidate)&&(key===candidate||key.indexOf(candidate+' ')===0)){matchKey=candidate;break}
 return matchKey?{customer:name,key:matchKey,reason:RC1018_AVIS_EXCEPTIONS[matchKey]}:null
}
function shipmentReference(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.referenceNo||sh.id||sh.shipmentId)).toUpperCase()}
function currentState(){
 try{if(typeof window.__EXPORTHUB_GET_STATE__==='function')return window.__EXPORTHUB_GET_STATE__()||{}}catch(_){}
 return window.ExportHUBClean&&window.ExportHUBClean.state||window.appState||{}
}
function currentShipmentForAvis(){
 var state=currentState(),ref=rc1015DraftReference(),lists=[state.shipments,state.savedShipments,state.salesSharedShipments,state.sharedShipments],candidates=[];
 function add(item){if(item&&typeof item==='object'&&candidates.indexOf(item)<0)candidates.push(item)}
 [state.currentShipment,state.shipment,state.selectedShipment].forEach(add);
 lists.forEach(function(list){if(Array.isArray(list))list.forEach(add)});
 if(ref){for(var i=0;i<candidates.length;i++){if(shipmentReference(candidates[i])===ref)return candidates[i]}}
 return candidates.length===1?candidates[0]:null
}
function rc1021Persisted(sh){
 if(!sh||typeof sh!=='object')return false;
 var state=currentState(),ref=shipmentReference(sh),lists=[state.shipments,state.savedShipments,state.salesSharedShipments,state.sharedShipments];
 for(var i=0;i<lists.length;i++){
  var list=lists[i];if(!Array.isArray(list))continue;
  for(var j=0;j<list.length;j++){
   var item=list[j];if(item===sh)return true;
   if(ref&&item&&typeof item==='object'&&shipmentReference(item)===ref)return true
  }
 }
 return false
}
function rc1021WasManuallyDisabled(sh){return !!q(sh&&(sh.customerAvisDisabledAt||sh.avisDisabledAt))}
function rc1021Closed(sh){
 if(!sh||typeof sh!=='object')return false;
 if(q(sh.pickedUpAt||sh.pickupConfirmedAt||sh.actualPickupAt||sh.collectedAt))return true;
 var status=q(sh.status||sh.shipmentStatus).toLocaleLowerCase('de-DE');
 return /^(?:abgeholt|pod vorhanden|abgeschlossen|archiviert|storniert|picked up|pod available|completed|archived|cancelled)$/.test(status)
}
function rc1024ServerEnabled(sh){try{return !!(base&&typeof base.enabled==='function'&&base.enabled(sh))}catch(_){return false}}
function rc1018Enabled(sh){
 if(!sh||typeof sh!=='object'||rc1018AvisException(sh)||rc1021WasManuallyDisabled(sh))return false;
 if(rc1024ServerEnabled(sh))return true;
 return !rc1021Closed(sh)
}
function rc1021ShouldAutoEnable(sh){
 if(!sh||typeof sh!=='object'||!rc1021Persisted(sh))return false;
 if(!shipmentCustomerName(sh)||rc1018AvisException(sh)||rc1021WasManuallyDisabled(sh)||rc1021Closed(sh))return false;
 if(!/^[A-Z0-9]{6}$/.test(rc1015DraftReference()))return false;
 if(rc1024ServerEnabled(sh))return false;
 return !!(base&&typeof base.toggle==='function')
}
function referenceInput(){
 return Array.from(document.querySelectorAll('#content input')).find(function(input){
  var label=input.closest&&input.closest('label,.field');
  return /sendungsreferenz|referenznummer/i.test((input.id||'')+' '+(input.name||'')+' '+(label&&label.textContent||''));
 })||null
}
function canonicalDraftReference(){
 var state=currentState(),candidates=[state.shipment,state.currentShipment,state.selectedShipment];
 for(var i=0;i<candidates.length;i++){
  var value=shipmentReference(candidates[i]).replace(/[^A-Z0-9]/g,'').slice(0,6);
  if(/^[A-Z0-9]{6}$/.test(value))return value
 }
 return''
}
function rc1015DraftReference(){
 var input=referenceInput(),value=q(input&&input.value).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
 if(/^[A-Z0-9]{6}$/.test(value))return value;
 return canonicalDraftReference()
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
function rc1021NotifyAvisUpdated(on,sh){
 if(!window||typeof window.dispatchEvent!=='function')return false;
 var detail={enabled:!!on,reference:shipmentReference(sh||currentShipmentForAvis())};
 try{window.dispatchEvent(new CustomEvent('exporthub:customer-avis-updated',{detail:detail}));return true}catch(_){}
 try{window.dispatchEvent(new Event('exporthub:customer-avis-updated'));return true}catch(_){}
 return false
}
function rc1024MarkDraftDisabled(sh){
 if(!sh||typeof sh!=='object')return false;
 var at=new Date().toISOString();
 sh.customerAvisEnabled=false;sh.avisEnabled=false;sh.customerAvisDisabledAt=at;sh.avisDisabledAt=at;
 return true
}
function rc1024ClearDraftDisabled(sh){
 if(!sh||typeof sh!=='object')return false;
 sh.customerAvisDisabledAt='';sh.avisDisabledAt='';
 return true
}
async function rc1015Toggle(on){
 if(!base||typeof base.toggle!=='function')return false;
 var sh=currentShipmentForAvis();
 if(on&&rc1018AvisException(sh)){
  alert(RC1018_AVIS_BLOCK_MESSAGE);
  return false
 }
 if(!on&&!rc1024ServerEnabled(sh)){
  var locallyDisabled=rc1024MarkDraftDisabled(sh);
  rc1021NotifyAvisUpdated(false,sh);refreshUi();return locallyDisabled
 }
 if(on&&!rc1015DraftReference()){
  if(sh&&rc1021WasManuallyDisabled(sh)){
   rc1024ClearDraftDisabled(sh);rc1021NotifyAvisUpdated(true,sh);refreshUi();return true
  }
  alert('Bitte zuerst eine gültige sechsstellige Sendungsreferenz eingeben.');
  return false
 }
 try{
  if(on){rc1024ClearDraftDisabled(sh);await rc1015PersistBeforeAvis()}
  if(on&&rc1018AvisException(currentShipmentForAvis())){
   alert(RC1018_AVIS_BLOCK_MESSAGE);
   refreshUi();
   return false
  }
  var result=await base.toggle(on);
  rc1021NotifyAvisUpdated(on,currentShipmentForAvis());
  refreshUi();
  return result
 }catch(e){
  console.error('RC1015 Lieferavis automatisch speichern',e);
  alert('Der Lieferavis konnte nicht aktiviert werden. Die Sendung wurde vorher nicht sicher gespeichert.\n\n'+q(e&&e.message||e));
  return false
 }
}
async function rc1021AutoEnable(reason){
 var sh=currentShipmentForAvis();
 if(!rc1021ShouldAutoEnable(sh))return false;
 var ref=rc1015DraftReference();
 if(autoEnablePending[ref])return false;
 autoEnablePending[ref]=true;
 try{
  await rc1015PersistBeforeAvis();
  sh=currentShipmentForAvis()||sh;
  if(!rc1021ShouldAutoEnable(sh))return rc1018Enabled(sh);
  await base.toggle(true);
  sh=currentShipmentForAvis()||sh;
  rc1021NotifyAvisUpdated(true,sh);
  var active=rc1018Enabled(sh);
  refreshUi();
  return active
 }catch(e){
  console.error('RC1021 Lieferavis Standardaktivierung fehlgeschlagen',reason||'',e);
  return false
 }finally{
  delete autoEnablePending[ref]
 }
}
function stripAvisBlocks(text){
 text=String(text==null?'':text).replace(/\r\n/g,'\n');
 text=text.replace(/\n*--- ExportHUB Kunden-Avis ---[\s\S]*?\n---(?=\n|$)/g,'');
 text=text.replace(/\n*─{8,}\n(?:LIEFERAVIS \/ KUNDENPORTAL|COLLECTION NOTICE \/ CUSTOMER PORTAL|KUNDEN-AVIS – LIVE-ZUGANG|CUSTOMER COLLECTION NOTICE – LIVE AVIS|LIEFERAVIS – LIVE-ZUGANG|COLLECTION NOTICE – LIVE ACCESS)[\s\S]*?\n─{8,}(?=\n|$)/g,'');
 text=text.replace(/\n*-{20,}\n(?:KUNDEN-AVIS – DAUERHAFTER ZUGANG|CUSTOMER COLLECTION NOTICE – PERSISTENT ACCESS|KUNDEN-AVIS – LIVE-ZUGANG|CUSTOMER COLLECTION NOTICE – LIVE AVIS|LIEFERAVIS – LIVE-ZUGANG|COLLECTION NOTICE – LIVE ACCESS)[\s\S]*?\n-{20,}(?=\n|$)/g,'');
 return text.replace(/\n{3,}/g,'\n\n').trim()
}
function rc1024LocalizedAvisUrl(url,lang){
 url=q(url);if(!url)return'';
 try{var u=new URL(url,typeof location!=='undefined'?location.href:'https://exporthub.invalid/');u.searchParams.set('lang',lang==='en'?'en':'de');return u.toString()}catch(_){return url+(url.indexOf('?')>=0?'&':'?')+'lang='+(lang==='en'?'en':'de')}
}
function rc1024AvisBlock(u,reference,lang,target){
 var en=lang==='en',carrier=target==='carrier',url=rc1024LocalizedAvisUrl(u,lang),ref=q(reference);
 if(en&&carrier)return 'COLLECTION NOTICE – PICKUP\n\nA digital collection notice has been provided for the planned pickup of this shipment.\n\nPlease submit the pickup details using the link below. The released shipment documents are also available there.\n\nCollection notice:\n'+url+'\nReference: '+ref+'\n\nRequired information:\n• Pickup date\n• Time window\n• Vehicle licence plate, if known\n\nNo additional email confirmation of the pickup details is required.';
 if(en)return 'COLLECTION NOTICE\n\nA digital collection notice is available for this shipment.\n\nUse the link below to view the released shipment documents and submit the planned pickup.\n\nCollection notice:\n'+url+'\nReference: '+ref+'\n\nPlease enter the pickup date and time window. If known, please also add the vehicle licence plate.\n\nThank you.';
 if(carrier)return 'LIEFERAVIS – ABHOLUNG\n\nFür die geplante Abholung dieser Sendung steht ein digitales Lieferavis bereit.\n\nBitte erfassen Sie die Abholdaten über den folgenden Link. Die freigegebenen Sendungsunterlagen können dort ebenfalls eingesehen werden.\n\nLieferavis:\n'+url+'\nReferenz: '+ref+'\n\nErforderliche Angaben:\n• Abholdatum\n• Zeitfenster\n• Kennzeichen des Abholfahrzeugs, sofern bekannt\n\nEine zusätzliche Bestätigung der Abholdaten per E-Mail ist nicht erforderlich.';
 return 'LIEFERAVIS\n\nFür diese Sendung steht Ihnen unser digitales Lieferavis zur Verfügung.\n\nÜber den folgenden Link können Sie die freigegebenen Sendungsunterlagen einsehen und die Angaben zur geplanten Abholung übermitteln.\n\nLieferavis:\n'+url+'\nReferenz: '+ref+'\n\nBitte erfassen Sie Abholdatum und Zeitfenster. Sofern bekannt, ergänzen Sie bitte das Kennzeichen des Abholfahrzeugs.\n\nDie Angaben werden direkt der Sendung zugeordnet. Eine zusätzliche Rückmeldung per E-Mail ist nicht erforderlich.\n\nVielen Dank.'
}
function rc1024ReplaceSystemSlot(body,block){
 var source=String(body==null?'':body),patterns=[/(?:Details zur Sendung|Sendungsdetails)\s*:\s*\{\{SENDUNGSDETAILS\}\}/i,/(?:Shipment details)\s*:\s*\{\{SENDUNGSDETAILS\}\}/i,/\{\{SENDUNGSDETAILS\}\}/i];
 for(var i=0;i<patterns.length;i++)if(patterns[i].test(source))return source.replace(patterns[i],block);
 return source+(source?'\n\n':'')+block
}
function rc1015AvisMailVariant(clean,u,reference,lang,target){
 return rc1024ReplaceSystemSlot(clean,rc1024AvisBlock(u,reference,lang,target||'customer'))
}
function rc1024MailKey(sh,target,lang){return (shipmentReference(sh)||'draft')+'|'+q(target).toLowerCase()+'|'+(lang==='en'?'en':'de')}
function rc1024IsOurAvis(text){return /(?:^|\n)(?:LIEFERAVIS|COLLECTION NOTICE)(?:\s*[–-]\s*(?:ABHOLUNG|PICKUP))?\n/i.test(String(text||''))}
function rc1015InjectMailBody(sh,target,body,langOverride){
 var source=String(body==null?'':body),type=q(target).toLowerCase()||'customer',lang=q(langOverride).toLowerCase()==='en'?'en':'de';
 if(type!=='customer'&&type!=='carrier')return base&&typeof base.injectMailBody==='function'?base.injectMailBody(sh,target,source,langOverride):source;
 if(type==='customer'&&rc1018AvisException(sh))return source;
 var key=rc1024MailKey(sh,type,lang);if(!rc1024IsOurAvis(source))mailSourceCache.set(key,source);
 if(!rc1018Enabled(sh))return source;
 var u=q(base&&base.link&&base.link(sh));if(!u)return source;
 return rc1015AvisMailVariant(source,u,shipmentReference(sh),lang,type)
}
function rc1024SyncVisibleMail(){
 if(visibleMailSyncing||typeof document==='undefined')return false;
 var area=document.getElementById('rc543MailArea');if(!area)return false;
 var bodyEl=area.querySelector&&area.querySelector('textarea');if(!bodyEl)return false;
 var active=area.querySelector('[data-rc543-target].active'),type=q(active&&active.getAttribute('data-rc543-target'))||'customer';if(type!=='customer'&&type!=='carrier')return false;
 var sh=currentShipmentForAvis();if(!sh)return false;
 var lang=q((document.getElementById('rc543MailLang')||{}).value).toLowerCase()==='en'?'en':'de',key=rc1024MailKey(sh,type,lang),current=String(bodyEl.value==null?'':bodyEl.value),source=mailSourceCache.get(key)||'';
 if(!source&&!rc1024IsOurAvis(current)){source=current;mailSourceCache.set(key,current)}
 if(!source)return false;
 var next=source,u=q(base&&base.link&&base.link(sh));if(rc1018Enabled(sh)&&u)next=rc1015AvisMailVariant(source,u,shipmentReference(sh),lang,type);
 if(next===current)return false;
 visibleMailSyncing=true;try{bodyEl.value=next;try{bodyEl.dispatchEvent(new Event('input',{bubbles:true}))}catch(_){}try{bodyEl.dispatchEvent(new Event('change',{bubbles:true}))}catch(_){}}finally{visibleMailSyncing=false}
 return true
}
function rc1024ScheduleVisibleMail(){
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(function(){requestAnimationFrame(rc1024SyncVisibleMail)});else setTimeout(rc1024SyncVisibleMail,0)
}
function rc1015UpdateLieferavisButton(){
 var panel=document.getElementById('rc897LieferavisPanel'),btn=panel&&panel.querySelector('[data-rc897-avis-action="toggle"]');
 if(!btn)return false;
 var sh=currentShipmentForAvis(),blocked=rc1018AvisException(sh),active=!blocked&&rc1018Enabled(sh);
 panel.setAttribute('data-active',active?'1':'0');
 btn.textContent=active?'Deaktivieren':'Aktivieren';
 btn.disabled=active?false:(!!blocked||!wrapper||!rc1015DraftReference());
 var help=panel.querySelectorAll('.rc897-avis-help'),last=help&&help.length?help[help.length-1]:null;
 if(last)last.textContent=blocked?RC1018_AVIS_BLOCK_MESSAGE:(active?'Lieferavis ist für diese Sendung standardmäßig aktiv. Der Link wird beim ersten sicheren Speichern erstellt. Bei Bedarf können Sie den Lieferavis deaktivieren.':'Lieferavis ist für diese Sendung deaktiviert.');
 return true
}
function mailModeLabel(type,sh,lang){
 var active=false,blocked=type==='customer'&&rc1018AvisException(sh||currentShipmentForAvis());
 try{active=!blocked&&(type==='customer'||type==='carrier')&&!!(wrapper&&wrapper.enabled(sh||currentShipmentForAvis()))}catch(_){}
 if(!blocked&&!active&&(type==='customer'||type==='carrier')){var panel=document.getElementById('rc897LieferavisPanel');active=!!(panel&&panel.getAttribute('data-active')==='1')}
 if(active)return lang==='en'?'Collection notice':'Lieferavis';
 return type==='customer'?'Kundenmail':type==='carrier'?'Speditionsmail':type==='own'?'Eigene Info-Mail':'Mail'
}
function patchMailMode(){
 var area=document.getElementById('rc543MailArea');if(!area)return false;
 var active=area.querySelector('[data-rc543-target].active'),type=q(active&&active.getAttribute('data-rc543-target'))||'customer',lang=q((document.getElementById('rc543MailLang')||{}).value).toLowerCase()==='en'?'en':'de',standard=document.getElementById('rc543MailStandard');
 if(standard){var label=mailModeLabel(type,null,lang)+' · '+(lang==='en'?'Englisch':'Deutsch');if(standard.value!==label)standard.value=label;standard.setAttribute('data-rc1015-mail-mode',(type==='customer'||type==='carrier')&&/lieferavis|collection notice/i.test(label)?'lieferavis':'sendungsdetails')}
 return true
}
function refreshUi(){requestAnimationFrame(function(){rc1015UpdateLieferavisButton();patchMailMode()})}
function install(){
 var current=window.ExportHUBCustomerAvis706||window.ExportHUBCustomerAvis705;
 if(!current)return false;
 if(current.__rc1015===true){wrapper=current;base=current.__base||base;refreshUi();return true}
 if(current.__rc1018===true&&current.__base1018)current=current.__base1018;
 base=current;
 wrapper=Object.freeze(Object.assign({},base,{version:'RC1024',enabled:rc1018Enabled,toggle:rc1015Toggle,autoEnable:rc1021AutoEnable,injectMailBody:rc1015InjectMailBody,avisException:rc1018AvisException,__rc1015:true,__rc1018:true,__base:base,__base1018:base}));
 window.ExportHUBCustomerAvis706=wrapper;
 window.ExportHUBCustomerAvis705=wrapper;
 refreshUi();
 return true
}
function boot(){if(!install())setTimeout(install,80);refreshUi()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
var RC1021_AUTO_EVENTS=Object.freeze({'exporthub:ready':1,'exporthub:rendered':1,'exporthub:viewchange':1,'exporthub:sync':1,'exporthub:shipment-saved':1});
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync','exporthub:shipment-saved','exporthub:customer-avis-updated','exporthub:mail-language-changed'].forEach(function(name){window.addEventListener(name,function(){install();refreshUi();if(name==='exporthub:customer-avis-updated'||name==='exporthub:mail-language-changed')rc1024ScheduleVisibleMail();if(RC1021_AUTO_EVENTS[name])return Promise.resolve(rc1021AutoEnable(name)).catch(function(e){console.error('RC1021 Lieferavis Auto-Event',name,e);return false});return false})});
document.addEventListener('input',function(e){var input=e.target;if(input&&input.matches&&input.matches('#content input'))refreshUi()},true);
document.addEventListener('change',function(){refreshUi()},true);
window.ExportHUBRC1024Lieferavis=Object.freeze({version:'RC1024',composeAvis:function(opt){opt=opt||{};return rc1015AvisMailVariant(String(opt.body==null?'':opt.body),q(opt.url),q(opt.reference),q(opt.lang).toLowerCase()==='en'?'en':'de',q(opt.target).toLowerCase()||'customer')},syncVisibleMail:rc1024SyncVisibleMail});
})();