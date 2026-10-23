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
 de:{nav:'Abschnitte im Kundenordner',master:'Kundendaten',mail:'Mail & Kontakte',locations:'Standorte',contacts:'Spedition',portals:'Portale',shipments:'Sendungen',notes:'Notizen',pallet:'Palettenkonto',history:'Historie',dirty:'● Ungespeicherte Änderungen',noCustomer:'Kein Kunde geöffnet'},
 en:{nav:'Customer folder sections',master:'Customer data',mail:'Mail & contacts',locations:'Locations',contacts:'Carrier',portals:'Portals',shipments:'Shipments',notes:'Notes',pallet:'Pallet account',history:'History',dirty:'● Unsaved changes',noCustomer:'No customer open'},
 pl:{nav:'Sekcje folderu klienta',master:'Dane klienta',mail:'Poczta i kontakty',locations:'Lokalizacje',contacts:'Spedycja',portals:'Portale',shipments:'Przesyłki',notes:'Notatki',pallet:'Konto palet',history:'Historia',dirty:'● Niezapisane zmiany',noCustomer:'Brak otwartego klienta'},
 es:{nav:'Secciones de la carpeta de cliente',master:'Datos del cliente',mail:'Correo y contactos',locations:'Ubicaciones',contacts:'Transportista',portals:'Portales',shipments:'Envíos',notes:'Notas',pallet:'Cuenta de palés',history:'Historial',dirty:'● Cambios sin guardar',noCustomer:'Ningún cliente abierto'},
 fr:{nav:'Sections du dossier client',master:'Données client',mail:'Mail et contacts',locations:'Sites',contacts:'Transporteur',portals:'Portails',shipments:'Envois',notes:'Notes',pallet:'Compte palettes',history:'Historique',dirty:'● Modifications non enregistrées',noCustomer:'Aucun client ouvert'},
 it:{nav:'Sezioni della cartella cliente',master:'Dati cliente',mail:'Mail e contatti',locations:'Sedi',contacts:'Spedizioniere',portals:'Portali',shipments:'Spedizioni',notes:'Note',pallet:'Conto pallet',history:'Cronologia',dirty:'● Modifiche non salvate',noCustomer:'Nessun cliente aperto'}
};
// Felder, die nicht über „Kundenordner speichern“ laufen (Suche, Neuanlage, Löschdialog, Kontakt-Auswahlmenüs)
var NOT_SAVED='#rc405FolderSearch,.rc405-new-customer *,#rc1126CustomerDelete *,.rc1092-contact-card select,#cfNav *';
var ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

var clicked='',dirty=false,dirtyBar=null,raf=0,observer=null,statusObserver=null,observedStatus=null,lastCustomer='';

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

function syncDirty(c){
  var bar=d.getElementById('rc565CustomerFolderSaveBar');
  if(bar!==dirtyBar){dirtyBar=bar;dirty=false}
  var key=customerKey(c);
  if(key!==lastCustomer){lastCustomer=key;dirty=false}
  if(!bar)return;
  setAttr(bar,'data-cf-dirty-label',t('dirty'));
  setAttr(bar,'data-cf-dirty',dirty?'1':'0');
  var status=d.getElementById('rc565CustomerFolderSaveStatus');
  if(status!==observedStatus){
    if(statusObserver)statusObserver.disconnect();
    observedStatus=status;
    if(status&&w.MutationObserver){
      statusObserver=statusObserver||new MutationObserver(function(){
        // RC766/RC768: Erfolg wird erst nach bestätigter Azure-Speicherung als „Dauerhaft gespeichert“ gemeldet
        if(/^Dauerhaft gespeichert/.test(q(observedStatus&&observedStatus.textContent))){dirty=false;var b=d.getElementById('rc565CustomerFolderSaveBar');setAttr(b,'data-cf-dirty','0')}
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
  var b=e.target&&e.target.closest&&e.target.closest('.cf-link');if(!b)return;
  var c=content();if(!c)return;
  var key=clicked=b.getAttribute('data-cf-target'),hit=present(c).filter(function(s){return s.key===key})[0];if(!hit)return;
  var nav=d.getElementById('cfNav'),y=hit.el.getBoundingClientRect().top+w.pageYOffset-stickyTop()-(nav?nav.offsetHeight:0)-12;
  w.scrollTo({top:Math.max(0,y),behavior:'smooth'})
}

function onEdit(e){
  var el=e.target;if(!el||!el.matches||!el.matches('input,textarea,select'))return;
  var c=content();if(!c||!c.contains(el)||el.matches(NOT_SAVED))return;
  if(!dirty){dirty=true;var bar=d.getElementById('rc565CustomerFolderSaveBar');setAttr(bar,'data-cf-dirty','1')}
}

function install(){
  if(!d.body)return;
  if(w.MutationObserver&&!observer){
    observer=new MutationObserver(schedule);
    observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-view']})
  }
  d.addEventListener('input',onEdit,true);
  d.addEventListener('change',onEdit,true);
  w.addEventListener('scroll',onScroll,{passive:true});
  ['wheel','touchstart','keydown'].forEach(function(t){w.addEventListener(t,function(){clicked=''},{passive:true})});
  w.addEventListener('resize',schedule);
  schedule()
}

w.ExportHUBCustomerFolder=Object.freeze({version:'1',sync:sync,isDirty:function(){return dirty},i18n:I18N});
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window,document);
