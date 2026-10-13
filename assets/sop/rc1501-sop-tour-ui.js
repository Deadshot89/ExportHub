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
function hasEnabledExam(sop){return arr(sop&&sop.steps).some(step=>step&&step.exam&&step.exam.relevant===true);}
function startButtonHtml(sop){
  const tourEnabled=hasEnabledTour(sop);
  const examEnabled=hasEnabledExam(sop);
  if(!tourEnabled&&!examEnabled)return '';
  const number=esc(sop&&sop.number);
  let html='';
  if(tourEnabled)html+=`<button type="button" data-sop-tour-start="${number}">▶ Anleitung starten</button><button type="button" data-sop-training-start="${number}">🎓 Training starten</button>`;
  if(examEnabled)html+=`<button type="button" data-sop-exam-start="${number}">📝 Prüfung starten</button>`;
  return html;
}
function firstTip(step){return text(arr(step&&step.warnings)[0]||arr(step&&step.troubleshooting)[0]||'');}
function isExam(session){return text(session&&session.mode).toLowerCase()==='exam';}
function trainingHeader(session){
  if(text(session&&session.mode).toLowerCase()!=='training')return '';
  return `<div class="rc1503-sop-training-banner" data-sop-training-banner role="status" aria-live="polite"><strong>TRAININGSMODUS</strong><span>Keine produktiven Daten werden verändert.</span></div><div class="rc1503-sop-training-simulation" data-sop-training-simulation-label><span aria-hidden="true">🧪</span><span>Simulation · Aktionen und Ergebnisse bleiben in der Demo.</span></div>`;
}
function countLabel(value,singular,plural){const n=Math.max(0,Number(value)||0);return `${n} ${n===1?singular:plural}`;}
function renderExam(session){
  if(!session)return '';
  const required=arr(session.requiredSteps).length;
  const correct=arr(session.correctSteps).length;
  const errors=arr(session.errors).length;
  const skipped=arr(session.skippedSteps).length;
  const help=Math.max(0,Number(session.helpCount)||0);
  const completed=session.status==='completed';
  const percent=required?Math.min(100,Math.round((correct/required)*100)):0;
  const title=text(session.title)||text(session.sopNumber)||'SOP-Prüfung';
  const task=text(session.task)||`Führe den Prozess „${title}“ vollständig durch.`;
  const result=completed?(session.passed===true?'✅ Bestanden':'❌ Noch nicht bestanden'):'';
  return `<aside class="rc1503-sop-exam-panel" data-sop-exam-shell role="complementary" aria-label="SOP-Prüfung">
    <div class="rc1503-sop-exam-banner" role="status" aria-live="polite"><strong>PRÜFUNGSMODUS</strong><span>Arbeite selbstständig. Während der Prüfung werden keine Lösungshinweise angezeigt.</span></div>
    <div class="rc1503-sop-exam-head"><div><span class="rc1503-sop-exam-kicker">${esc(session.sopNumber)}</span><h2>${esc(title)}</h2></div><button type="button" data-sop-exam-end aria-label="Prüfung schließen">×</button></div>
    <section class="rc1503-sop-exam-task" aria-labelledby="rc1503SopExamTaskTitle"><h3 id="rc1503SopExamTaskTitle">Aufgabe</h3><p>${esc(task)}</p></section>
    <div class="rc1503-sop-exam-progress" aria-label="Prüfungsfortschritt ${correct} von ${required}"><div><strong>${correct} von ${required}</strong><span>${percent} %</span></div><progress max="100" value="${percent}">${percent} %</progress></div>
    ${completed?`<section class="rc1503-sop-exam-result" aria-live="polite"><h3>${result}</h3><div class="rc1503-sop-exam-summary"><span>${countLabel(correct,'korrekter Schritt','korrekte Schritte')}</span><span>${countLabel(errors,'Fehler','Fehler')}</span><span>${countLabel(skipped,'ausgelassen','ausgelassen')}</span><span>${countLabel(help,'Hilfe','Hilfen')}</span></div></section>`:`<div class="rc1503-sop-exam-status" role="status" aria-live="polite">Prüfung läuft</div>`}
    <div class="rc1503-sop-exam-controls">
      ${completed?'':`<button type="button" data-sop-exam-help>Hilfe anfordern</button><button type="button" data-sop-exam-finish>Prüfung abschließen</button>`}
      <button type="button" data-sop-exam-end>${completed?'Schließen':'Prüfung abbrechen'}</button>
    </div>
  </aside>`;
}
function render(session){
  if(!session)return '';
  if(isExam(session))return renderExam(session);
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
  if(isExam(session)){clearHighlight();return;}
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
function visibleSession(){
  const exam=root.ExportHubSopExam;
  const examSession=exam&&typeof exam.current==='function'?exam.current():null;
  if(examSession&&(examSession.status==='active'||examSession.status==='completed'))return examSession;
  const tour=root.ExportHubSopTour;
  return tour&&typeof tour.current==='function'?tour.current():null;
}
function paint(){
  const session=visibleSession();
  if(!panel)return session;
  if(!session){panel.innerHTML='';panel.hidden=true;clearHighlight();return null;}
  panel.hidden=false;panel.innerHTML=render(session);highlightCurrent(session);return session;
}
function reportAction(action,element,context){
  const exam=root.ExportHubSopExam;
  const examSession=exam&&typeof exam.current==='function'?exam.current():null;
  const target=element&&typeof element.closest==='function'?element.closest('[data-tour-key]'):element;
  const stableKey=text(target&&typeof target.getAttribute==='function'?target.getAttribute('data-tour-key'):'');
  if(examSession&&examSession.status==='active'&&typeof exam.recordAction==='function'){
    const result=exam.recordAction({action:text(action),stableKey,context:context&&typeof context==='object'?context:currentContext()});
    paint();return result;
  }
  const tour=root.ExportHubSopTour;
  if(!tour||typeof tour.handleAction!=='function')return null;
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
  const t=event&&event.target;
  const exam=root.ExportHubSopExam;
  const examSession=exam&&typeof exam.current==='function'?exam.current():null;
  if(t&&t.closest&&t.closest('[data-sop-exam-help]')&&examSession&&examSession.status==='active'){if(typeof exam.requestHelp==='function')exam.requestHelp();paint();return;}
  if(t&&t.closest&&t.closest('[data-sop-exam-finish]')&&examSession&&examSession.status==='active'){if(typeof exam.finish==='function')exam.finish(currentContext());paint();return;}
  if(t&&t.closest&&t.closest('[data-sop-exam-end]')&&examSession){if(typeof exam.end==='function')exam.end();paint();return;}
  const tour=root.ExportHubSopTour;if(!tour)return;
  if(t&&t.closest&&t.closest('[data-sop-tour-previous]')){tour.previous();paint();return;}
  if(t&&t.closest&&t.closest('[data-sop-tour-pause]')){const s=tour.current();if(s&&s.status==='paused')tour.resume();else tour.pause();paint();return;}
  if(t&&t.closest&&t.closest('[data-sop-tour-end]')){const s=tour.current();if(s&&text(s.mode).toLowerCase()==='training'&&root.ExportHubSopTraining&&typeof root.ExportHubSopTraining.end==='function')root.ExportHubSopTraining.end();else tour.end();paint();return;}
  if(t&&t.closest&&t.closest('[data-sop-tour-open-sop]')){try{mountedRoot&&mountedRoot.dispatchEvent&&mountedRoot.dispatchEvent(new CustomEvent('exporthub:sop-tour-open-sop',{detail:{sopNumber:tour.current()?.sopNumber}}));}catch(_){}return;}
}
function annotate(){const registry=root.ExportHubSopTourTargets;if(registry&&typeof registry.annotatePilotTargets==='function')registry.annotatePilotTargets(mountedRoot||root.document);}
function enhanceSopDocument(scope,sop){
  if(!scope||(!hasEnabledTour(sop)&&!hasEnabledExam(sop)))return false;
  const actions=typeof scope.querySelector==='function'?scope.querySelector('.rc1007-sop-doc-actions'):null;
  if(!actions||typeof actions.insertAdjacentHTML!=='function')return false;
  if(typeof actions.querySelector==='function'&&(actions.querySelector('[data-sop-tour-start]')||actions.querySelector('[data-sop-exam-start]')))return true;
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
  if(typeof root.MutationObserver==='function'){observer=new root.MutationObserver(()=>{annotate();highlightCurrent(visibleSession());});observer.observe(mountedRoot,{childList:true,subtree:true});}
  paint();return {paint,reportAction,enhanceSopDocument};
}
function unmount(){
  if(observer){observer.disconnect();observer=null;}
  for(const [node,type,fn,capture] of listeners){try{node.removeEventListener(type,fn,capture);}catch(_){}}listeners=[];
  clearHighlight();if(panel){panel.innerHTML='';panel.hidden=true;}panel=null;mountedRoot=null;contextProvider=null;
}

root.ExportHubSopTourUi=Object.freeze({render,renderExam,mount,unmount,paint,reportAction,eventDescriptor,hasEnabledTour,hasEnabledExam,startButtonHtml,enhanceSopDocument,highlightCurrent});
})(typeof globalThis!=='undefined'?globalThis:this);
