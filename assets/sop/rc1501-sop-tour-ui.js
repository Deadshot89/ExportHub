(function(root){
'use strict';
if(root.ExportHubSopTourUi)return;

let panel=null;
let mountedRoot=null;
let observer=null;
let contextProvider=null;
let listeners=[];
let highlighted=null;
let highlightedKey='';

function text(value){return String(value==null?'':value).trim();}
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function arr(value){return Array.isArray(value)?value:[];}
function hasEnabledTour(sop){return arr(sop&&sop.steps).some(step=>step&&step.tour&&step.tour.enabled===true);}
function startButtonHtml(sop){
  if(!hasEnabledTour(sop))return '';
  const number=esc(sop&&sop.number);
  return `<button type="button" data-sop-tour-start="${number}">▶ Anleitung starten</button><button type="button" data-sop-training-start="${number}">🎓 Training starten</button>`;
}
function firstTip(step){return text(arr(step&&step.warnings)[0]||arr(step&&step.troubleshooting)[0]||'');}
function trainingHeader(session){
  if(text(session&&session.mode).toLowerCase()!=='training')return '';
  return `<div class="rc1503-sop-training-banner" data-sop-training-banner role="status" aria-live="polite"><strong>TRAININGSMODUS</strong><span>Keine produktiven Daten werden verändert.</span></div><div class="rc1503-sop-training-simulation" data-sop-training-simulation-label><span aria-hidden="true">🧪</span><span>Simulation · Aktionen und Ergebnisse bleiben in der Demo.</span></div>`;
}
function render(session){
  if(!session)return '';
  const step=session.currentStep||{};
  const paused=session.status==='paused';
  const completed=session.status==='completed';
  const training=text(session.mode).toLowerCase()==='training';
  const statusText=completed?(training?'Training abgeschlossen':'Anleitung abgeschlossen'):paused?(training?'Training pausiert':'Anleitung pausiert'):session.feedback&&session.feedback.reason==='STEP_COMPLETED'?'Schritt abgeschlossen':training?'Training aktiv':'Anleitung aktiv';
  const tip=firstTip(step);
  return `<aside class="rc1501-sop-tour-panel${training?' rc1503-sop-training-panel':''}" role="complementary" aria-label="${training?'Geführtes SOP-Training':'Geführte SOP-Anleitung'}">
    ${trainingHeader(session)}
    <div class="rc1501-sop-tour-head"><div><span class="rc1501-sop-tour-kicker">${esc(session.sopNumber)}</span><h2>${esc(session.title||(training?'SOP-Training':'SOP-Anleitung'))}</h2></div><button type="button" data-sop-tour-end aria-label="${training?'Training':'Anleitung'} beenden">×</button></div>
    <div class="rc1501-sop-tour-progress" aria-label="Fortschritt ${Number(session.percent)||0} Prozent"><div><strong>Schritt ${Number(session.stepNumber)||0} von ${Number(session.total)||0}</strong><span>${Number(session.percent)||0} %</span></div><progress max="100" value="${Number(session.percent)||0}">${Number(session.percent)||0} %</progress></div>
    <div class="rc1501-sop-tour-status" role="status" aria-live="polite">${esc(statusText)}</div>
    ${completed?`<p class="rc1501-sop-tour-complete">✅ ${training?'Training':'Anleitung'} abgeschlossen.</p>`:`<section class="rc1501-sop-tour-task"><h3>Aktuelle Aufgabe</h3><p>${esc(step.instruction||step.title||'')}</p>${tip?`<div class="rc1501-sop-tour-tip"><strong>Tipp</strong><span>${esc(tip)}</span></div>`:''}</section>`}
    <div class="rc1501-sop-tour-controls">
      <button type="button" data-sop-tour-previous${Number(session.index)<=0?' disabled':''}>Vorheriger Schritt</button>
      <button type="button" data-sop-tour-pause>${paused?'Fortsetzen':'Pausieren'}</button>
      <button type="button" data-sop-tour-open-sop>SOP öffnen</button>
      <button type="button" data-sop-tour-end>Beenden</button>
    </div>
  </aside>`;
}
function currentContext(){try{return typeof contextProvider==='function'?(contextProvider()||{}):{};}catch(_){return {};}}
function eventDescriptor(event){
  const type=text(event&&event.type).toLowerCase();
  const action=type==='input'?'input':type==='change'?'change':type==='click'?'click':type;
  const raw=event&&event.target;
  const target=raw&&typeof raw.closest==='function'?raw.closest('[data-tour-key]'):null;
  const stableKey=text(target&&typeof target.getAttribute==='function'?target.getAttribute('data-tour-key'):'');
  return {action,stableKey};
}
function clearHighlight(){
  if(highlighted&&highlighted.classList&&typeof highlighted.classList.remove==='function')highlighted.classList.remove('rc1501-sop-tour-target');
  highlighted=null;
  highlightedKey='';
}
function highlightCurrent(session){
  if(!session||session.status!=='active'){clearHighlight();return;}
  const key=text(session.currentStep&&session.currentStep.target&&session.currentStep.target.stableKey);
  if(!key){clearHighlight();return;}
  const registry=root.ExportHubSopTourTargets;
  const found=registry&&typeof registry.find==='function'?registry.find(key,mountedRoot||root.document):{ok:false};
  if(!found.ok||!found.element){clearHighlight();return;}
  if(highlighted===found.element&&highlightedKey===key)return;
  clearHighlight();
  highlighted=found.element;
  highlightedKey=key;
  if(highlighted.classList&&typeof highlighted.classList.add==='function')highlighted.classList.add('rc1501-sop-tour-target');
  if(typeof highlighted.scrollIntoView==='function'){try{highlighted.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});}catch(_){}}
}
function paint(){
  const tour=root.ExportHubSopTour;
  const session=tour&&typeof tour.current==='function'?tour.current():null;
  if(!panel)return session;
  if(!session){panel.innerHTML='';panel.hidden=true;clearHighlight();return null;}
  panel.hidden=false;panel.innerHTML=render(session);highlightCurrent(session);return session;
}
function reportAction(action,element,context){
  const tour=root.ExportHubSopTour;
  if(!tour||typeof tour.handleAction!=='function')return null;
  const target=element&&typeof element.closest==='function'?element.closest('[data-tour-key]'):element;
  const stableKey=text(target&&typeof target.getAttribute==='function'?target.getAttribute('data-tour-key'):'');
  const result=tour.handleAction({action:text(action),stableKey,context:context&&typeof context==='object'?context:currentContext()});
  paint();return result;
}
function onWorkEvent(event){
  if(!event||event.defaultPrevented)return;
  const descriptor=eventDescriptor(event);
  if(!descriptor.stableKey)return;
  reportAction(descriptor.action,event.target,currentContext());
}
function onCustomAction(event){const d=event&&event.detail&&typeof event.detail==='object'?event.detail:{};reportAction(d.action,d.element||event.target,d.context||currentContext());}
function onPanelClick(event){
  const tour=root.ExportHubSopTour;if(!tour)return;
  const t=event&&event.target;
  if(t&&t.closest&&t.closest('[data-sop-tour-previous]')){tour.previous();paint();return;}
  if(t&&t.closest&&t.closest('[data-sop-tour-pause]')){const s=tour.current();if(s&&s.status==='paused')tour.resume();else tour.pause();paint();return;}
  if(t&&t.closest&&t.closest('[data-sop-tour-end]')){const s=tour.current();if(s&&text(s.mode).toLowerCase()==='training'&&root.ExportHubSopTraining&&typeof root.ExportHubSopTraining.end==='function')root.ExportHubSopTraining.end();else tour.end();paint();return;}
  if(t&&t.closest&&t.closest('[data-sop-tour-open-sop]')){try{mountedRoot&&mountedRoot.dispatchEvent&&mountedRoot.dispatchEvent(new CustomEvent('exporthub:sop-tour-open-sop',{detail:{sopNumber:tour.current()?.sopNumber}}));}catch(_){}return;}
}
function annotate(){const registry=root.ExportHubSopTourTargets;if(registry&&typeof registry.annotatePilotTargets==='function')registry.annotatePilotTargets(mountedRoot||root.document);}
function enhanceSopDocument(scope,sop){
  if(!scope||!hasEnabledTour(sop))return false;
  const actions=typeof scope.querySelector==='function'?scope.querySelector('.rc1007-sop-doc-actions'):null;
  if(!actions||typeof actions.insertAdjacentHTML!=='function')return false;
  if(typeof actions.querySelector==='function'&&actions.querySelector('[data-sop-tour-start]'))return true;
  actions.insertAdjacentHTML('beforeend',startButtonHtml(sop));return true;
}
function mount(target,options={}){
  const doc=root.document;
  mountedRoot=target||doc;
  contextProvider=typeof options.contextProvider==='function'?options.contextProvider:null;
  if(!doc||typeof doc.createElement!=='function'||!mountedRoot)return null;
  panel=doc.getElementById&&doc.getElementById('rc1501SopTourHost');
  if(!panel){panel=doc.createElement('div');panel.id='rc1501SopTourHost';panel.className='rc1501-sop-tour-host';panel.hidden=true;(doc.body||mountedRoot).appendChild(panel);}
  panel.addEventListener('click',onPanelClick);listeners.push([panel,'click',onPanelClick]);
  for(const type of ['click','change','input']){mountedRoot.addEventListener(type,onWorkEvent,true);listeners.push([mountedRoot,type,onWorkEvent,true]);}
  mountedRoot.addEventListener('exporthub:sop-tour-action',onCustomAction);listeners.push([mountedRoot,'exporthub:sop-tour-action',onCustomAction]);
  annotate();
  if(typeof root.MutationObserver==='function'){observer=new root.MutationObserver(()=>{annotate();highlightCurrent(root.ExportHubSopTour&&root.ExportHubSopTour.current?root.ExportHubSopTour.current():null);});observer.observe(mountedRoot,{childList:true,subtree:true});}
  paint();return {paint,reportAction,enhanceSopDocument};
}
function unmount(){
  if(observer){observer.disconnect();observer=null;}
  for(const [node,type,fn,capture] of listeners){try{node.removeEventListener(type,fn,capture);}catch(_){}}listeners=[];
  clearHighlight();if(panel){panel.innerHTML='';panel.hidden=true;}panel=null;mountedRoot=null;contextProvider=null;
}

root.ExportHubSopTourUi=Object.freeze({render,mount,unmount,paint,reportAction,eventDescriptor,hasEnabledTour,startButtonHtml,enhanceSopDocument,highlightCurrent});
})(typeof globalThis!=='undefined'?globalThis:this);
