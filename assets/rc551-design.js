(function(){
'use strict';
if(window.__EXPORTHUB_RC551_DESIGN__)return;
window.__EXPORTHUB_RC551_DESIGN__=true;
var scheduled=false;
function q(v){return String(v==null?'':v).trim()}
function state(){try{return window.__EXPORTHUB_GET_STATE__?window.__EXPORTHUB_GET_STATE__():(window.state||{})}catch(_){return window.state||{}}}
function view(){return q(state().view||document.body.getAttribute('data-exporthub-view')||document.body.getAttribute('data-current-view'))}
function labelForField(el){
  var f=el&&el.closest&&el.closest('.field');
  if(!f)return q(el&&el.getAttribute&&el.getAttribute('aria-label'))||q(el&&el.placeholder)||'Eingabefeld';
  var clone=f.cloneNode(true);clone.querySelectorAll('input,select,textarea,button,datalist').forEach(function(n){n.remove()});
  return q(clone.textContent).replace(/\s+/g,' ')||q(el.getAttribute('aria-label'))||q(el.placeholder)||'Eingabefeld';
}
function setFocus(text,active){
  var bar=document.getElementById('rc551FocusBar'),value=document.getElementById('rc551FocusText');
  if(!bar||!value)return;
  value.textContent=text||'Bereit zur Eingabe';
  bar.classList.toggle('is-active',!!active);
}
function addBadge(card,num){
  if(!card)return;var h=card.querySelector(':scope > h3');if(!h||h.querySelector('.rc551-step-badge'))return;
  var b=document.createElement('span');b.className='rc551-step-badge';b.textContent=num;h.prepend(b);
}
function ensureProcessbar(root){
  if(document.getElementById('rc551Processbar'))return;
  var head=root.querySelector(':scope > .page-head');if(!head)return;
  var bar=document.createElement('div');bar.id='rc551Processbar';bar.className='rc551-processbar';
  bar.innerHTML='<div class="rc551-process-step active" data-rc551-target="customer"><strong>1</strong><span>Kunde & Grunddaten</span></div>'+
    '<div class="rc551-process-step" data-rc551-target="colli"><strong>2</strong><span>Colli & Gewichte</span></div>'+
    '<div class="rc551-process-step" data-rc551-target="abd"><strong>3</strong><span>ABD & Druck</span></div>'+
    '<div class="rc551-process-step" data-rc551-target="mail"><strong>4</strong><span>Mailversand</span></div>';
  head.insertAdjacentElement('afterend',bar);
  var focus=document.createElement('div');focus.id='rc551FocusBar';focus.className='rc551-focusbar';
  focus.innerHTML='<span class="rc551-focus-icon">⌖</span><span>Fokus: <strong id="rc551FocusText">Bereit zur Eingabe</strong></span>';
  bar.insertAdjacentElement('afterend',focus);
}
function updateProcessByElement(el){
  var key='customer';
  if(el&&el.closest){
    if(el.closest('#rc543MailArea'))key='mail';
    else if(el.closest('#rc543AbdDecision,#rc543PrintStatus,#rc524StowPlan'))key='abd';
    else if(el.closest('.rc344-grid>.rc344-card:nth-child(2),#rowsBox'))key='colli';
  }
  document.querySelectorAll('#rc551Processbar .rc551-process-step').forEach(function(n){n.classList.toggle('active',n.getAttribute('data-rc551-target')===key)});
}
function patchShipment(){
  var root=document.querySelector('#content .rc344-root');if(!root)return;
  document.body.setAttribute('data-rc551-view','shipment');
  ensureProcessbar(root);
  var cards=root.querySelectorAll('.rc344-grid>.rc344-card');
  addBadge(cards[0],'1');addBadge(cards[1],'2');
  var old=document.getElementById('rc542MailArea');if(old)old.setAttribute('aria-hidden','true');
  var duplicateAbd=document.getElementById('rc542AbdStatus');if(duplicateAbd)duplicateAbd.setAttribute('aria-hidden','true');
  var note=document.getElementById('rc551DesignNote');
  if(!note){note=document.createElement('div');note.id='rc551DesignNote';note.className='rc551-design-note';note.textContent='Aktive Felder werden durch Fokuszeile, Hintergrundbeleuchtung und blaue Markierung hervorgehoben.';var mail=document.getElementById('rc543MailArea');(mail||root).insertAdjacentElement('afterend',note)}
}
function patch(){
  if(view()==='shipment'||document.querySelector('#content .rc344-root'))patchShipment();
  else document.body.removeAttribute('data-rc551-view');
}
function schedule(){if(scheduled)return;scheduled=true;(window.requestAnimationFrame||window.setTimeout)(function(){scheduled=false;patch()},20)}
document.addEventListener('focusin',function(e){
  patch();
  var el=e.target;if(!el||!el.matches||!el.matches('input,select,textarea,button'))return;
  if(!el.closest('#content'))return;
  document.querySelectorAll('#content .field.rc551-field-active').forEach(function(n){n.classList.remove('rc551-field-active')});
  var field=el.closest('.field');if(field)field.classList.add('rc551-field-active');
  setFocus(labelForField(el),true);updateProcessByElement(el);
},true);
document.addEventListener('focusout',function(e){
  var field=e.target&&e.target.closest&&e.target.closest('.field');
  if(field)setTimeout(function(){if(!field.contains(document.activeElement))field.classList.remove('rc551-field-active')},0);
},true);
document.addEventListener('click',function(e){var el=e.target&&e.target.closest&&e.target.closest('#content button,#content [role="button"]');if(el)updateProcessByElement(el)},true);
window.addEventListener('exporthub:rendered',schedule);
window.addEventListener('exporthub:viewchange',schedule);
window.addEventListener('exporthub:ready',schedule);
var content=document.getElementById('content');
if(content&&window.MutationObserver){new MutationObserver(function(){schedule()}).observe(content,{childList:true,subtree:false})}
window.setInterval(function(){if(document.querySelector('#content .rc344-root'))schedule()},800);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(schedule,800)},{once:true});else setTimeout(schedule,50);
})();
