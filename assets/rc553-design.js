(function(){
'use strict';
if(window.__EXPORTHUB_RC553_DESIGN__)return;
window.__EXPORTHUB_RC553_DESIGN__=true;
var scheduled=false;
function q(v){return String(v==null?'':v).trim()}
function currentView(){return q(document.body.getAttribute('data-exporthub-view')||((window.__EXPORTHUB_GET_STATE__?window.__EXPORTHUB_GET_STATE__():(window.state||{})).view))}
function labelFor(el){
  var f=el&&el.closest&&el.closest('.field');
  if(!f)return q(el&&el.getAttribute&&el.getAttribute('aria-label'))||q(el&&el.placeholder)||q(el&&el.textContent)||'Bedienelement';
  var c=f.cloneNode(true);c.querySelectorAll('input,select,textarea,button,datalist').forEach(function(n){n.remove()});
  return q(c.textContent).replace(/\s+/g,' ')||q(el.getAttribute('aria-label'))||q(el.placeholder)||'Eingabefeld';
}
function pageHead(){return document.querySelector('#content .rc542-head,#content .page-head,#content .rc544-head')}
function ensureFocusBar(){
  var v=currentView();if(!/^(pallet|tasks|rights)$/.test(v))return;
  if(document.getElementById('rc553FocusBar'))return;
  var h=pageHead();if(!h)return;
  var b=document.createElement('div');b.id='rc553FocusBar';b.className='rc553-focusbar';
  b.innerHTML='<span class="rc553-focus-icon">⌖</span><span>Fokus: <strong id="rc553FocusText">Bereit zur Eingabe</strong></span>';
  h.insertAdjacentElement('afterend',b);
}
function updateFocus(text,active){var b=document.getElementById('rc553FocusBar'),t=document.getElementById('rc553FocusText');if(!b||!t)return;t.textContent=text||'Bereit zur Eingabe';b.classList.toggle('is-active',!!active)}
function wrapPalletSearch(){
  var card=document.querySelector('#content .rc542-page>.card');if(!card||card.querySelector('.rc553-pallet-search-row'))return;
  var label=card.querySelector(':scope > label.field'),btn=label&&label.nextElementSibling;
  if(!label||!btn||!btn.matches('button'))return;
  var row=document.createElement('div');row.className='rc553-pallet-search-row';label.insertAdjacentElement('beforebegin',row);row.append(label,btn);
}
function wrapPalletSections(){
  var card=document.querySelector('#content .rc542-page>.card');if(!card)return;
  var heads=[].slice.call(card.querySelectorAll(':scope > h2'));
  heads.forEach(function(h){
    if(h.parentElement&&h.parentElement.classList.contains('rc553-pallet-section'))return;
    var wrap=document.createElement('div');wrap.className='rc553-pallet-section';h.insertAdjacentElement('beforebegin',wrap);
    var node=h;while(node){var next=node.nextElementSibling;wrap.appendChild(node);if(next&&next.tagName==='H2')break;node=next}
  });
}
function patchPallet(){wrapPalletSearch();wrapPalletSections()}
function patchTasks(){
  var head=document.querySelector('#content .page-head'),editor=document.getElementById('rc524TaskEditorButton');
  if(head&&editor&&!head.contains(editor))head.appendChild(editor);
  document.querySelectorAll('#content .rc229-task-card').forEach(function(card){
    var t=q(card.textContent).toLowerCase();
    card.classList.toggle('rc553-urgent',/dringend|hoch/.test(t));
    card.classList.toggle('rc553-low',/niedrig/.test(t));
    card.classList.toggle('rc553-normal',!/dringend|hoch|niedrig/.test(t));
    card.classList.toggle('rc553-done',/erledigt/.test(t)&&!/offen/.test(t));
    card.classList.toggle('rc553-overdue',/überfällig|ueberfaellig/.test(t));
  });
}
function patchRights(){
  document.querySelectorAll('#content .rc544-rights').forEach(function(row){row.setAttribute('role','group')});
}
function patch(){
  var v=currentView();if(!/^(pallet|tasks|rights)$/.test(v))return;
  ensureFocusBar();if(v==='pallet')patchPallet();else if(v==='tasks')patchTasks();else patchRights();
}
function schedule(){if(scheduled)return;scheduled=true;(window.requestAnimationFrame||window.setTimeout)(function(){scheduled=false;patch()},20)}
document.addEventListener('focusin',function(e){
  patch();var v=currentView();if(!/^(pallet|tasks|rights)$/.test(v))return;
  var el=e.target;if(!el||!el.matches||!el.matches('input,select,textarea,button,a'))return;if(!el.closest('#content'))return;
  document.querySelectorAll('#content .field.rc553-field-active').forEach(function(n){n.classList.remove('rc553-field-active')});
  var f=el.closest('.field');if(f)f.classList.add('rc553-field-active');updateFocus(labelFor(el),true);
},true);
document.addEventListener('focusout',function(e){var f=e.target&&e.target.closest&&e.target.closest('.field');if(f)setTimeout(function(){if(!f.contains(document.activeElement))f.classList.remove('rc553-field-active')},0)},true);
window.addEventListener('exporthub:rendered',schedule);window.addEventListener('exporthub:viewchange',schedule);window.addEventListener('exporthub:ready',schedule);
document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#nav button,#nav a'))setTimeout(schedule,80)},true);
var c=document.getElementById('content');if(c&&window.MutationObserver)new MutationObserver(schedule).observe(c,{childList:true,subtree:false});
var timerHost=(window.ExportHUBClean&&window.ExportHUBClean.native&&window.ExportHUBClean.native.setInterval)||window.setInterval;try{timerHost(function(){var v=currentView();if(/^(pallet|tasks|rights)$/.test(v))schedule()},700)}catch(_){ }
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(schedule,700)},{once:true});else setTimeout(schedule,50);
})();
