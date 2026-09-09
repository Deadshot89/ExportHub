(function(){
'use strict';
if(window.__EXPORTHUB_RC1018_MAIL_LANGUAGE_STANDARD__)return;
window.__EXPORTHUB_RC1018_MAIL_LANGUAGE_STANDARD__=true;

var VERSION='RC1018',base=null,wrapper=null,originalText=new WeakMap(),observer=null;
function q(v){return String(v==null?'':v).trim()}
function normalizedLanguage(v){v=q(v).toLowerCase();if(/^en(?:[-_]|$)/.test(v)||v==='english'||v==='englisch')return'en';if(/^de(?:[-_]|$)/.test(v)||v==='german'||v==='deutsch')return'de';return''}
function storedLanguage(){try{return normalizedLanguage(localStorage.getItem('exporthub.language'))}catch(_){return''}}
function resolveLanguage(sh,override,uiValue){
 var values=[override,uiValue,sh&&(sh.rc1018MailLang||sh.rc543MailLang||sh.rc542MailLang||sh.rc524MailLang||sh.mailLanguage||sh.customerLanguage||sh.language||sh.locale),storedLanguage()];
 for(var i=0;i<values.length;i++){var lang=normalizedLanguage(values[i]);if(lang)return lang}
 return'de'
}
function resolveMode(target,avisEnabled){target=q(target).toLowerCase();return avisEnabled&&(target==='customer'||target==='carrier')?'avis':'details'}
function referenceOf(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.id||sh.shipmentId))}
function normalizeText(text){return String(text==null?'':text).replace(/\r\n/g,'\n').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim()}
function stripAvisBlocks(text){
 text=normalizeText(text);
 text=text.replace(/\n*--- ExportHUB Kunden-Avis ---[\s\S]*?\n---(?=\n|$)/gi,'');
 text=text.replace(/\n*[─-]{20,}\n(?:LIEFERAVIS(?:\s*[–/-].*)?|COLLECTION NOTICE(?:\s*[–/-].*)?|CUSTOMER COLLECTION NOTICE(?:\s*[–/-].*)?|KUNDEN-AVIS(?:\s*[–/-].*)?)[\s\S]*?\n[─-]{20,}(?=\n|$)/gi,'');
 return normalizeText(text)
}
function closingMatch(text,lang){var rx=lang==='en'?/(?:Kind regards|Best regards|Yours sincerely|Yours faithfully)[\s\S]*$/i:/(?:Mit freundlichen Grüßen|Freundliche Grüße|Viele Grüße)[\s\S]*$/i;return String(text||'').match(rx)}
function mailEnvelope(text,lang){
 text=normalizeText(text);var greeting='',closing='',rest=text;
 var greetingRx=lang==='en'?/^(?:Dear\b[^\n]*|Hello\b[^\n]*|Good (?:morning|afternoon)\b[^\n]*)\n(?:[ \t]*\n)?/i:/^(?:Sehr geehrte\b[^\n]*|Guten Tag\b[^\n]*|Hallo\b[^\n]*)\n(?:[ \t]*\n)?/i;
 var gm=rest.match(greetingRx);if(gm){greeting=gm[0].trim();rest=rest.slice(gm[0].length)}
 var cm=closingMatch(rest,lang);if(cm){closing=cm[0].trim();rest=rest.slice(0,cm.index)}
 if(!greeting)greeting=lang==='en'?'Dear Sir or Madam,':'Sehr geehrte Damen und Herren,';
 if(!closing)closing=lang==='en'?'Kind regards':'Mit freundlichen Grüßen';
 return{greeting:greeting,closing:closing,content:normalizeText(rest)}
}
function stripShipmentDetails(text){
 text=stripAvisBlocks(text);var lang=/\b(?:Dear|Shipment details|Kind regards)\b/i.test(text)?'en':'de',parts=mailEnvelope(text,lang),content=parts.content;
 var rx=/(?:^|\n)(?:Details zur Sendung|Sendungsdetails|SHIPMENT DETAILS|Shipment details)(?:\s*[–:-][^\n]*)?:?\s*\n[\s\S]*$/i;
 content=normalizeText(content.replace(rx,''));
 return[parts.greeting,content,parts.closing].filter(Boolean).join('\n\n')
}
function detailsContent(text,lang){
 var clean=stripAvisBlocks(text),parts=mailEnvelope(clean,lang),content=parts.content;
 var rx=/(?:^|\n)(?:Details zur Sendung|Sendungsdetails|SHIPMENT DETAILS|Shipment details)(?:\s*[–:-][^\n]*)?:?\s*\n([\s\S]*)$/i,m=content.match(rx);
 if(m)content=m[1];
 content=content.replace(/^(?:Nachfolgend erhalten Sie[^\n]*|Bitte beachten Sie[^\n]*|Please find[^\n]*|Please note[^\n]*)\n*/i,'');
 return normalizeText(content)
}
function buildDetailsBody(body,target,lang){
 lang=normalizedLanguage(lang)||'de';target=q(target).toLowerCase();var parts=mailEnvelope(stripAvisBlocks(body),lang),details=detailsContent(body,lang),line='────────────────────────────';
 var carrier=target==='carrier',title,intro;
 if(lang==='en'){
  title=carrier?'SHIPMENT DETAILS – PICKUP':'SHIPMENT DETAILS';
  intro=carrier?'Please use the following shipment information for the planned pickup.':'Please find the current shipment details below.';
 }else{
  title=carrier?'SENDUNGSDETAILS – ABHOLUNG':'SENDUNGSDETAILS';
  intro=carrier?'Für die geplante Abholung gelten die folgenden Sendungsdaten.':'Nachfolgend erhalten Sie die aktuellen Sendungsdetails.';
 }
 return[parts.greeting,intro,line,title,details,line,parts.closing].filter(Boolean).join('\n\n')
}
function localizedAvisUrl(url,lang){
 url=q(url);if(!url)return'';
 try{var u=new URL(url,typeof location!=='undefined'?location.href:'https://exporthub.invalid/');u.searchParams.set('lang',normalizedLanguage(lang)||'de');return u.toString()}catch(_){var join=url.indexOf('?')>=0?'&':'?';return url+join+'lang='+(normalizedLanguage(lang)||'de')}
}
function buildAvisBody(body,url,reference,target,lang){
 lang=normalizedLanguage(lang)||'de';target=q(target).toLowerCase();var parts=mailEnvelope(stripShipmentDetails(body),lang),carrier=target==='carrier',line='────────────────────────────',u=localizedAvisUrl(url,lang),title,intro,request,followup;
 if(lang==='en'){
  title=carrier?'COLLECTION NOTICE – PICKUP':'COLLECTION NOTICE';
  intro=carrier?'A collection notice is available for this pickup.':'A collection notice is available for this shipment.';
  request=carrier?'Please open the link below and enter the planned pickup date, time window and, if already known, the vehicle licence plate. The released shipment information and documents are available directly in the collection notice.':'Please open the link below to view the released shipment information and documents. The planned pickup information can also be entered directly in the collection notice.';
  followup=carrier?'Please submit the pickup information through the collection notice. A separate confirmation by email is not required.':'Please use the collection notice for the pickup information. The information is therefore not repeated in this email.';
 }else{
  title=carrier?'LIEFERAVIS – ABHOLUNG':'LIEFERAVIS';
  intro=carrier?'Für diese Abholung steht ein Lieferavis zur Verfügung.':'Für diese Sendung steht Ihnen ein Lieferavis zur Verfügung.';
  request=carrier?'Bitte öffnen Sie den folgenden Link und tragen Sie dort den geplanten Abholtermin, das Zeitfenster sowie – sofern bereits bekannt – das Kennzeichen des Abholfahrzeugs ein. Die freigegebenen Sendungsinformationen und Dokumente können direkt im Lieferavis eingesehen werden.':'Bitte öffnen Sie den folgenden Link, um die freigegebenen Sendungsinformationen und Dokumente einzusehen. Die vorgesehenen Abholdaten können ebenfalls direkt im Lieferavis erfasst werden.';
  followup=carrier?'Bitte übermitteln Sie die Abholdaten über den Lieferavis. Eine zusätzliche Bestätigung per E-Mail ist nicht erforderlich.':'Bitte verwenden Sie für die Abholdaten den Lieferavis. Die Informationen werden deshalb in dieser E-Mail nicht zusätzlich wiederholt.';
 }
 var accessLabel=lang==='en'?'Collection notice':'Lieferavis',refLabel=lang==='en'?'Reference':'Referenz',validity=lang==='en'?'The link can be opened again and is automatically deactivated three business days after the actual pickup. Saturday and Sunday are not counted as business days.':'Der Link kann erneut geöffnet werden und wird drei Arbeitstage nach der tatsächlichen Abholung automatisch deaktiviert. Samstag und Sonntag zählen dabei nicht als Arbeitstage.',questions=lang==='en'?'Please contact us if you have any questions.':'Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.';
 return[parts.greeting,line,title,intro,request,accessLabel+':\n'+u,refLabel+': '+q(reference),followup,validity,questions,line,parts.closing].filter(Boolean).join('\n\n')
}
function composeMail(opt){
 opt=opt||{};var target=q(opt.target).toLowerCase()||'customer',lang=normalizedLanguage(opt.lang)||'de',mode=resolveMode(target,!!opt.avisEnabled);
 if(mode==='avis'&&q(opt.url))return buildAvisBody(opt.body,opt.url,opt.reference,target,lang);
 return buildDetailsBody(opt.body,target,lang)
}

var translations={
 'Dashboard':'Dashboard','Sendung erstellen':'Create shipment','Sendungsübersicht':'Shipment overview','Aufgaben':'Tasks','Abholkalender':'Pickup calendar','Kunden':'Customers','Kunde':'Customer','Standorte':'Locations','Standort':'Location','Palettenkonto':'Pallet account','SOP':'SOP','Academy':'Academy','Prüfung':'Assessment','Release Center':'Release Center','Fehlerdiagnose':'Diagnostics','Einstellungen':'Settings','Abmelden':'Sign out','Speichern':'Save','Speichern & Ausgabe':'Save & output','Drucken':'Print','Download':'Download','Zurück':'Back','Weiter':'Continue','Suche':'Search','Suchen':'Search','Spedition':'Carrier','Sendungsdetails':'Shipment details','Lieferavis':'Collection notice','Deutsch':'German','Englisch':'English','Referenz':'Reference','Referenznummer':'Reference number','Lieferschein':'Delivery note','Empfänger':'Consignee','Abholdatum':'Pickup date','Status':'Status','Dokumente':'Documents','Colli':'Packages','Gewicht':'Weight','Warenbeschreibung':'Goods description','Versandkosten':'Shipping costs','Abholung':'Pickup','Bereit zur Abholung':'Ready for pickup','Abgeholt':'Picked up','Abgeschlossen':'Completed','Archiviert':'Archived','Storniert':'Cancelled','Entwurf':'Draft','Heute':'Today','Überfällig':'Overdue','Geplant':'Planned','Mail an Kunde':'Email customer','Mail an Spedition':'Email carrier','Sprache':'Language','Aktivieren':'Enable','Deaktivieren':'Disable','Öffnen':'Open','Schließen':'Close','Bearbeiten':'Edit','Löschen':'Delete','Neu':'New','Name':'Name','Adresse':'Address','Land':'Country','E-Mail':'Email','Telefon':'Phone','Datum':'Date','Uhrzeit':'Time','Zeitfenster':'Time window','Kennzeichen':'Vehicle plate','Bemerkung':'Note','Hinweis':'Note','Warnung':'Warning','Erstellt':'Created','Versendet':'Sent','Bestätigt':'Confirmed'
};
var reverseTranslations={};Object.keys(translations).forEach(function(k){reverseTranslations[translations[k]]=k});
function translateTextNode(node,lang){
 if(!node||node.nodeType!==3)return;var raw=node.nodeValue,trim=q(raw);if(!trim)return;
 if(!originalText.has(node))originalText.set(node,raw);
 var original=originalText.get(node),originalTrim=q(original),next=lang==='en'?(translations[originalTrim]||originalTrim):(reverseTranslations[originalTrim]||originalTrim),lead=(original.match(/^\s*/)||[''])[0],trail=(original.match(/\s*$/)||[''])[0];
 if(next!==trim)node.nodeValue=lead+next+trail
}
function translateElement(root,lang){
 if(typeof document==='undefined'||!root)return;var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(node){var p=node.parentElement;if(!p||/^(SCRIPT|STYLE|TEXTAREA|OPTION)$/i.test(p.tagName)||p.closest('[data-rc1018-no-translate]'))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT}});var nodes=[],n;while((n=walker.nextNode()))nodes.push(n);nodes.forEach(function(node){translateTextNode(node,lang)});document.documentElement.lang=lang
}
function currentSiteLanguage(){var select=typeof document!=='undefined'&&document.getElementById('exporthub-site-language');return resolveLanguage({},'',select&&select.value)}
function setSiteLanguage(lang){
 lang=normalizedLanguage(lang)||'de';try{localStorage.setItem('exporthub.language',lang)}catch(_){}
 if(typeof document!=='undefined'){
  var select=document.getElementById('exporthub-site-language');if(select&&select.value!==lang)select.value=lang;
  translateElement(document.body,lang);
  try{window.dispatchEvent(new CustomEvent('exporthub:site-language-changed',{detail:{language:lang}}))}catch(_){try{window.dispatchEvent(new Event('exporthub:site-language-changed'))}catch(__){}}
 }
 return lang
}
function ensureLanguageSwitch(){
 if(typeof document==='undefined'||document.getElementById('exporthub-site-language-wrap'))return;
 var wrap=document.createElement('label');wrap.id='exporthub-site-language-wrap';wrap.setAttribute('data-rc1018-no-translate','1');wrap.style.cssText='display:inline-flex;align-items:center;gap:6px;font:600 12px/1.2 Segoe UI,Aptos,sans-serif;color:inherit;z-index:2147483000';
 var text=document.createElement('span');text.textContent='DE / EN';var select=document.createElement('select');select.id='exporthub-site-language';select.setAttribute('aria-label','Language / Sprache');select.style.cssText='min-height:32px;border:1px solid rgba(127,145,165,.45);border-radius:8px;padding:4px 8px;background:var(--surface,#fff);color:inherit;font:inherit';select.innerHTML='<option value="de">Deutsch</option><option value="en">English</option>';select.value=storedLanguage()||'de';select.addEventListener('change',function(){setSiteLanguage(select.value)});wrap.appendChild(text);wrap.appendChild(select);
 var host=document.querySelector('.topbar,.app-topbar,.header-actions,.top-actions,header')||document.body;if(host===document.body){wrap.style.position='fixed';wrap.style.right='12px';wrap.style.bottom='12px';wrap.style.padding='7px 9px';wrap.style.background='rgba(255,255,255,.94)';wrap.style.border='1px solid rgba(127,145,165,.35)';wrap.style.borderRadius='10px';wrap.style.boxShadow='0 6px 20px rgba(0,0,0,.12)'}host.appendChild(wrap);setSiteLanguage(select.value)
}
function observeTranslations(){
 if(typeof MutationObserver==='undefined'||typeof document==='undefined'||observer)return;observer=new MutationObserver(function(records){var lang=currentSiteLanguage();records.forEach(function(r){Array.from(r.addedNodes||[]).forEach(function(n){if(n.nodeType===1)translateElement(n,lang);else if(n.nodeType===3)translateTextNode(n,lang)})})});observer.observe(document.body,{childList:true,subtree:true})
}
function mailModeLabel(target,avis,lang){var mode=resolveMode(target,avis);if(lang==='en'){if(mode==='avis')return target==='carrier'?'Carrier collection notice':'Customer collection notice';return target==='carrier'?'Carrier shipment details':target==='customer'?'Customer shipment details':'Email'}if(mode==='avis')return target==='carrier'?'Spedition · Lieferavis':'Kunde · Lieferavis';return target==='carrier'?'Spedition · Sendungsdetails':target==='customer'?'Kunde · Sendungsdetails':'Mail'}
function patchMailUi(){
 if(typeof document==='undefined')return false;var area=document.getElementById('rc543MailArea');if(!area)return false;var active=area.querySelector('[data-rc543-target].active'),target=q(active&&active.getAttribute('data-rc543-target'))||'customer',lang=resolveLanguage({},'',(document.getElementById('rc543MailLang')||{}).value),standard=document.getElementById('rc543MailStandard'),avis=false;
 try{var sh=typeof window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__==='function'?window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__():null;avis=!!(wrapper&&sh&&wrapper.enabled&&wrapper.enabled(sh))}catch(_){}
 if(!avis&&target!=='own'){var panel=document.getElementById('rc897LieferavisPanel');avis=!!(panel&&panel.getAttribute('data-active')==='1')}
 if(standard){standard.value=mailModeLabel(target,avis,lang)+' · '+(lang==='en'?'English':'Deutsch');standard.setAttribute('data-rc1018-mail-mode',resolveMode(target,avis))}
 return true
}
function rc1018InjectMailBody(sh,target,body,langOverride){
 target=q(target).toLowerCase()||'customer';var uiLang=typeof document!=='undefined'?q((document.getElementById('rc543MailLang')||{}).value):'',lang=resolveLanguage(sh,langOverride,uiLang),avis=false;
 try{avis=!!(base&&base.enabled&&base.enabled(sh))}catch(_){}
 var mode=resolveMode(target,avis),source=String(body==null?'':body),url=q(base&&base.link&&base.link(sh)),reference=referenceOf(sh);
 if(mode==='avis'&&url)return composeMail({target:target,lang:lang,body:source,avisEnabled:true,url:url,reference:reference});
 var clean=source;try{if(base&&typeof base.injectMailBody==='function')clean=base.injectMailBody(sh,target,source,lang)}catch(_){}
 return composeMail({target:target,lang:lang,body:clean,avisEnabled:false,url:url,reference:reference})
}
function installMailWrapper(){
 var current=window.ExportHUBCustomerAvis706||window.ExportHUBCustomerAvis705;if(!current)return false;
 if(current.__rc1018===true){wrapper=current;base=current.__base1018||base;patchMailUi();return true}
 base=current;wrapper=Object.freeze(Object.assign({},current,{version:VERSION,injectMailBody:rc1018InjectMailBody,__rc1018:true,__base1018:current}));window.ExportHUBCustomerAvis706=wrapper;window.ExportHUBCustomerAvis705=wrapper;patchMailUi();return true
}
function refresh(){if(typeof requestAnimationFrame==='function')requestAnimationFrame(function(){installMailWrapper();patchMailUi()});else{installMailWrapper();patchMailUi()}}
function boot(){ensureLanguageSwitch();observeTranslations();installMailWrapper();refresh()}

window.ExportHUBRC1018MailLanguage=Object.freeze({version:VERSION,resolveLanguage:resolveLanguage,resolveMode:resolveMode,stripAvisBlocks:stripAvisBlocks,stripShipmentDetails:stripShipmentDetails,buildDetailsBody:buildDetailsBody,buildAvisBody:buildAvisBody,localizedAvisUrl:localizedAvisUrl,composeMail:composeMail,setSiteLanguage:setSiteLanguage,translations:translations});
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync','exporthub:shipment-saved','exporthub:customer-avis-updated','exporthub:mail-language-changed'].forEach(function(name){window.addEventListener(name,refresh)});
 document.addEventListener('change',function(e){if(e.target&&e.target.id==='rc543MailLang'){var lang=resolveLanguage({},e.target.value,'');setSiteLanguage(lang)}refresh()},true)
}
})();
