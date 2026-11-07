(function(){
'use strict';
// Sendungsansicht: Schaltfläche „Fehler melden“. Öffnet die Seite „Fehler & Verbesserungen“ mit vorbelegter Sendungsreferenz.
// Rein darstellend: speichert nichts und ändert keine Sendungsdaten.
if(window.__EXPORTHUB_SHIPMENT_ERROR_REPORT__)return;window.__EXPORTHUB_SHIPMENT_ERROR_REPORT__=true;
// Texte liegen in assets/i18n/shipment-error-report.js (wird vorher geladen)
function packs(){var p=window.ExportHUBShipmentErrorReportI18n;return p&&p.packs||{de:{button:'',title:''}}}
var scheduled=false;
function q(v){return String(v==null?'':v).trim()}
function lang(){
 try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.language==='function'){var l=q(window.ExportHUBI18n.language()).toLowerCase().slice(0,2);if(packs()[l])return l}}catch(_){/* ohne Sprachmodul */}
 return'de'
}
function currentRef(){
 var sh=window.__EXPORTHUB_RC776_VIEW_SHIPMENT__;
 var ref=q(sh&&typeof sh==='object'&&(sh.ref||sh.reference||sh.shipmentRef)).toUpperCase();
 return/^[A-Z0-9]{6}$/.test(ref)?ref:''
}
function reportUrl(){
 var ref=currentRef(),url='/qualitaet.html?lang='+encodeURIComponent(lang());
 return ref?url+'&ref='+encodeURIComponent(ref):url
}
function ensureButton(){
 scheduled=false;
 var actions=document.querySelector('#rc786ReferenceFilesCard .rc786-doc-head-actions');
 if(!actions)return;
 var t=packs()[lang()]||packs().de,existing=actions.querySelector('[data-error-report]');
 if(existing){existing.textContent=t.button;existing.title=t.title;return}
 var b=document.createElement('button');
 b.type='button';b.className='ghost';b.setAttribute('data-error-report','1');b.textContent=t.button;b.title=t.title;
 actions.appendChild(b)
}
function scheduleEnsure(){if(scheduled)return;scheduled=true;(window.requestAnimationFrame||setTimeout)(ensureButton)}
document.addEventListener('click',function(e){
 var b=e.target&&e.target.closest&&e.target.closest('[data-error-report]');
 if(!b)return;
 e.preventDefault();window.open(reportUrl(),'_blank','noopener')
},true);
function start(){ensureButton();if(window.MutationObserver)new MutationObserver(scheduleEnsure).observe(document.body,{childList:true,subtree:true})}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
window.ExportHUBShipmentErrorReport=Object.freeze({version:'ER1',reportUrl:reportUrl,ensureButton:ensureButton});
})();
