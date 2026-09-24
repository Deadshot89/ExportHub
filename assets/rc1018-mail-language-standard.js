(function(){
'use strict';
if(window.__EXPORTHUB_RC1018_MAIL_LANGUAGE_STANDARD__)return;
window.__EXPORTHUB_RC1018_MAIL_LANGUAGE_STANDARD__=true;

var VERSION='RC1018',base=null,wrapper=null,originalText=new WeakMap(),observer=null;
function q(v){return String(v==null?'':v).trim()}
function normalizedLanguage(v){
 v=q(v).toLowerCase().replace('_','-');
 if(/^de(?:-|$)/.test(v)||v==='german'||v==='deutsch')return'de';
 if(/^en(?:-|$)/.test(v)||v==='english'||v==='englisch')return'en';
 if(/^pl(?:-|$)/.test(v)||v==='polski'||v==='polish'||v==='polnisch')return'pl';
 if(/^es(?:-|$)/.test(v)||v==='español'||v==='espanol'||v==='spanish'||v==='spanisch')return'es';
 if(/^fr(?:-|$)/.test(v)||v==='français'||v==='francais'||v==='french'||v==='französisch'||v==='franzoesisch')return'fr';
 if(/^it(?:-|$)/.test(v)||v==='italiano'||v==='italian'||v==='italienisch')return'it';
 return''
}
var LANG_META=Object.freeze({
 de:{name:'Deutsch',greeting:'Sehr geehrte Damen und Herren,',closing:'Mit freundlichen Grüßen',details:'SENDUNGSDETAILS',detailsPickup:'SENDUNGSDETAILS – ABHOLUNG',detailsIntro:'Nachfolgend erhalten Sie die aktuellen Sendungsdetails.',detailsPickupIntro:'Für die geplante Abholung gelten die folgenden Sendungsdaten.',avis:'LIEFERAVIS',avisPickup:'LIEFERAVIS – ABHOLUNG',avisIntro:'Für diese Sendung steht Ihnen ein Lieferavis zur Verfügung.',avisPickupIntro:'Für diese Abholung steht ein Lieferavis zur Verfügung.',access:'Lieferavis',reference:'Referenz',validity:'Der Link kann erneut geöffnet werden und wird 14 Tage nach der tatsächlichen Abholung automatisch deaktiviert.',questions:'Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.',request:'Bitte öffnen Sie den folgenden Link, um die freigegebenen Sendungsinformationen und Dokumente einzusehen. Die vorgesehenen Abholdaten können ebenfalls direkt im Lieferavis erfasst werden.',requestPickup:'Bitte öffnen Sie den folgenden Link und tragen Sie dort den geplanten Abholtermin, das Zeitfenster sowie – sofern bereits bekannt – das Kennzeichen des Abholfahrzeugs ein. Die freigegebenen Sendungsinformationen und Dokumente können direkt im Lieferavis eingesehen werden.',followup:'Bitte verwenden Sie für die Abholdaten den Lieferavis. Die Informationen werden deshalb in dieser E-Mail nicht zusätzlich wiederholt.',followupPickup:'Bitte übermitteln Sie die Abholdaten über den Lieferavis. Eine zusätzliche Bestätigung per E-Mail ist nicht erforderlich.'},
 en:{name:'English',greeting:'Dear Sir or Madam,',closing:'Kind regards',details:'SHIPMENT DETAILS',detailsPickup:'SHIPMENT DETAILS – PICKUP',detailsIntro:'Please find the current shipment details below.',detailsPickupIntro:'Please use the following shipment information for the planned pickup.',avis:'COLLECTION NOTICE',avisPickup:'COLLECTION NOTICE – PICKUP',avisIntro:'A collection notice is available for this shipment.',avisPickupIntro:'A collection notice is available for this pickup.',access:'Collection notice',reference:'Reference',validity:'The link can be opened again and is automatically deactivated 14 days after the actual pickup.',questions:'Please contact us if you have any questions.',request:'Please open the link below to view the released shipment information and documents. The planned pickup information can also be entered directly in the collection notice.',requestPickup:'Please open the link below and enter the planned pickup date, time window and, if already known, the vehicle licence plate. The released shipment information and documents are available directly in the collection notice.',followup:'Please use the collection notice for the pickup information. The information is therefore not repeated in this email.',followupPickup:'Please submit the pickup information through the collection notice. A separate confirmation by email is not required.'},
 pl:{name:'Polski',greeting:'Szanowni Państwo,',closing:'Z poważaniem',details:'SZCZEGÓŁY WYSYŁKI',detailsPickup:'SZCZEGÓŁY WYSYŁKI – ODBIÓR',detailsIntro:'Poniżej znajdują się aktualne szczegóły wysyłki.',detailsPickupIntro:'Poniższe dane wysyłki dotyczą planowanego odbioru.',avis:'AWIZO WYSYŁKI',avisPickup:'AWIZO ODBIORU – ODBIÓR',avisIntro:'Dla tej przesyłki dostępne jest cyfrowe awizo.',avisPickupIntro:'Dla tego odbioru dostępne jest cyfrowe awizo.',access:'Awizo',reference:'Referencja',validity:'Link można otworzyć ponownie i zostanie automatycznie wyłączony 14 dni po rzeczywistym odbiorze.',questions:'W razie pytań prosimy o kontakt.',request:'Prosimy otworzyć poniższy link, aby przejrzeć udostępnione informacje i dokumenty wysyłkowe. Planowane dane odbioru można również wprowadzić bezpośrednio w awizo.',requestPickup:'Prosimy otworzyć poniższy link i podać planowaną datę odbioru, przedział czasowy oraz – jeśli jest już znany – numer rejestracyjny pojazdu. Udostępnione informacje i dokumenty wysyłkowe są dostępne bezpośrednio w awizo.',followup:'Prosimy przekazywać dane odbioru za pośrednictwem awizo. Informacje te nie są więc powtarzane w tej wiadomości.',followupPickup:'Prosimy przekazać dane odbioru przez awizo. Dodatkowe potwierdzenie e-mailem nie jest wymagane.'},
 es:{name:'Español',greeting:'Estimados señores:',closing:'Atentamente',details:'DETALLES DEL ENVÍO',detailsPickup:'DETALLES DEL ENVÍO – RECOGIDA',detailsIntro:'A continuación encontrará los datos actuales del envío.',detailsPickupIntro:'Para la recogida prevista se aplican los siguientes datos del envío.',avis:'AVISO DE ENVÍO',avisPickup:'AVISO DE RECOGIDA – RECOGIDA',avisIntro:'Hay disponible un aviso digital para este envío.',avisPickupIntro:'Hay disponible un aviso digital para esta recogida.',access:'Aviso',reference:'Referencia',validity:'El enlace puede volver a abrirse y se desactivará automáticamente 14 días después de la recogida real.',questions:'Póngase en contacto con nosotros si tiene alguna pregunta.',request:'Abra el siguiente enlace para consultar la información y los documentos de envío autorizados. Los datos de la recogida prevista también pueden introducirse directamente en el aviso.',requestPickup:'Abra el siguiente enlace e introduzca la fecha prevista de recogida, la franja horaria y, si ya se conoce, la matrícula del vehículo. La información y los documentos de envío autorizados están disponibles directamente en el aviso.',followup:'Utilice el aviso para comunicar los datos de recogida. Por ello, esta información no se repite en el correo.',followupPickup:'Envíe los datos de recogida a través del aviso. No es necesaria una confirmación adicional por correo electrónico.'},
 fr:{name:'Français',greeting:'Madame, Monsieur,',closing:'Cordialement',details:'DÉTAILS DE L’EXPÉDITION',detailsPickup:'DÉTAILS DE L’EXPÉDITION – ENLÈVEMENT',detailsIntro:'Vous trouverez ci-dessous les détails actuels de l’expédition.',detailsPickupIntro:'Les informations d’expédition suivantes s’appliquent à l’enlèvement prévu.',avis:'AVIS D’EXPÉDITION',avisPickup:'AVIS D’ENLÈVEMENT – ENLÈVEMENT',avisIntro:'Un avis numérique est disponible pour cette expédition.',avisPickupIntro:'Un avis numérique est disponible pour cet enlèvement.',access:'Avis',reference:'Référence',validity:'Le lien peut être rouvert et sera automatiquement désactivé 14 jours après l’enlèvement effectif.',questions:'N’hésitez pas à nous contacter si vous avez des questions.',request:'Veuillez ouvrir le lien ci-dessous pour consulter les informations et documents d’expédition validés. Les informations d’enlèvement prévues peuvent également être saisies directement dans l’avis.',requestPickup:'Veuillez ouvrir le lien ci-dessous et saisir la date d’enlèvement prévue, le créneau horaire et, si elle est déjà connue, l’immatriculation du véhicule. Les informations et documents d’expédition validés sont disponibles directement dans l’avis.',followup:'Veuillez utiliser l’avis pour les informations d’enlèvement. Elles ne sont donc pas répétées dans cet e-mail.',followupPickup:'Veuillez transmettre les informations d’enlèvement via l’avis. Aucune confirmation supplémentaire par e-mail n’est nécessaire.'},
 it:{name:'Italiano',greeting:'Gentili Signore e Signori,',closing:'Cordiali saluti',details:'DETTAGLI DELLA SPEDIZIONE',detailsPickup:'DETTAGLI DELLA SPEDIZIONE – RITIRO',detailsIntro:'Di seguito sono riportati i dettagli attuali della spedizione.',detailsPickupIntro:'Per il ritiro pianificato valgono i seguenti dati della spedizione.',avis:'AVVISO DI SPEDIZIONE',avisPickup:'AVVISO DI RITIRO – RITIRO',avisIntro:'È disponibile un avviso digitale per questa spedizione.',avisPickupIntro:'È disponibile un avviso digitale per questo ritiro.',access:'Avviso',reference:'Riferimento',validity:'Il link può essere riaperto e verrà disattivato automaticamente 14 giorni dopo il ritiro effettivo.',questions:'Contattateci in caso di domande.',request:'Aprite il seguente link per consultare le informazioni e i documenti di spedizione approvati. I dati del ritiro pianificato possono essere inseriti direttamente nell’avviso.',requestPickup:'Aprite il seguente link e inserite la data di ritiro pianificata, la fascia oraria e, se già nota, la targa del veicolo. Le informazioni e i documenti di spedizione approvati sono disponibili direttamente nell’avviso.',followup:'Utilizzate l’avviso per i dati di ritiro. Per questo motivo le informazioni non vengono ripetute nell’e-mail.',followupPickup:'Trasmettete i dati di ritiro tramite l’avviso. Non è necessaria un’ulteriore conferma via e-mail.'}
});
function profileLanguage(){try{var u=typeof window.__EXPORTHUB_GET_CURRENT_USER__==='function'?window.__EXPORTHUB_GET_CURRENT_USER__():window.ExportHUBClean&&window.ExportHUBClean.runtime&&window.ExportHUBClean.runtime.user;var fromUser=normalizedLanguage(u&&(u.language||u.uiLanguage||u.locale));if(fromUser)return fromUser}catch(_){}try{var nativeSelect=document.getElementById('languageSelect'),fromSelect=normalizedLanguage(nativeSelect&&nativeSelect.value);if(fromSelect)return fromSelect}catch(_){}return'de'}
function storedLanguage(){return profileLanguage()}
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
function closingMatch(text,lang){
 var all=/(?:Mit freundlichen Grüßen|Freundliche Grüße|Viele Grüße|Kind regards|Best regards|Yours sincerely|Yours faithfully|Z poważaniem|Pozdrawiam|Atentamente|Saludos cordiales|Cordialement|Bien cordialement|Cordiali saluti|Distinti saluti)[\s\S]*$/i;
 return String(text||'').match(all)
}
function mailEnvelope(text,lang){
 lang=normalizedLanguage(lang)||'de';text=normalizeText(text);var rest=text;
 var greetingRx=/^(?:Sehr geehrte\b[^\n]*|Guten Tag\b[^\n]*|Hallo\b[^\n]*|Dear\b[^\n]*|Hello\b[^\n]*|Good (?:morning|afternoon)\b[^\n]*|Szanowni\b[^\n]*|Dzień dobry\b[^\n]*|Estimad[^\n]*|Buenos días[^\n]*|Madame[^\n]*|Monsieur[^\n]*|Bonjour[^\n]*|Gentil[^\n]*|Buongiorno[^\n]*)\n(?:[ \t]*\n)?/i;
 var gm=rest.match(greetingRx);if(gm)rest=rest.slice(gm[0].length);
 var cm=closingMatch(rest,lang);if(cm)rest=rest.slice(0,cm.index);
 return{greeting:LANG_META[lang].greeting,closing:LANG_META[lang].closing,content:normalizeText(rest)}
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
function translateDetails(details,lang){
 lang=normalizedLanguage(lang)||'de';if(lang==='de')return details;
 var maps={
  en:{'Referenz':'Reference','Referenznummer':'Reference number','Lieferschein':'Delivery note','Gewicht':'Weight','Colli':'Packages','Warenbeschreibung':'Goods description','Empfänger':'Consignee','Abholdatum':'Pickup date','Zeitfenster':'Time window','Kennzeichen':'Vehicle plate'},
  pl:{'Referenz':'Referencja','Referenznummer':'Numer referencyjny','Lieferschein':'Dokument dostawy','Gewicht':'Waga','Colli':'Opakowania','Warenbeschreibung':'Opis towaru','Empfänger':'Odbiorca','Abholdatum':'Data odbioru','Zeitfenster':'Przedział czasowy','Kennzeichen':'Numer rejestracyjny'},
  es:{'Referenz':'Referencia','Referenznummer':'Número de referencia','Lieferschein':'Albarán','Gewicht':'Peso','Colli':'Bultos','Warenbeschreibung':'Descripción de mercancía','Empfänger':'Destinatario','Abholdatum':'Fecha de recogida','Zeitfenster':'Franja horaria','Kennzeichen':'Matrícula'},
  fr:{'Referenz':'Référence','Referenznummer':'Numéro de référence','Lieferschein':'Bon de livraison','Gewicht':'Poids','Colli':'Colis','Warenbeschreibung':'Description des marchandises','Empfänger':'Destinataire','Abholdatum':'Date d’enlèvement','Zeitfenster':'Créneau horaire','Kennzeichen':'Immatriculation'},
  it:{'Referenz':'Riferimento','Referenznummer':'Numero di riferimento','Lieferschein':'Documento di consegna','Gewicht':'Peso','Colli':'Colli','Warenbeschreibung':'Descrizione merce','Empfänger':'Destinatario','Abholdatum':'Data di ritiro','Zeitfenster':'Fascia oraria','Kennzeichen':'Targa'}
 };
 var map=maps[lang]||{};return String(details||'').split('\n').map(function(line){var i=line.indexOf(':');if(i<0)return line;var key=line.slice(0,i).trim(),next=map[key];return next?line.replace(key,next):line}).join('\n')
}
function buildDetailsBody(body,target,lang){
 lang=normalizedLanguage(lang)||'de';target=q(target).toLowerCase();var parts=mailEnvelope(stripAvisBlocks(body),lang),details=translateDetails(detailsContent(body,lang),lang),line='────────────────────────────',carrier=target==='carrier',meta=LANG_META[lang];
 return[parts.greeting,carrier?meta.detailsPickupIntro:meta.detailsIntro,line,carrier?meta.detailsPickup:meta.details,details,line,parts.closing].filter(Boolean).join('\n\n')
}
function localizedAvisUrl(url,lang){
 url=q(url);if(!url)return'';
 try{var u=new URL(url,typeof location!=='undefined'?location.href:'https://exporthub.invalid/');u.searchParams.set('lang',normalizedLanguage(lang)||'de');return u.toString()}catch(_){var join=url.indexOf('?')>=0?'&':'?';return url+join+'lang='+(normalizedLanguage(lang)||'de')}
}
function buildAvisBody(body,url,reference,target,lang){
 lang=normalizedLanguage(lang)||'de';target=q(target).toLowerCase();var parts=mailEnvelope(stripShipmentDetails(body),lang),carrier=target==='carrier',line='────────────────────────────',u=localizedAvisUrl(url,lang),meta=LANG_META[lang];
 return[parts.greeting,line,carrier?meta.avisPickup:meta.avis,carrier?meta.avisPickupIntro:meta.avisIntro,carrier?meta.requestPickup:meta.request,meta.access+':\n'+u,meta.reference+': '+q(reference),carrier?meta.followupPickup:meta.followup,meta.validity,meta.questions,line,parts.closing].filter(Boolean).join('\n\n')
}
function stripCompactAvisLink(text){
 text=normalizeText(text);
 text=text.replace(/(?:^|\n)(?:Lieferavis|Collection notice|Awizo|Aviso|Avis|Avviso):[ \t]*(?:\n[ \t]*)?https?:\/\/[^\s]+(?=\n|$)/gi,'');
 return normalizeText(text)
}
function buildOwnAvisBody(body,url,lang){
 lang=normalizedLanguage(lang)||'de';var clean=stripCompactAvisLink(body),details=buildDetailsBody(clean,'own',lang),parts=mailEnvelope(details,lang),u=localizedAvisUrl(url,lang),label=LANG_META[lang].access;
 return[parts.greeting,parts.content,label+': '+u,parts.closing].filter(Boolean).join('\n\n')
}
function composeMail(opt){
 opt=opt||{};var target=q(opt.target).toLowerCase()||'customer',lang=normalizedLanguage(opt.lang)||'de',mode=resolveMode(target,!!opt.avisEnabled);
 if(target==='own'&&opt.avisEnabled&&q(opt.url))return buildOwnAvisBody(opt.body,opt.url,lang);
 if(mode==='avis'&&q(opt.url))return buildAvisBody(opt.body,opt.url,opt.reference,target,lang);
 return buildDetailsBody(opt.body,target,lang)
}

var translations={
 'Dashboard':'Dashboard','Sendung erstellen':'Create shipment','Sendungsübersicht':'Shipment overview','Aufgaben':'Tasks','Abholkalender':'Pickup calendar','Kunden':'Customers','Kunde':'Customer','Standorte':'Locations','Standort':'Location','Palettenkonto':'Pallet account','SOP':'SOP','Academy':'Academy','Prüfung':'Assessment','Release Center':'Release Center','Fehlerdiagnose':'Diagnostics','Einstellungen':'Settings','Abmelden':'Sign out','Speichern':'Save','Speichern & Ausgabe':'Save & output','Drucken':'Print','Download':'Download','Zurück':'Back','Weiter':'Continue','Suche':'Search','Suchen':'Search','Spedition':'Carrier','Sendungsdetails':'Shipment details','Lieferavis':'Collection notice','Deutsch':'German','Englisch':'English','Referenz':'Reference','Referenznummer':'Reference number','Lieferschein':'Delivery note','Empfänger':'Consignee','Abholdatum':'Pickup date','Status':'Status','Dokumente':'Documents','Colli':'Packages','Gewicht':'Weight','Warenbeschreibung':'Goods description','Versandkosten':'Shipping costs','Abholung':'Pickup','Bereit zur Abholung':'Ready for pickup','Abgeholt':'Picked up','Abgeschlossen':'Completed','Archiviert':'Archived','Storniert':'Cancelled','Entwurf':'Draft','Heute':'Today','Überfällig':'Overdue','Geplant':'Planned','Mail an Kunde':'Email customer','Mail an Spedition':'Email carrier','Sprache':'Language','Aktivieren':'Enable','Deaktivieren':'Disable','Öffnen':'Open','Schließen':'Close','Bearbeiten':'Edit','Löschen':'Delete','Neu':'New','Name':'Name','Adresse':'Address','Land':'Country','E-Mail':'Email','Telefon':'Phone','Datum':'Date','Uhrzeit':'Time','Zeitfenster':'Time window','Kennzeichen':'Vehicle plate','Bemerkung':'Note','Hinweis':'Note','Warnung':'Warning','Erstellt':'Created','Versendet':'Sent','Bestätigt':'Confirmed'
};
var reverseTranslations={};Object.keys(translations).forEach(function(k){reverseTranslations[translations[k]]=k});
function translateTextNode(node,lang){
 if(window.ExportHUBI18n)return;
 if(!node||node.nodeType!==3)return;var raw=node.nodeValue,trim=q(raw);if(!trim)return;
 if(!originalText.has(node))originalText.set(node,raw);
 var original=originalText.get(node),originalTrim=q(original),next=lang==='en'?(translations[originalTrim]||originalTrim):(reverseTranslations[originalTrim]||originalTrim),lead=(original.match(/^\s*/)||[''])[0],trail=(original.match(/\s*$/)||[''])[0];
 if(next!==trim)node.nodeValue=lead+next+trail
}
function translateElement(root,lang){
 if(typeof document==='undefined'||!root)return;var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(node){var p=node.parentElement;if(!p||/^(SCRIPT|STYLE|TEXTAREA|OPTION)$/i.test(p.tagName)||p.closest('[data-rc1018-no-translate]'))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT}});var nodes=[],n;while((n=walker.nextNode()))nodes.push(n);nodes.forEach(function(node){translateTextNode(node,lang)});document.documentElement.lang=lang
}
function currentSiteLanguage(){return profileLanguage()}
function setSiteLanguage(lang){
 lang=normalizedLanguage(lang)||'de';
 if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.setLanguage==='function'){window.ExportHUBI18n.setLanguage(lang);return lang}
 if(typeof document!=='undefined'){
  var nativeSelect=document.getElementById('languageSelect'),current='';
  try{current=normalizedLanguage(window.__rc455I18nTest&&typeof window.__rc455I18nTest.language==='function'?window.__rc455I18nTest.language():(nativeSelect&&nativeSelect.value))}catch(_){current=normalizedLanguage(nativeSelect&&nativeSelect.value)}
  if(nativeSelect&&nativeSelect.value!==lang)nativeSelect.value=lang;
  if(current!==lang){try{if(typeof window.rc455SetLanguage==='function')window.rc455SetLanguage(lang);else if(typeof window.setLanguage==='function')window.setLanguage(lang);else document.documentElement.lang=lang}catch(_){document.documentElement.lang=lang}
   try{window.dispatchEvent(new CustomEvent('exporthub:site-language-changed',{detail:{language:lang}}))}catch(_){try{window.dispatchEvent(new Event('exporthub:site-language-changed'))}catch(__){}}
  }else document.documentElement.lang=lang
 }
 return lang
}
function ensureLanguageSwitch(){
 if(typeof document==='undefined')return false;
 var duplicate=document.getElementById('exporthub-site-language-wrap');if(duplicate)duplicate.remove();
 var stray=document.getElementById('rc1018-public-language');if(stray&&document.getElementById('app'))stray.remove();
 var nativeSelect=document.getElementById('languageSelect');
 if(nativeSelect){nativeSelect.setAttribute('data-rc1018-language-owner','native');var labels={de:'Deutsch',en:'English',pl:'Polski',es:'Español',fr:'Français',it:'Italiano'};Object.keys(labels).forEach(function(code){if(!nativeSelect.querySelector('option[value="'+code+'"]')){var o=document.createElement('option');o.value=code;o.textContent=labels[code];nativeSelect.appendChild(o)}});nativeSelect.setAttribute('title',LANG_META[profileLanguage()].name);return true}
 return false
}
function syncProfileSiteLanguage(){var lang=profileLanguage();ensureLanguageSwitch();setSiteLanguage(lang);return lang}
function observeTranslations(){
 if(typeof MutationObserver==='undefined'||typeof document==='undefined'||observer)return;observer=new MutationObserver(function(records){var lang=currentSiteLanguage();records.forEach(function(r){Array.from(r.addedNodes||[]).forEach(function(n){if(n.nodeType===1)translateElement(n,lang);else if(n.nodeType===3)translateTextNode(n,lang)})})});observer.observe(document.body,{childList:true,subtree:true})
}
function mailModeLabel(target,avis,lang){
 lang=normalizedLanguage(lang)||'de';var mode=resolveMode(target,avis),m={
  de:{customer:'Kunde',carrier:'Spedition',details:'Sendungsdetails',avis:'Lieferavis',mail:'Mail'},
  en:{customer:'Customer',carrier:'Carrier',details:'Shipment details',avis:'Collection notice',mail:'Email'},
  pl:{customer:'Klient',carrier:'Przewoźnik',details:'Szczegóły wysyłki',avis:'Awizo',mail:'E-mail'},
  es:{customer:'Cliente',carrier:'Transportista',details:'Detalles del envío',avis:'Aviso',mail:'Correo'},
  fr:{customer:'Client',carrier:'Transporteur',details:'Détails de l’expédition',avis:'Avis',mail:'E-mail'},
  it:{customer:'Cliente',carrier:'Vettore',details:'Dettagli della spedizione',avis:'Avviso',mail:'E-mail'}
 }[lang];if(target!=='customer'&&target!=='carrier')return m.mail;return m[target]+' · '+m[mode==='avis'?'avis':'details']
}
function patchMailUi(){
 if(typeof document==='undefined')return false;var area=document.getElementById('rc543MailArea');if(!area)return false;var active=area.querySelector('[data-rc543-target].active'),target=q(active&&active.getAttribute('data-rc543-target'))||'customer',lang=resolveLanguage({},'',(document.getElementById('rc543MailLang')||{}).value),standard=document.getElementById('rc543MailStandard'),avis=false;
 try{var sh=typeof window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__==='function'?window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__():null;avis=!!(wrapper&&sh&&wrapper.enabled&&wrapper.enabled(sh))}catch(_){}
 if(!avis&&target!=='own'){var panel=document.getElementById('rc897LieferavisPanel');avis=!!(panel&&panel.getAttribute('data-active')==='1')}
 if(standard){standard.value=mailModeLabel(target,avis,lang)+' · '+LANG_META[lang].name;standard.setAttribute('data-rc1018-mail-mode',resolveMode(target,avis))}
 return true
}
function rc1018InjectMailBody(sh,target,body,langOverride){
 target=q(target).toLowerCase()||'customer';var uiLang=typeof document!=='undefined'?q((document.getElementById('rc543MailLang')||{}).value):'',lang=resolveLanguage(sh,langOverride,uiLang),avis=false;
 try{avis=!!(base&&base.enabled&&base.enabled(sh))}catch(_){}
 var mode=resolveMode(target,avis),source=String(body==null?'':body),url=q(base&&base.link&&base.link(sh)),reference=referenceOf(sh);
 if(mode==='avis'&&url)return composeMail({target:target,lang:lang,body:source,avisEnabled:true,url:url,reference:reference});
 var clean=source;try{if(base&&typeof base.injectMailBody==='function')clean=base.injectMailBody(sh,target,source,lang)}catch(_){}
 return composeMail({target:target,lang:lang,body:clean,avisEnabled:target==='own'&&avis,url:url,reference:reference})
}
function installMailWrapper(){
 var current=window.ExportHUBCustomerAvis706||window.ExportHUBCustomerAvis705;if(!current)return false;
 if(current.__rc1018===true){wrapper=current;base=current.__base1018||base;patchMailUi();return true}
 base=current;wrapper=Object.freeze(Object.assign({},current,{version:VERSION,injectMailBody:rc1018InjectMailBody,__rc1018:true,__base1018:current}));window.ExportHUBCustomerAvis706=wrapper;window.ExportHUBCustomerAvis705=wrapper;patchMailUi();return true
}
function refresh(){if(typeof requestAnimationFrame==='function')requestAnimationFrame(function(){ensureLanguageSwitch();syncProfileSiteLanguage();installMailWrapper();patchMailUi()});else{ensureLanguageSwitch();syncProfileSiteLanguage();installMailWrapper();patchMailUi()}}
function boot(){ensureLanguageSwitch();syncProfileSiteLanguage();installMailWrapper();refresh()}

window.ExportHUBRC1018MailLanguage=Object.freeze({version:'RC1112',resolveLanguage:resolveLanguage,resolveMode:resolveMode,stripAvisBlocks:stripAvisBlocks,stripShipmentDetails:stripShipmentDetails,stripCompactAvisLink:stripCompactAvisLink,buildDetailsBody:buildDetailsBody,buildAvisBody:buildAvisBody,buildOwnAvisBody:buildOwnAvisBody,localizedAvisUrl:localizedAvisUrl,composeMail:composeMail,setSiteLanguage:setSiteLanguage,profileLanguage:profileLanguage,translations:translations});
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync','exporthub:shipment-saved','exporthub:customer-avis-updated','exporthub:mail-language-changed'].forEach(function(name){window.addEventListener(name,refresh)});
 document.addEventListener('change',function(e){if(e.target&&e.target.id==='rc543MailLang'){patchMailUi();return}refresh()},true)
}
})();
