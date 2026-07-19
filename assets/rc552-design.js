(function(){
'use strict';
if(window.__EXPORTHUB_RC552_DESIGN__)return;
window.__EXPORTHUB_RC552_DESIGN__=true;
var scheduled=false;
function q(v){return String(v==null?'':v).trim()}
function currentView(){return q(document.body.getAttribute('data-exporthub-view')||((window.__EXPORTHUB_GET_STATE__?window.__EXPORTHUB_GET_STATE__():(window.state||{})).view))}
function labelFor(el){
  var f=el&&el.closest&&el.closest('.field');
  if(!f)return q(el&&el.getAttribute&&el.getAttribute('aria-label'))||q(el&&el.placeholder)||q(el&&el.textContent)||'Bedienelement';
  var c=f.cloneNode(true);c.querySelectorAll('input,select,textarea,button,datalist').forEach(function(n){n.remove()});
  return q(c.textContent).replace(/\s+/g,' ')||q(el.getAttribute('aria-label'))||q(el.placeholder)||'Eingabefeld';
}
function pageHead(){return document.querySelector('#content .rc524-page-head,#content .page-head')}
function ensureFocusBar(){
  var v=currentView();if(!/^(shipmentoverview|customers|customerfolder)$/.test(v))return;
  if(document.getElementById('rc552FocusBar'))return;
  var h=pageHead();if(!h)return;
  var b=document.createElement('div');b.id='rc552FocusBar';b.className='rc552-focusbar';
  b.innerHTML='<span class="rc552-focus-icon">⌖</span><span>Fokus: <strong id="rc552FocusText">Bereit zur Eingabe</strong></span>';
  h.insertAdjacentElement('afterend',b);
}
function updateFocus(text,active){var b=document.getElementById('rc552FocusBar'),t=document.getElementById('rc552FocusText');if(!b||!t)return;t.textContent=text||'Bereit zur Eingabe';b.classList.toggle('is-active',!!active)}
function dateValue(text){var m=q(text).match(/(\d{2})\.(\d{2})\.(\d{4})/);if(!m)return NaN;return Date.UTC(+m[3],+m[2]-1,+m[1])}
function patchOverview(){
  var list=document.querySelector('#content .rc524-card-list');if(!list)return;
  var page=list.closest('.rc524-page')||document.getElementById('content');
  if(!document.getElementById('rc552OverviewKpis')){
    var cards=[].slice.call(list.querySelectorAll('.rc524-shipment-card'));
    var total=cards.length,abd=0,ready=0,over=0,today=new Date();today=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
    cards.forEach(function(card){
      var txt=q(card.textContent).toLowerCase();
      if(/abd/.test(txt)&&!/abd:\s*(abgeschlossen|vorhanden)/.test(txt)){card.classList.add('is-abd');abd++}
      if(/bereit zur abholung/.test(txt)){card.classList.add('is-ready');ready++}
      var d=dateValue(txt);if(Number.isFinite(d)&&d<today&&!/(abgeschlossen|storniert|archiviert)/.test(txt)){card.classList.add('is-overdue');over++}
    });
    var k=document.createElement('div');k.id='rc552OverviewKpis';k.className='rc552-overview-kpis';
    k.innerHTML='<div class="rc552-overview-kpi blue"><span>Aktive Sendungen</span><strong>'+total+'</strong></div>'+
      '<div class="rc552-overview-kpi orange"><span>ABD offen</span><strong>'+abd+'</strong></div>'+
      '<div class="rc552-overview-kpi green"><span>Bereit zur Abholung</span><strong>'+ready+'</strong></div>'+
      '<div class="rc552-overview-kpi red"><span>Überfällig</span><strong>'+over+'</strong></div>';
    var controls=page.querySelector('.rc524-overview-controls');(controls||list).insertAdjacentElement('beforebegin',k);
  }
}
function wrapFolderSections(){
  var content=document.getElementById('content');if(!content||content.querySelector('.rc552-folder-grid'))return;
  var sections=[].slice.call(content.querySelectorAll(':scope > .rc409-folder-section'));if(!sections.length)return;
  var grid=document.createElement('div');grid.className='rc552-folder-grid';sections[0].insertAdjacentElement('beforebegin',grid);sections.forEach(function(s){grid.appendChild(s)})
}
function patchCustomers(){
  var v=currentView();if(v==='customerfolder')wrapFolderSections();
  document.querySelectorAll('#content .rc409-customer-row').forEach(function(row){if(row.hasAttribute('data-rc552-design'))return;row.setAttribute('data-rc552-design','1')});
}
function patch(){
  var v=currentView();if(!/^(shipmentoverview|customers|customerfolder)$/.test(v))return;
  ensureFocusBar();if(v==='shipmentoverview')patchOverview();else patchCustomers();
}
function schedule(){if(scheduled)return;scheduled=true;(window.requestAnimationFrame||window.setTimeout)(function(){scheduled=false;patch()},20)}
document.addEventListener('focusin',function(e){
  patch();
  var v=currentView();if(!/^(shipmentoverview|customers|customerfolder)$/.test(v))return;
  var el=e.target;if(!el||!el.matches||!el.matches('input,select,textarea,button,a'))return;if(!el.closest('#content'))return;
  document.querySelectorAll('#content .field.rc552-field-active').forEach(function(n){n.classList.remove('rc552-field-active')});
  var f=el.closest('.field');if(f)f.classList.add('rc552-field-active');updateFocus(labelFor(el),true);
},true);
document.addEventListener('focusout',function(e){var f=e.target&&e.target.closest&&e.target.closest('.field');if(f)setTimeout(function(){if(!f.contains(document.activeElement))f.classList.remove('rc552-field-active')},0)},true);
window.addEventListener('exporthub:rendered',schedule);window.addEventListener('exporthub:viewchange',schedule);window.addEventListener('exporthub:ready',schedule);
document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#nav button,#nav a'))setTimeout(schedule,80)},true);
var c=document.getElementById('content');if(c&&window.MutationObserver)new MutationObserver(schedule).observe(c,{childList:true,subtree:false});
var timerHost=(window.ExportHUBClean&&window.ExportHUBClean.native&&window.ExportHUBClean.native.setInterval)||window.setInterval;try{timerHost(function(){var v=currentView();if(/^(shipmentoverview|customers|customerfolder)$/.test(v))schedule()},650)}catch(_){ }
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(schedule,700)},{once:true});else setTimeout(schedule,50);
})();
