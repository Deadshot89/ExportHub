/* ExportHUB360 – Kundenordner übersichtlich.
   Ergänzt den bestehenden Kundenordner um eine mitlaufende Abschnittsnavigation (mit offenem Kunden),
   eine durchgehende Abschnittsnummerierung, lesbare Abholdaten in der Sendungstabelle und einen Hinweis
   „Ungespeicherte Änderungen“ in der Speicherleiste. Rein darstellend: liest Felder nur, speichert nie selbst
   und verändert keine Kunden- oder Sendungsdaten. Reihenfolge und Layout kommen aus customer-folder-redesign.css. */
(function(w,d){
'use strict';
if(!w||!d||w.ExportHUBCustomerFolder)return;

var SECTIONS=[
 {key:'master',sel:'[data-rc565-area="master"]'},
 {key:'mail',sel:'[data-rc565-area="mail"]'},
 {key:'locations',sel:'[data-rc565-area="locations"]'},
 {key:'contacts',sel:'[data-rc565-area="contacts"]'},
 {key:'portals',sel:'[data-rc565-area="portals"]'},
 {key:'shipments',sel:'[data-rc565-area="shipments"]'},
 {key:'notes',sel:'[data-rc565-area="notes"]'},
 {key:'pallet',sel:'[data-rc565-area="pallet"]'},
 {key:'history',sel:'#rc1080CustomerHistory'}
];
var I18N={
 de:{nav:'Abschnitte im Kundenordner',master:'Kundendaten',mail:'Mail & Kontakte',locations:'Standorte',contacts:'Spedition',portals:'Portale',shipments:'Sendungen',notes:'Notizen',pallet:'Palettenkonto',history:'Historie',dirty:'● 1 ungespeicherte Änderung',dirtyN:'● {n} ungespeicherte Änderungen',noCustomer:'Kein Kunde geöffnet',leaveTitle:'Ungespeicherte Änderungen',leaveText:'Im Kundenordner von {name} gibt es ungespeicherte Änderungen. Was soll damit passieren?',save:'Speichern und weiter',discard:'Verwerfen',stay:'Hierbleiben',saving:'Speicherung läuft …',notConfirmed:'Die Änderungen sind in diesem Browser übernommen, aber noch nicht dauerhaft bestätigt:',proceed:'Trotzdem weiter',jump:'Zum Abschnitt springen',saveKey:'Strg+S'},
 en:{nav:'Customer folder sections',master:'Customer data',mail:'Mail & contacts',locations:'Locations',contacts:'Carrier',portals:'Portals',shipments:'Shipments',notes:'Notes',pallet:'Pallet account',history:'History',dirty:'● 1 unsaved change',dirtyN:'● {n} unsaved changes',noCustomer:'No customer open',leaveTitle:'Unsaved changes',leaveText:'The customer folder of {name} has unsaved changes. What should happen to them?',save:'Save and continue',discard:'Discard',stay:'Stay here',saving:'Saving …',notConfirmed:'The changes are applied in this browser but not yet confirmed as permanently saved:',proceed:'Continue anyway',jump:'Go to section',saveKey:'Ctrl+S'},
 pl:{nav:'Sekcje folderu klienta',master:'Dane klienta',mail:'Poczta i kontakty',locations:'Lokalizacje',contacts:'Spedycja',portals:'Portale',shipments:'Przesyłki',notes:'Notatki',pallet:'Konto palet',history:'Historia',dirty:'● 1 niezapisana zmiana',dirtyN:'● Niezapisane zmiany: {n}',noCustomer:'Brak otwartego klienta',leaveTitle:'Niezapisane zmiany',leaveText:'Folder klienta {name} zawiera niezapisane zmiany. Co z nimi zrobić?',save:'Zapisz i kontynuuj',discard:'Odrzuć',stay:'Zostań',saving:'Zapisywanie …',notConfirmed:'Zmiany zostały przejęte w tej przeglądarce, ale nie potwierdzono jeszcze trwałego zapisu:',proceed:'Mimo to kontynuuj',jump:'Przejdź do sekcji',saveKey:'Ctrl+S'},
 es:{nav:'Secciones de la carpeta de cliente',master:'Datos del cliente',mail:'Correo y contactos',locations:'Ubicaciones',contacts:'Transportista',portals:'Portales',shipments:'Envíos',notes:'Notas',pallet:'Cuenta de palés',history:'Historial',dirty:'● 1 cambio sin guardar',dirtyN:'● {n} cambios sin guardar',noCustomer:'Ningún cliente abierto',leaveTitle:'Cambios sin guardar',leaveText:'La carpeta de cliente de {name} tiene cambios sin guardar. ¿Qué hacemos con ellos?',save:'Guardar y continuar',discard:'Descartar',stay:'Quedarse',saving:'Guardando …',notConfirmed:'Los cambios se han aplicado en este navegador, pero aún no se ha confirmado el guardado permanente:',proceed:'Continuar de todos modos',jump:'Ir a la sección',saveKey:'Ctrl+S'},
 fr:{nav:'Sections du dossier client',master:'Données client',mail:'Mail et contacts',locations:'Sites',contacts:'Transporteur',portals:'Portails',shipments:'Envois',notes:'Notes',pallet:'Compte palettes',history:'Historique',dirty:'● 1 modification non enregistrée',dirtyN:'● {n} modifications non enregistrées',noCustomer:'Aucun client ouvert',leaveTitle:'Modifications non enregistrées',leaveText:'Le dossier client de {name} contient des modifications non enregistrées. Que faut-il en faire ?',save:'Enregistrer et continuer',discard:'Abandonner',stay:'Rester ici',saving:'Enregistrement …',notConfirmed:'Les modifications sont appliquées dans ce navigateur, mais l’enregistrement durable n’est pas encore confirmé :',proceed:'Continuer quand même',jump:'Aller à la section',saveKey:'Ctrl+S'},
 it:{nav:'Sezioni della cartella cliente',master:'Dati cliente',mail:'Mail e contatti',locations:'Sedi',contacts:'Spedizioniere',portals:'Portali',shipments:'Spedizioni',notes:'Note',pallet:'Conto pallet',history:'Cronologia',dirty:'● 1 modifica non salvata',dirtyN:'● {n} modifiche non salvate',noCustomer:'Nessun cliente aperto',leaveTitle:'Modifiche non salvate',leaveText:'La cartella cliente di {name} contiene modifiche non salvate. Cosa farne?',save:'Salva e continua',discard:'Scarta',stay:'Resta qui',saving:'Salvataggio …',notConfirmed:'Le modifiche sono applicate in questo browser, ma il salvataggio permanente non è ancora confermato:',proceed:'Continua comunque',jump:'Vai alla sezione',saveKey:'Ctrl+S'}
};
// Felder, die nicht über „Kundenordner speichern“ laufen (Suche, Neuanlage, Löschdialog, Kontakt-Auswahlmenüs)
var NOT_SAVED='#rc405FolderSearch,.rc405-new-customer *,#rc1126CustomerDelete *,.rc1092-contact-card select,#cfNav *';
var ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

var clicked='',dirty=false,dirtyBar=null,raf=0,observer=null,statusObserver=null,observedStatus=null,lastCustomer='';
// Ausgangswert je Feld, gemerkt beim ersten Fokus (dann sind auch nachträglich von älteren Modulen gefüllte Felder erfasst)
var initial=new Map(),changedCount=0,bypass=false,guardOpen=false;
// Bedienelemente, die den offenen Kundenordner ersetzen oder verlassen
var LEAVE_CODE=/rc405SelectFolder|rc405OpenShipment|rc405OpenCustomer|rc405CreateCustomer|\.route\(|rc410SelectCustomer/;

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function lang(){var l='';try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function')l=q(w.ExportHUBI18n.language()).toLowerCase()}catch(_){}if(!I18N[l]){var sel=d.getElementById('languageSelect');l=q(sel&&sel.value).toLowerCase()}return I18N[l]?l:'de'}
function t(key){var p=I18N[lang()]||I18N.de;return p[key]!=null?p[key]:I18N.de[key]}
function content(){var c=d.getElementById('content');return c&&c.getAttribute('data-view')==='customerfolder'?c:null}
function setText(el,v){if(el&&el.textContent!==v)el.textContent=v}
function setAttr(el,k,v){if(el&&el.getAttribute(k)!==v)el.setAttribute(k,v)}
function val(id){var el=d.getElementById(id);return q(el&&el.value)}

function present(c){
  var out=[];
  SECTIONS.forEach(function(s){var el=c.querySelector(s.sel);if(el)out.push({key:s.key,el:el})});
  return out
}
function heading(el){return el.querySelector(':scope>h3')||el.querySelector('.rc565-section-head h3,.rc1080-customer-history-head h3,h3')}

function customerKey(c){
  var el=c.querySelector('[data-rc819-customer-key],[data-rc565-customer-key],#rc1126CustomerDelete[data-customer-key]');
  return q(el&&(el.getAttribute('data-rc819-customer-key')||el.getAttribute('data-rc565-customer-key')||el.getAttribute('data-customer-key')))||val('rc405FAcc')
}

function ensureNav(c,sections){
  var nav=d.getElementById('cfNav');
  if(nav&&!c.contains(nav)){nav.remove();nav=null}
  if(!nav){
    nav=d.createElement('nav');nav.id='cfNav';
    nav.innerHTML='<div class="cf-identity"><strong></strong><small></small></div><div class="cf-links"></div>';
    nav.addEventListener('click',onNavClick);
    c.appendChild(nav)
  }
  setAttr(nav,'aria-label',t('nav'));
  var name=val('rc405FName'),acc=val('rc405FAcc'),country=val('rc405FCountry');
  setText(nav.querySelector('.cf-identity strong'),name||t('noCustomer'));
  setText(nav.querySelector('.cf-identity small'),[acc,country].filter(Boolean).join(' · '));
  var links=nav.querySelector('.cf-links'),sig=sections.map(function(s){return s.key}).join(',')+'|'+lang();
  if(links.getAttribute('data-sig')!==sig){
    links.setAttribute('data-sig',sig);
    links.innerHTML=sections.map(function(s,i){return '<button type="button" class="cf-link" data-cf-target="'+s.key+'"><i>'+(i+1)+'</i>'+t(s.key)+'</button>'}).join('')
  }
  return nav
}

// Der Überschriftentext bleibt unangetastet, weil ältere Module Abschnitte über diesen Text finden
// (z. B. RC565 /anmeldung/+/mail/, Dubletten-Bereinigung über „2.“). Angezeigt werden Nummer und Titel per CSS aus Attributen.
function numberHeadings(sections){
  sections.forEach(function(s,i){
    var h=heading(s.el);if(!h)return;
    setAttr(h,'data-cf-num',String(i+1));
    setAttr(h,'data-cf-title',q(h.textContent).replace(/^\d+\.\s+/,''));
    setAttr(s.el,'data-cf-section',s.key)
  })
}

function formatDates(c){
  Array.prototype.forEach.call(c.querySelectorAll('.rc405-doc-date'),function(el){
    var raw=q(el.textContent);if(!ISO.test(raw))return;
    var dt=new Date(raw);if(isNaN(dt.getTime()))return;
    var dateOnly=/T00:00(:00(\.0+)?)?(Z)?$/.test(raw);
    var text=dt.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})+(dateOnly?'':', '+dt.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}));
    el.title=raw;el.textContent=text
  })
}

function stickyTop(){
  var top=d.querySelector('.topbar'),v=12;
  if(top){var cs=w.getComputedStyle(top);if(cs.position==='sticky'||cs.position==='fixed'){var r=top.getBoundingClientRect();if(r.height&&r.bottom>0)v=Math.round(r.height+(parseFloat(cs.top)||0)+10)}}
  return v
}

function fieldValue(el){
  if(el.type==='checkbox'||el.type==='radio')return el.checked?'1':'0';
  if(el.multiple&&el.options)return Array.prototype.filter.call(el.options,function(o){return o.selected}).map(function(o){return o.value}).join('\n');
  return String(el.value==null?'':el.value)
}
function defaultValue(el){
  if(el.type==='checkbox'||el.type==='radio')return el.defaultChecked?'1':'0';
  if(el.options){var o=Array.prototype.filter.call(el.options,function(x){return x.defaultSelected});if(!o.length&&!el.multiple&&el.options[0])o=[el.options[0]];return o.map(function(x){return x.value}).join('\n')}
  return String(el.defaultValue==null?'':el.defaultValue)
}
function trackable(el){
  if(!el||!el.matches||!el.matches('input,textarea,select')||el.matches('[type=button],[type=submit],[type=file],[type=hidden]'))return false;
  var c=content();return !!(c&&c.contains(el)&&!el.matches(NOT_SAVED))
}
function resetTracking(rebase){
  if(rebase)initial.forEach(function(v,el){if(el.isConnected)initial.set(el,fieldValue(el));else initial.delete(el)});else initial.clear();
  var c=content(),box=d.getElementById('rc565LocationRows');
  if(rebase&&box)box.removeAttribute('data-rc565-location-dirty');
  if(c)Array.prototype.forEach.call(c.querySelectorAll('[data-cf-changed]'),function(el){el.removeAttribute('data-cf-changed')});
  updateDirty()
}
// zählt geänderte Felder; zurückgesetzte Felder zählen nicht mehr
function updateDirty(){
  var c=content(),count=0,keys={};
  initial.forEach(function(v,el){
    if(!el.isConnected){initial.delete(el);return}
    var on=fieldValue(el)!==v,mark=el.closest('label.field')||el;
    if(on){count++;var sec=el.closest('[data-cf-section]');if(sec)keys[sec.getAttribute('data-cf-section')]=1}
    if(on)setAttr(mark,'data-cf-changed','1');else if(mark.hasAttribute('data-cf-changed'))mark.removeAttribute('data-cf-changed')
  });
  var box=d.getElementById('rc565LocationRows');
  if(box&&box.getAttribute('data-rc565-location-dirty')==='1'&&c&&c.contains(box)){count++;keys.locations=1}
  changedCount=count;dirty=count>0;
  var bar=d.getElementById('rc565CustomerFolderSaveBar');
  if(bar){setAttr(bar,'data-cf-dirty-label',count===1?t('dirty'):t('dirtyN').replace('{n}',count));setAttr(bar,'data-cf-dirty',dirty?'1':'0')}
  var nav=d.getElementById('cfNav');
  if(nav)Array.prototype.forEach.call(nav.querySelectorAll('.cf-link'),function(l){setAttr(l,'data-cf-changed',keys[l.getAttribute('data-cf-target')]?'1':'0')})
}

function syncDirty(c){
  var bar=d.getElementById('rc565CustomerFolderSaveBar');
  if(bar!==dirtyBar){dirtyBar=bar;initial.clear()}
  var key=customerKey(c);
  if(key!==lastCustomer){lastCustomer=key;initial.clear()}
  if(!bar)return;
  var saveBtn=d.getElementById('rc565CustomerFolderSaveAll');
  if(saveBtn)setAttr(saveBtn,'aria-keyshortcuts','Control+S Meta+S'),setAttr(saveBtn,'title',t('saveKey'));
  updateDirty();
  var status=d.getElementById('rc565CustomerFolderSaveStatus');
  if(status!==observedStatus){
    if(statusObserver)statusObserver.disconnect();
    observedStatus=status;
    if(status&&w.MutationObserver){
      statusObserver=statusObserver||new MutationObserver(function(){
        // RC766/RC768: Erfolg wird erst nach bestätigter Azure-Speicherung als „Dauerhaft gespeichert“ gemeldet
        if(/^Dauerhaft gespeichert/.test(q(observedStatus&&observedStatus.textContent)))resetTracking(true)
      });
      statusObserver.observe(status,{childList:true,characterData:true,subtree:true})
    }
  }
}

function sync(){
  raf=0;
  var c=content();if(!c)return;
  var sections=present(c);if(!sections.length)return;
  d.documentElement.style.setProperty('--cf-sticky-top',stickyTop()+'px');
  numberHeadings(sections);
  ensureNav(c,sections);
  formatDates(c);
  linkKpis(c);
  syncDirty(c);
  markActive()
}
function schedule(){if(!raf)raf=(w.requestAnimationFrame||w.setTimeout)(sync)}

function markActive(){
  var c=content(),nav=d.getElementById('cfNav');if(!c||!nav)return;
  var limit=stickyTop()+nav.offsetHeight+24,current='',clickedVisible=false;
  var atEnd=w.innerHeight+w.pageYOffset>=d.documentElement.scrollHeight-4;
  // am Seitenende können die letzten Abschnitte nicht mehr bis unter die Navigation scrollen: dann zählt der angeklickte
  present(c).forEach(function(s){var top=s.el.getBoundingClientRect().top;if(top<=limit||(atEnd&&top<w.innerHeight-120))current=s.key;if(atEnd&&s.key===clicked&&top<w.innerHeight)clickedVisible=true});
  if(clickedVisible)current=clicked;
  if(!current){var first=nav.querySelector('.cf-link');current=first?first.getAttribute('data-cf-target'):''}
  Array.prototype.forEach.call(nav.querySelectorAll('.cf-link'),function(b){var on=b.getAttribute('data-cf-target')===current?'true':'false';if(b.getAttribute('aria-current')!==on){b.setAttribute('aria-current',on);if(on==='true'&&b.scrollIntoView&&b.parentNode.scrollWidth>b.parentNode.clientWidth)b.parentNode.scrollLeft=b.offsetLeft-b.parentNode.offsetLeft-12}})
}
var scrollRaf=0;
function onScroll(){if(!scrollRaf)scrollRaf=(w.requestAnimationFrame||w.setTimeout)(function(){scrollRaf=0;markActive()})}

function onNavClick(e){
  var b=e.target&&e.target.closest&&e.target.closest('.cf-link');if(b)scrollToSection(b.getAttribute('data-cf-target'))
}

function onFocusIn(e){var el=e.target;if(trackable(el)&&!initial.has(el))initial.set(el,fieldValue(el))}
function onEdit(e){
  var el=e.target;if(!trackable(el))return;
  if(!initial.has(el))initial.set(el,defaultValue(el));
  updateDirty()
}

function scrollToSection(key){
  var c=content();if(!c)return;
  var hit=present(c).filter(function(s){return s.key===key})[0];if(!hit)return;
  clicked=key;
  var nav=d.getElementById('cfNav'),y=hit.el.getBoundingClientRect().top+w.pageYOffset-stickyTop()-(nav?nav.offsetHeight:0)-12;
  w.scrollTo({top:Math.max(0,y),behavior:'smooth'})
}
// Kennzahlen führen zum passenden Abschnitt (Reihenfolge aus RC405: Sendungen, ABD-Anfragen, Palettenbuchungen, Portale)
var KPI_TARGETS=['shipments','','pallet','portals'];
function linkKpis(c){
  var box=c.querySelector('.rc405-kpis:not(.rc405-section .rc405-kpis)');if(!box)return;
  Array.prototype.forEach.call(box.querySelectorAll(':scope>.rc405-kpi'),function(k,i){
    var key=KPI_TARGETS[i];if(!key||!c.querySelector(SECTIONS.filter(function(s){return s.key===key})[0].sel))return;
    setAttr(k,'data-cf-target',key);setAttr(k,'role','button');setAttr(k,'tabindex','0');setAttr(k,'title',t('jump')+': '+t(key))
  })
}
function onKpi(e){
  var k=e.target&&e.target.closest&&e.target.closest('.rc405-kpi[data-cf-target]');if(!k||!content())return;
  if(e.type==='keydown'&&e.key!=='Enter'&&e.key!==' ')return;
  e.preventDefault();scrollToSection(k.getAttribute('data-cf-target'))
}

/* Rückfrage bei ungespeicherten Änderungen: vor Kundenwechsel, Menüwechsel, Öffnen einer Sendung, Neuanlage und Abmelden.
   „Speichern und weiter“ löst denselben Knopf „Kundenordner speichern“ aus wie ein Klick (RC565/RC768 speichert). */
function saveButton(){return d.getElementById('rc565CustomerFolderSaveAll')}
function statusText(){return q((d.getElementById('rc565CustomerFolderSaveStatus')||{}).textContent)}
function dialogEl(){
  var dlg=d.getElementById('cfLeaveDialog');
  if(!dlg){
    dlg=d.createElement('dialog');dlg.id='cfLeaveDialog';
    dlg.innerHTML='<h2></h2><p class="cf-leave-text"></p><p class="cf-leave-status" hidden></p><div class="cf-leave-actions">'+
      '<button type="button" data-cf-choice="stay"></button><button type="button" data-cf-choice="discard"></button><button type="button" data-cf-choice="save"></button></div>';
    d.body.appendChild(dlg)
  }
  return dlg
}
function ask(){
  return new Promise(function(resolve){
    var dlg=dialogEl(),name=val('rc405FName')||t('noCustomer');
    dlg.querySelector('h2').textContent=t('leaveTitle');
    dlg.querySelector('.cf-leave-text').textContent=t('leaveText').replace('{name}',name);
    var st=dlg.querySelector('.cf-leave-status');st.hidden=true;st.textContent='';
    var b={stay:dlg.querySelector('[data-cf-choice=stay]'),discard:dlg.querySelector('[data-cf-choice=discard]'),save:dlg.querySelector('[data-cf-choice=save]')};
    b.stay.textContent=t('stay');b.discard.textContent=t('discard');b.save.textContent=t('save');
    Object.keys(b).forEach(function(k){b[k].disabled=false;b[k].hidden=false});
    var phase='ask';
    function done(v){dlg.removeEventListener('click',onClick);dlg.removeEventListener('cancel',onCancel);if(dlg.open)dlg.close();resolve(v)}
    function onCancel(e){e.preventDefault();if(phase!=='saving')done(false)}
    function onClick(e){
      var btn=e.target.closest&&e.target.closest('[data-cf-choice]');if(!btn||btn.disabled)return;
      var choice=btn.getAttribute('data-cf-choice');
      if(choice==='stay')return done(false);
      if(choice==='discard'||phase==='unconfirmed')return done(true);
      var save=saveButton();if(!save||save.disabled)return done(false);
      phase='saving';b.save.textContent=t('saving');Object.keys(b).forEach(function(k){b[k].disabled=true});
      save.click();
      // Prüffehler (z. B. doppelte Kundennummer) melden sich per alert und starten keine Speicherung: dann hierbleiben
      if(!save.disabled)return done(false);
      var start=Date.now();
      (function wait(){
        if(save.isConnected&&save.disabled&&Date.now()-start<30000)return w.setTimeout(wait,150);
        if(/^Dauerhaft gespeichert/.test(statusText()))return done(true);
        phase='unconfirmed';
        st.hidden=false;st.textContent=t('notConfirmed')+' '+statusText();
        b.discard.hidden=true;b.save.textContent=t('proceed');b.stay.disabled=false;b.save.disabled=false
      })()
    }
    dlg.addEventListener('click',onClick);dlg.addEventListener('cancel',onCancel);
    if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');
    b.save.focus()
  })
}
function guard(proceed){
  if(guardOpen)return;
  if(!dirty||!content())return proceed();
  guardOpen=true;
  ask().then(function(go){
    guardOpen=false;if(!go)return;
    resetTracking(false);
    bypass=true;try{proceed()}finally{bypass=false}
  })
}
function sameCustomer(){var s=d.getElementById('rc405FolderSearch');return !!s&&q(s.value)===q(s.defaultValue)}
function leaving(target){
  var c=content();if(!c||!target||!target.closest)return null;
  var v=target.closest('[data-view]');
  if(v&&v!==c&&!c.contains(v)&&v.getAttribute('data-view')!=='customerfolder')return v;
  var out=target.closest('#logoutBtn');if(out)return out;
  var code=target.closest('[onclick]');
  if(code&&c.contains(code)&&LEAVE_CODE.test(code.getAttribute('onclick')||'')){
    if(/rc405SelectFolder/.test(code.getAttribute('onclick'))&&sameCustomer())return null;
    return code
  }
  return null
}
function onLeaveClick(e){
  if(bypass||!dirty)return;
  var el=leaving(e.target);if(!el)return;
  e.preventDefault();e.stopImmediatePropagation();
  // „Öffnen“ liest die Kundensuche erst beim Ausführen; nach „Speichern“ steht dort wieder der alte Kunde, daher Wert jetzt merken
  var search=d.getElementById('rc405FolderSearch'),target=search&&search.value;
  if(/rc405SelectFolder/.test(el.getAttribute('onclick')||'')&&typeof w.rc405SelectFolder==='function')return guard(function(){w.rc405SelectFolder(target)});
  guard(function(){el.click()})
}
function onKey(e){
  if(bypass||!content())return;
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&String(e.key).toLowerCase()==='s'){
    e.preventDefault();var save=saveButton();if(save&&!save.disabled)save.click();return
  }
  if(e.key!=='Enter'||!dirty)return;
  var el=e.target;
  if(el&&el.id==='rc405FolderSearch'&&!sameCustomer()){
    e.preventDefault();e.stopImmediatePropagation();
    var v=el.value;guard(function(){if(typeof w.rc405SelectFolder==='function')w.rc405SelectFolder(v)})
  }else if(el&&el.id==='globalSearch'&&q(el.value)){
    e.preventDefault();e.stopImmediatePropagation();
    guard(function(){el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}))})
  }
}
function onUnload(e){if(dirty&&content()){e.preventDefault();e.returnValue='';return ''}}

function install(){
  if(!d.body)return;
  if(w.MutationObserver&&!observer){
    observer=new MutationObserver(schedule);
    observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-view','data-rc565-location-dirty']})
  }
  d.addEventListener('focusin',onFocusIn,true);
  d.addEventListener('input',onEdit,true);
  d.addEventListener('change',onEdit,true);
  // Klick und Tastatur laufen über den frühen Haken im <head> (Build), damit die Rückfrage vor dem Menü-Handler RC325 greift;
  // ohne Haken (z. B. alte Builds) wenigstens auf window in der Capture-Phase
  if(!w.__EXPORTHUB_CF_EARLY_GUARD__){w.addEventListener('click',onLeaveClick,true);w.addEventListener('keydown',onKey,true)}
  w.addEventListener('beforeunload',onUnload);
  d.addEventListener('click',onKpi);
  d.addEventListener('keydown',onKpi);
  w.addEventListener('scroll',onScroll,{passive:true});
  ['wheel','touchstart','keydown'].forEach(function(t){w.addEventListener(t,function(){clicked=''},{passive:true})});
  w.addEventListener('resize',schedule);
  schedule()
}

w.ExportHUBCustomerFolder=Object.freeze({version:'2',sync:sync,isDirty:function(){return dirty},changes:function(){return changedCount},guard:guard,onLeaveClick:onLeaveClick,onKey:onKey,i18n:I18N});
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window,document);
