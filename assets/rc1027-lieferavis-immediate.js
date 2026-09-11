(function(){
'use strict';
if(window.__EXPORTHUB_RC1027_LIEFERAVIS_IMMEDIATE__)return;
window.__EXPORTHUB_RC1027_LIEFERAVIS_IMMEDIATE__=true;

var previous=null,wrapper=null,earlyPending=null,visibleSyncing=false,avisLinkCache=Object.create(null);
function q(v){return String(v==null?'':v).trim()}
function explicitReference(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.referenceNo)).toUpperCase()}
function state(){
 try{if(typeof window.__EXPORTHUB_GET_STATE__==='function')return window.__EXPORTHUB_GET_STATE__()||{}}catch(_){}
 return window.ExportHUBClean&&window.ExportHUBClean.state||window.appState||{}
}
function shipment(){
 try{if(typeof window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__==='function'){var x=window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__();if(x&&typeof x==='object')return x}}catch(_){}
 var s=state(),direct=[s.currentShipment,s.shipment,s.selectedShipment];
 for(var i=0;i<direct.length;i++)if(direct[i]&&typeof direct[i]==='object')return direct[i];
 var lists=[s.shipments,s.savedShipments,s.salesSharedShipments,s.sharedShipments],only=null,count=0;
 for(var l=0;l<lists.length;l++){var list=lists[l];if(!Array.isArray(list))continue;for(var j=0;j<list.length;j++){if(list[j]&&typeof list[j]==='object'){only=list[j];count++;if(count>1)return null}}}
 return count===1?only:null
}
function customerName(sh){
 sh=sh&&typeof sh==='object'?sh:{};
 var fields=[sh.customerName,sh.customerDisplay,sh.recipientCustomerName,sh.consigneeName,sh.recipientName,sh.companyName,sh.locationName];
 for(var i=0;i<fields.length;i++){var v=fields[i];if(v!=null&&typeof v!=='object'&&q(v))return q(v)}
 var nested=[sh.customer,sh.recipient];
 for(var n=0;n<nested.length;n++){var x=nested[n];if(x&&typeof x==='object'){var name=q(x.name||x.customerName||x.companyName||x.displayName||x.label);if(name)return name}else if(q(x))return q(x)}
 return''
}
function selectedLocation(sh){return q(sh&&(sh.selectedLocationId||sh.locationId||sh.siteId||sh.destinationId||sh.deliveryLocationId||sh.shipToLocationId||sh.recipientLocationId))}
function manualDisabled(sh){return !!q(sh&&(sh.customerAvisDisabledAt||sh.avisDisabledAt))}
function closed(sh){
 if(!sh||typeof sh!=='object')return true;
 if(q(sh.pickedUpAt||sh.pickupConfirmedAt||sh.actualPickupAt||sh.collectedAt))return true;
 return /^(?:abgeholt|pod vorhanden|abgeschlossen|archiviert|storniert|picked up|pod available|completed|archived|cancelled)$/i.test(q(sh.status||sh.shipmentStatus))
}
function exception(sh){try{return previous&&typeof previous.avisException==='function'?previous.avisException(sh):null}catch(_){return null}}
function environmentName(){return typeof location!=='undefined'&&/-testservice\./i.test(String(location.hostname||''))?'testservice':'production'}
function avisCacheKey(sh){var ref=explicitReference(sh);if(!ref)return'';return'exporthub:avis-url:'+environmentName()+':'+ref}
function cachedAvisUrl(sh){var key=avisCacheKey(sh);if(!key)return'';if(avisLinkCache[key])return avisLinkCache[key];try{if(typeof sessionStorage!=='undefined'){var stored=q(sessionStorage.getItem(key));if(stored){avisLinkCache[key]=stored;return stored}}}catch(_){}return''}
function rememberAvisUrl(sh,url){url=q(url);var key=avisCacheKey(sh);if(!key||!url)return url;if(!/customer-avis(?:\.html)?[?/#]/i.test(url))return url;avisLinkCache[key]=url;try{if(typeof sessionStorage!=='undefined')sessionStorage.setItem(key,url)}catch(_){}return url}
function forgetAvisUrl(sh){var key=avisCacheKey(sh);if(!key)return false;delete avisLinkCache[key];try{if(typeof sessionStorage!=='undefined')sessionStorage.removeItem(key)}catch(_){}return true}
function avisUrl(sh){if(manualDisabled(sh)){forgetAvisUrl(sh);return''}var live='';try{live=q(previous&&typeof previous.link==='function'&&previous.link(sh))}catch(_){}return live?rememberAvisUrl(sh,live):cachedAvisUrl(sh)}
function referenceInput(){
 if(typeof document==='undefined')return null;
 return Array.from(document.querySelectorAll('#content input')).find(function(input){
  var label=input.closest&&input.closest('label,.field');
  return /sendungsreferenz|referenznummer/i.test((input.id||'')+' '+(input.name||'')+' '+(label&&label.textContent||''));
 })||null
}
function referenceExists(ref,ignore){
 ref=q(ref).toUpperCase();if(!ref)return false;
 var s=state(),lists=[s.shipments,s.savedShipments,s.salesSharedShipments,s.sharedShipments];
 for(var i=0;i<lists.length;i++){var list=lists[i];if(!Array.isArray(list))continue;for(var j=0;j<list.length;j++){var x=list[j];if(x&&x!==ignore&&explicitReference(x)===ref)return true}}
 return false
}
function randomReference(){
 var chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',out='',bytes=null;
 try{if(typeof crypto!=='undefined'&&crypto&&typeof crypto.getRandomValues==='function'){bytes=new Uint8Array(6);crypto.getRandomValues(bytes)}}catch(_){}
 for(var i=0;i<6;i++){var n=bytes?bytes[i]:Math.floor(Math.random()*256);out+=chars.charAt(n%chars.length)}
 return out
}
function ensureReference(sh){
 var input=referenceInput(),visible=q(input&&input.value).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6),ref=/^[A-Z0-9]{6}$/.test(visible)?visible:explicitReference(sh).replace(/[^A-Z0-9]/g,'').slice(0,6);
 if(!/^[A-Z0-9]{6}$/.test(ref)){
  for(var i=0;i<20;i++){var candidate=randomReference();if(!referenceExists(candidate,sh)){ref=candidate;break}}
 }
 if(!/^[A-Z0-9]{6}$/.test(ref))return'';
 sh.reference=ref;sh.ref=ref;
 if(input&&input.value!==ref)input.value=ref;
 return ref
}
function shipmentId(sh){return q(sh&&(sh.id||sh.shipmentId||sh.uuid||sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber))||explicitReference(sh)}
function safeScalar(v,max){if(v==null||typeof v==='object'||typeof v==='boolean')return'';return q(v).replace(/[\r\n\t]+/g,' ').slice(0,max||500)}
function avisDraftSnapshot(sh){
 sh=sh&&typeof sh==='object'?sh:{};
 var out={id:shipmentId(sh),shipmentId:shipmentId(sh),ref:explicitReference(sh),reference:explicitReference(sh),customerName:customerName(sh),selectedLocationId:selectedLocation(sh)};
 var fields=['customerNumber','customerAccount','customerNo','customerReference','customerRef','orderReference','purchaseOrder','poNumber','salesOrder','salesOrderNumber','orderNumber','recipientName','destinationName','recipientAddress','deliveryAddress','destinationAddress','recipientCountry','country','locationId','siteId','destinationId','deliveryLocationId','shipToLocationId','recipientLocationId','senderName','senderAddress','shipDate','shippingDate','shipmentDate','dispatchDate','incoterm','incoterms','carrier','carrierName','spedition','goodsDescription','description','warenbeschreibung','status','shipmentStatus'];
 for(var i=0;i<fields.length;i++){var key=fields[i],value=safeScalar(sh[key],key==='recipientAddress'||key==='deliveryAddress'||key==='destinationAddress'||key==='senderAddress'?1000:300);if(value)out[key]=value}
 return out
}
function fastAvisHeaders(){
 var rt=window.ExportHUBClean&&window.ExportHUBClean.runtime||{},token=q(rt.authToken||'');
 if(!token)throw new Error('ExportHUB-Sitzung ist nicht mehr gültig.');
 return{'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':environmentName()}
}
function patchIssuedAvis(sh,data){
 var stamp=new Date().toISOString(),token=q(data&&data.token),expiresAt=q(data&&data.expiresAt),url=q(data&&data.url),values={customerAvisEnabled:true,avisEnabled:true,customerAvisSecurityVersion:1013,avisSecurityVersion:1013,customerAvisEnabledAt:stamp,avisEnabledAt:stamp,customerAvisDisabledAt:'',avisDisabledAt:'',customerAvisResponseStatus:'offen',avisResponseStatus:'offen'};
 if(token){values.customerAvisToken=token;values.avisToken=token}
 if(expiresAt){values.customerAvisExpiresAt=expiresAt;values.avisExpiresAt=expiresAt}
 Object.assign(sh,values);
 var ref=explicitReference(sh),s=state(),lists=[s.shipments,s.savedShipments,s.salesSharedShipments,s.sharedShipments];
 for(var i=0;i<lists.length;i++){var list=lists[i];if(!Array.isArray(list))continue;for(var j=0;j<list.length;j++){var item=list[j];if(item&&item!==sh&&explicitReference(item)===ref)Object.assign(item,values)}}
 if(url){try{url=new URL(url,typeof location!=='undefined'?location.href:'https://exporthub.invalid/').toString()}catch(_){}rememberAvisUrl(sh,url)}
 try{window.dispatchEvent(new CustomEvent('exporthub:customer-avis-updated',{detail:{enabled:true,reference:ref,version:'RC1033'}}))}catch(_){}
 return !!avisUrl(sh)
}
async function issueDraftAvis(sh){
 if(typeof fetch!=='function')return previous&&typeof previous.toggle==='function'?previous.toggle(true):false;
 var ref=explicitReference(sh),payload={action:'issue',shipmentId:shipmentId(sh)||ref,reference:ref,environment:environmentName(),shipmentSnapshot:avisDraftSnapshot(sh)};
 var r=await fetch('/api/customer-avis',{method:'POST',credentials:'same-origin',cache:'no-store',headers:fastAvisHeaders(),body:JSON.stringify(payload)}),data=await r.json().catch(function(){return{}});
 if(!r.ok)throw new Error(q(data&&data.message)||('HTTP '+r.status));
 return patchIssuedAvis(sh,data)
}
function eligible(sh){return !!(sh&&customerName(sh)&&selectedLocation(sh)&&!exception(sh)&&!manualDisabled(sh)&&!closed(sh))}
async function ensureCustomerAvis(reason){
 var sh=shipment();if(!sh)return false;
 if(avisUrl(sh))return true;
 if(!eligible(sh))return false;
 var ref=ensureReference(sh);if(!ref||!previous)return false;
 if(earlyPending)return earlyPending;
 earlyPending=(async function(){
  try{
   var current=shipment()||sh;
   if(!eligible(current))return false;
   if(avisUrl(current))return true;
   await issueDraftAvis(current);
   current=shipment()||current;
   var active=!!avisUrl(current);
   if(active){syncVisibleMail();try{window.dispatchEvent(new CustomEvent('exporthub:rc1027-avis-ready',{detail:{reference:explicitReference(current),version:'RC1033'}}))}catch(_){}}
   return active
  }catch(e){console.error('RC1033 Lieferavis Fast-Path',reason||'',e);return false}
  finally{earlyPending=null}
 })();
 return earlyPending
}
async function coordinatedToggle(on){
 var sh=shipment();if(!sh)return false;
 if(on){
  if(manualDisabled(sh))return previous&&typeof previous.toggle==='function'?previous.toggle(true):false;
  return ensureCustomerAvis('manual-toggle')
 }
 if(earlyPending){try{await earlyPending}catch(_){}}
 var current=shipment()||sh;
 if(!current)return false;
 if(previous&&typeof previous.toggle==='function'){
  var result=await previous.toggle(false);
  current=shipment()||current;
  if(manualDisabled(current))forgetAvisUrl(current);
  return result
 }
 return false
}
function localizedUrl(url,lang){
 url=q(url);if(!url)return'';
 try{var u=new URL(url,typeof location!=='undefined'?location.href:'https://exporthub.invalid/');u.searchParams.set('lang',lang==='en'?'en':'de');return u.toString()}catch(_){return url+(url.indexOf('?')>=0?'&':'?')+'lang='+(lang==='en'?'en':'de')}
}
function avisBlock(url,reference,lang,target){
 var en=lang==='en',carrier=target==='carrier',u=localizedUrl(url,lang),ref=q(reference);
 if(en&&carrier)return 'COLLECTION NOTICE – PICKUP\n\nA digital collection notice is available for the planned pickup of this shipment.\n\nPlease use the link below to submit the pickup details. The released shipment documents are also available there.\n\nCollection notice:\n'+u+'\nReference: '+ref+'\n\nRequired information:\n• Pickup date\n• Time window\n• Vehicle licence plate, if known\n\nNo additional confirmation of the pickup details by email is required.';
 if(en)return 'COLLECTION NOTICE\n\nA digital collection notice is available for this shipment.\n\nPlease use the link below to view the released shipment documents and submit the planned pickup details.\n\nCollection notice:\n'+u+'\nReference: '+ref+'\n\nPlease enter the pickup date and time window and, if known, the vehicle licence plate.\n\nNo additional confirmation by email is required.\n\nThank you.';
 if(carrier)return 'LIEFERAVIS – ABHOLUNG\n\nFür die geplante Abholung dieser Sendung steht ein digitales Lieferavis bereit.\n\nBitte erfassen Sie die Abholdaten über den folgenden Link. Die freigegebenen Sendungsunterlagen können dort ebenfalls eingesehen werden.\n\nLieferavis:\n'+u+'\nReferenz: '+ref+'\n\nErforderliche Angaben:\n• Abholdatum\n• Zeitfenster\n• Kennzeichen des Abholfahrzeugs, sofern bekannt\n\nEine zusätzliche Bestätigung der Abholdaten per E-Mail ist nicht erforderlich.';
 return 'LIEFERAVIS\n\nFür diese Sendung steht Ihnen unser digitales Lieferavis zur Verfügung.\n\nÜber den folgenden Link können Sie die freigegebenen Sendungsunterlagen einsehen und die Angaben zur geplanten Abholung übermitteln.\n\nLieferavis:\n'+u+'\nReferenz: '+ref+'\n\nBitte erfassen Sie Abholdatum und Zeitfenster. Sofern bekannt, ergänzen Sie bitte das Kennzeichen des Abholfahrzeugs.\n\nDie Angaben werden direkt der Sendung zugeordnet. Eine zusätzliche Rückmeldung per E-Mail ist nicht erforderlich.\n\nVielen Dank.'
}
function standaloneAvis(sh,target,lang,url){
 lang=lang==='en'?'en':'de';target=q(target).toLowerCase()==='carrier'?'carrier':'customer';
 var greeting=lang==='en'?'Dear Sir or Madam,':'Sehr geehrte Damen und Herren,',closing=lang==='en'?'Kind regards':'Mit freundlichen Grüßen';
 return greeting+'\n\n'+avisBlock(url,explicitReference(sh),lang,target)+'\n\n'+closing
}
function injectMailBody(sh,target,body,langOverride){
 var type=q(target).toLowerCase()||'customer',source=String(body==null?'':body),lang=q(langOverride).toLowerCase()==='en'?'en':'de';
 if(type==='own'||(type!=='customer'&&type!=='carrier'))return previous&&typeof previous.injectMailBody==='function'?previous.injectMailBody(sh,target,source,langOverride):source;
 if(exception(sh)||manualDisabled(sh))return previous&&typeof previous.injectMailBody==='function'?previous.injectMailBody(sh,target,source,langOverride):source;
 var url=avisUrl(sh);if(!url)return previous&&typeof previous.injectMailBody==='function'?previous.injectMailBody(sh,target,source,langOverride):source;
 return standaloneAvis(sh,type,lang,url)
}
function syncVisibleMail(){
 if(visibleSyncing||typeof document==='undefined')return false;
 var area=document.getElementById('rc543MailArea');if(!area||!area.querySelector)return false;
 var body=area.querySelector('textarea'),active=area.querySelector('[data-rc543-target].active'),type=q(active&&active.getAttribute('data-rc543-target'))||'customer';
 if(!body||type==='own'||(type!=='customer'&&type!=='carrier'))return false;
 var sh=shipment(),url=avisUrl(sh);if(!eligible(sh)||!url)return false;
 var lang=q((document.getElementById('rc543MailLang')||{}).value).toLowerCase()==='en'?'en':'de',next=standaloneAvis(sh,type,lang,url);
 if(String(body.value==null?'':body.value)===next)return false;
 visibleSyncing=true;try{body.value=next;try{body.dispatchEvent(new Event('input',{bubbles:true}))}catch(_){}try{body.dispatchEvent(new Event('change',{bubbles:true}))}catch(_){}}finally{visibleSyncing=false}
 return true
}
function isCustomerField(el){
 if(!el)return false;var label=el.closest&&el.closest('label,.field'),text=(el.id||'')+' '+(el.name||'')+' '+(el.getAttribute&&el.getAttribute('aria-label')||'')+' '+(label&&label.textContent||'');
 return /kunde|customer|empfänger|recipient|consignee/i.test(text)&&!/mail|email/i.test(text)
}
function isLocationField(el){
 if(!el)return false;var label=el.closest&&el.closest('label,.field'),text=(el.id||'')+' '+(el.name||'')+' '+(el.getAttribute&&el.getAttribute('aria-label')||'')+' '+(label&&label.textContent||'');
 return /standort|location|site|destination/i.test(text)&&!/mail|email/i.test(text)
}
function scheduleEnsure(reason){return Promise.resolve().then(function(){return ensureCustomerAvis(reason)}).then(function(active){if(active)syncVisibleMail();return active})}
function install(){
 var current=window.ExportHUBCustomerAvis706||window.ExportHUBCustomerAvis705;if(!current)return false;
 if(current.__rc1027===true){wrapper=current;return true}
 previous=current;
 wrapper=Object.freeze(Object.assign({},current,{version:'RC1033',link:avisUrl,toggle:coordinatedToggle,injectMailBody:injectMailBody,autoEnable:ensureCustomerAvis,__rc1027:true,__rc1031:true,__rc1032:true,__rc1033:true,__rc1052:true,__base1027:current}));
 window.ExportHUBCustomerAvis706=wrapper;window.ExportHUBCustomerAvis705=wrapper;
 return true
}
function boot(){if(!install()){setTimeout(boot,80);return}scheduleEnsure('boot')}
if(typeof document!=='undefined'){
 if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 document.addEventListener('change',function(e){if(isCustomerField(e&&e.target)||isLocationField(e&&e.target))return scheduleEnsure('customer-or-location-change')},true)
}
if(window&&typeof window.addEventListener==='function'){
 ['exporthub:rendered','exporthub:viewchange','exporthub:shipment-customer-changed','exporthub:customer-changed'].forEach(function(name){window.addEventListener(name,function(){install();return scheduleEnsure(name)})});
 window.addEventListener('exporthub:customer-avis-updated',function(){install();if(typeof requestAnimationFrame==='function')requestAnimationFrame(syncVisibleMail);else setTimeout(syncVisibleMail,0)})
}
var api=Object.freeze({version:'RC1033',ensureCustomerAvis:ensureCustomerAvis,issueDraftAvis:issueDraftAvis,toggle:coordinatedToggle,composeAvis:function(opt){opt=opt||{};return standaloneAvis(opt.shipment||shipment()||{reference:q(opt.reference)},q(opt.target).toLowerCase()||'customer',q(opt.lang).toLowerCase()==='en'?'en':'de',q(opt.url))},syncVisibleMail:syncVisibleMail});
window.ExportHUBRC1027Lieferavis=api;
})();
