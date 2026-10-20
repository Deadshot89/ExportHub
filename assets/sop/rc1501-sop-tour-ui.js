(function(root){
'use strict';
const RC1523_DE=Object.freeze({
  "common.close":"Schließen",
  "sop.tour.startGuide":"▶ Anleitung starten",
  "sop.tour.startTraining":"🎓 Training starten",
  "sop.tour.startExam":"📝 Prüfung starten",
  "sop.training.mode":"TRAININGSMODUS",
  "sop.training.noProductionChanges":"Keine produktiven Daten werden verändert.",
  "sop.training.simulation":"Simulation · Aktionen und Ergebnisse bleiben in der Demo.",
  "sop.exam.title":"SOP-Prüfung",
  "sop.exam.defaultTask":"Führe den Prozess „{{title}}“ vollständig durch.",
  "sop.exam.passed":"✅ Bestanden",
  "sop.exam.notPassed":"❌ Noch nicht bestanden",
  "sop.exam.mode":"PRÜFUNGSMODUS",
  "sop.exam.selfDirected":"Arbeite selbstständig. Während der Prüfung werden keine Lösungshinweise angezeigt.",
  "sop.exam.close":"Prüfung schließen",
  "sop.exam.task":"Aufgabe",
  "sop.exam.progress":"Prüfungsfortschritt {{correct}} von {{required}}",
  "sop.exam.countCorrectOne":"{{count}} korrekter Schritt",
  "sop.exam.countCorrectMany":"{{count}} korrekte Schritte",
  "sop.exam.countErrors":"{{count}} Fehler",
  "sop.exam.countSkipped":"{{count}} ausgelassen",
  "sop.exam.countHelpOne":"{{count}} Hilfe",
  "sop.exam.countHelpMany":"{{count}} Hilfen",
  "sop.exam.running":"Prüfung läuft",
  "sop.exam.requestHelp":"Hilfe anfordern",
  "sop.exam.finish":"Prüfung abschließen",
  "sop.exam.cancel":"Prüfung abbrechen",
  "sop.tour.guideAria":"Geführte SOP-Anleitung",
  "sop.tour.trainingAria":"Geführtes SOP-Training",
  "sop.tour.trainingTitle":"SOP-Training",
  "sop.tour.guideTitle":"SOP-Anleitung",
  "sop.tour.endTraining":"Training beenden",
  "sop.tour.endGuide":"Anleitung beenden",
  "sop.tour.progress":"Fortschritt {{percent}} Prozent",
  "sop.tour.stepProgress":"Schritt {{current}} von {{total}}",
  "sop.tour.trainingCompleted":"Training abgeschlossen",
  "sop.tour.guideCompleted":"Anleitung abgeschlossen",
  "sop.tour.trainingPaused":"Training pausiert",
  "sop.tour.guidePaused":"Anleitung pausiert",
  "sop.tour.stepCompleted":"Schritt abgeschlossen",
  "sop.tour.trainingActive":"Training aktiv",
  "sop.tour.guideActive":"Anleitung aktiv",
  "sop.tour.completedLineTraining":"✅ Training abgeschlossen.",
  "sop.tour.completedLineGuide":"✅ Anleitung abgeschlossen.",
  "sop.tour.currentTask":"Aktuelle Aufgabe",
  "sop.tour.tip":"Tipp",
  "sop.tour.previous":"Vorheriger Schritt",
  "sop.tour.continue":"Fortsetzen",
  "sop.tour.pause":"Pausieren",
  "sop.tour.openSop":"SOP öffnen",
  "sop.tour.end":"Beenden"
});
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
function interpolate(value,vars){return String(value==null?'':value).replace(/\{\{\s*([\w.-]+)\s*\}\}/g,(_,key)=>vars&&Object.prototype.hasOwnProperty.call(vars,key)?String(vars[key]):'');}
function tr(key,fallback,vars){try{const api=root.ExportHUBI18n;if(api&&typeof api.t==='function'){const value=api.t(key,vars);if(value&&value!==key)return value;}}catch(_){}return interpolate(fallback,vars);}
function th(key,fallback,vars){return esc(tr(key,fallback,vars));}
function hasEnabledTour(sop){return arr(sop&&sop.steps).some(step=>step&&step.tour&&step.tour.enabled===true);}
function hasEnabledExam(sop){return arr(sop&&sop.steps).some(step=>step&&step.exam&&step.exam.relevant===true);}
function startButtonHtml(sop){
  const tourEnabled=hasEnabledTour(sop),examEnabled=hasEnabledExam(sop);if(!tourEnabled&&!examEnabled)return '';
  const number=esc(sop&&sop.number);let html='';
  if(tourEnabled)html+=`<button type="button" data-sop-tour-start="${number}">${th('sop.tour.startGuide',RC1523_DE['sop.tour.startGuide'])}</button><button type="button" data-sop-training-start="${number}">${th('sop.tour.startTraining',RC1523_DE['sop.tour.startTraining'])}</button>`;
  if(examEnabled)html+=`<button type="button" data-sop-exam-start="${number}">${th('sop.tour.startExam',RC1523_DE['sop.tour.startExam'])}</button>`;
  return html;
}
function firstTip(step){return text(arr(step&&step.warnings)[0]||arr(step&&step.troubleshooting)[0]||'');}
function isExam(session){return text(session&&session.mode).toLowerCase()==='exam';}
function trainingHeader(session){
  if(text(session&&session.mode).toLowerCase()!=='training')return '';
  return `<div class="rc1503-sop-training-banner" data-sop-training-banner role="status" aria-live="polite"><strong>${th('sop.training.mode',RC1523_DE['sop.training.mode'])}</strong><span>${th('sop.training.noProductionChanges',RC1523_DE['sop.training.noProductionChanges'])}</span></div><div class="rc1503-sop-training-simulation" data-sop-training-simulation-label><span aria-hidden="true">🧪</span><span>${th('sop.training.simulation',RC1523_DE['sop.training.simulation'])}</span></div>`;
}
function countTranslated(value,oneKey,oneFallback,manyKey,manyFallback){const n=Math.max(0,Number(value)||0);return tr(n===1?oneKey:manyKey,n===1?oneFallback:manyFallback,{count:n});}
function renderExam(session){
  if(!session)return '';
  const required=arr(session.requiredSteps).length,correct=arr(session.correctSteps).length,errors=arr(session.errors).length,skipped=arr(session.skippedSteps).length,help=Math.max(0,Number(session.helpCount)||0),completed=session.status==='completed',percent=required?Math.min(100,Math.round((correct/required)*100)):0;
  const title=text(session.title)||text(session.sopNumber)||tr('sop.exam.title',RC1523_DE['sop.exam.title']);
  const task=text(session.task)||tr('sop.exam.defaultTask',RC1523_DE['sop.exam.defaultTask'],{title});
  const result=completed?(session.passed===true?tr('sop.exam.passed',RC1523_DE['sop.exam.passed']):tr('sop.exam.notPassed',RC1523_DE['sop.exam.notPassed'])):'';
  return `<aside class="rc1503-sop-exam-panel" data-sop-exam-shell role="complementary" aria-label="${th('sop.exam.title',RC1523_DE['sop.exam.title'])}">
    <div class="rc1503-sop-exam-banner" role="status" aria-live="polite"><strong>${th('sop.exam.mode',RC1523_DE['sop.exam.mode'])}</strong><span>${th('sop.exam.selfDirected',RC1523_DE['sop.exam.selfDirected'])}</span></div>
    <div class="rc1503-sop-exam-head"><div><span class="rc1503-sop-exam-kicker">${esc(session.sopNumber)}</span><h2>${esc(title)}</h2></div><button type="button" data-sop-exam-end aria-label="${th('sop.exam.close',RC1523_DE['sop.exam.close'])}">×</button></div>
    <section class="rc1503-sop-exam-task" aria-labelledby="rc1503SopExamTaskTitle"><h3 id="rc1503SopExamTaskTitle">${th('sop.exam.task',RC1523_DE['sop.exam.task'])}</h3><p>${esc(task)}</p></section>
    <div class="rc1503-sop-exam-progress" aria-label="${th('sop.exam.progress',RC1523_DE['sop.exam.progress'],{correct,required})}"><div><strong>${esc(tr('sop.tour.stepProgress',RC1523_DE['sop.tour.stepProgress'],{current:correct,total:required}).replace(/^Schritt\s+/,'').replace(/^Step\s+/,'').replace(/^Krok\s+/,'').replace(/^Paso\s+/,'').replace(/^Étape\s+/,'').replace(/^Passaggio\s+/,''))}</strong><span>${percent} %</span></div><progress max="100" value="${percent}">${percent} %</progress></div>
    ${completed?`<section class="rc1503-sop-exam-result" aria-live="polite"><h3>${esc(result)}</h3><div class="rc1503-sop-exam-summary"><span>${esc(countTranslated(correct,'sop.exam.countCorrectOne',RC1523_DE['sop.exam.countCorrectOne'],'sop.exam.countCorrectMany',RC1523_DE['sop.exam.countCorrectMany']))}</span><span>${esc(tr('sop.exam.countErrors',RC1523_DE['sop.exam.countErrors'],{count:errors}))}</span><span>${esc(tr('sop.exam.countSkipped',RC1523_DE['sop.exam.countSkipped'],{count:skipped}))}</span><span>${esc(countTranslated(help,'sop.exam.countHelpOne',RC1523_DE['sop.exam.countHelpOne'],'sop.exam.countHelpMany',RC1523_DE['sop.exam.countHelpMany']))}</span></div></section>`:`<div class="rc1503-sop-exam-status" role="status" aria-live="polite">${th('sop.exam.running',RC1523_DE['sop.exam.running'])}</div>`}
    <div class="rc1503-sop-exam-controls">
      ${completed?'':`<button type="button" data-sop-exam-help>${th('sop.exam.requestHelp',RC1523_DE['sop.exam.requestHelp'])}</button><button type="button" data-sop-exam-finish>${th('sop.exam.finish',RC1523_DE['sop.exam.finish'])}</button>`}
      <button type="button" data-sop-exam-end>${completed?th('common.close',RC1523_DE['common.close']):th('sop.exam.cancel',RC1523_DE['sop.exam.cancel'])}</button>
    </div>
  </aside>`;
}
function render(session){
  if(!session)return '';if(isExam(session))return renderExam(session);
  const step=session.currentStep||{},paused=session.status==='paused',completed=session.status==='completed',training=text(session.mode).toLowerCase()==='training';
  const statusText=completed?(training?tr('sop.tour.trainingCompleted',RC1523_DE['sop.tour.trainingCompleted']):tr('sop.tour.guideCompleted',RC1523_DE['sop.tour.guideCompleted'])):paused?(training?tr('sop.tour.trainingPaused',RC1523_DE['sop.tour.trainingPaused']):tr('sop.tour.guidePaused',RC1523_DE['sop.tour.guidePaused'])):session.feedback&&session.feedback.reason==='STEP_COMPLETED'?tr('sop.tour.stepCompleted',RC1523_DE['sop.tour.stepCompleted']):training?tr('sop.tour.trainingActive',RC1523_DE['sop.tour.trainingActive']):tr('sop.tour.guideActive',RC1523_DE['sop.tour.guideActive']);
  const tip=firstTip(step),percent=Number(session.percent)||0,stepNumber=Number(session.stepNumber)||0,total=Number(session.total)||0;
  return `<aside class="rc1501-sop-tour-panel${training?' rc1503-sop-training-panel':''}" role="complementary" aria-label="${training?th('sop.tour.trainingAria',RC1523_DE['sop.tour.trainingAria']):th('sop.tour.guideAria',RC1523_DE['sop.tour.guideAria'])}">
    ${trainingHeader(session)}
    <div class="rc1501-sop-tour-head"><div><span class="rc1501-sop-tour-kicker">${esc(session.sopNumber)}</span><h2>${esc(session.title||(training?tr('sop.tour.trainingTitle',RC1523_DE['sop.tour.trainingTitle']):tr('sop.tour.guideTitle',RC1523_DE['sop.tour.guideTitle'])))}</h2></div><button type="button" data-sop-tour-end aria-label="${training?th('sop.tour.endTraining',RC1523_DE['sop.tour.endTraining']):th('sop.tour.endGuide',RC1523_DE['sop.tour.endGuide'])}">×</button></div>
    <div class="rc1501-sop-tour-progress" aria-label="${th('sop.tour.progress',RC1523_DE['sop.tour.progress'],{percent})}"><div><strong>${th('sop.tour.stepProgress',RC1523_DE['sop.tour.stepProgress'],{current:stepNumber,total})}</strong><span>${percent} %</span></div><progress max="100" value="${percent}">${percent} %</progress></div>
    <div class="rc1501-sop-tour-status" role="status" aria-live="polite">${esc(statusText)}</div>
    ${completed?`<p class="rc1501-sop-tour-complete">${training?th('sop.tour.completedLineTraining',RC1523_DE['sop.tour.completedLineTraining']):th('sop.tour.completedLineGuide',RC1523_DE['sop.tour.completedLineGuide'])}</p>`:`<section class="rc1501-sop-tour-task"><h3>${th('sop.tour.currentTask',RC1523_DE['sop.tour.currentTask'])}</h3><p>${esc(step.instruction||step.title||'')}</p>${tip?`<div class="rc1501-sop-tour-tip"><strong>${th('sop.tour.tip',RC1523_DE['sop.tour.tip'])}</strong><span>${esc(tip)}</span></div>`:''}</section>`}
    <div class="rc1501-sop-tour-controls">
      <button type="button" data-sop-tour-previous${Number(session.index)<=0?' disabled':''}>${th('sop.tour.previous',RC1523_DE['sop.tour.previous'])}</button>
      <button type="button" data-sop-tour-pause>${paused?th('sop.tour.continue',RC1523_DE['sop.tour.continue']):th('sop.tour.pause',RC1523_DE['sop.tour.pause'])}</button>
      <button type="button" data-sop-tour-open-sop>${th('sop.tour.openSop',RC1523_DE['sop.tour.openSop'])}</button>
      <button type="button" data-sop-tour-end>${th('sop.tour.end',RC1523_DE['sop.tour.end'])}</button>
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
  placePanel();
}
// RC1560: The panel docks bottom-right. A highlighted target in the right column (e.g. the ABD decision in the
// shipment form) sat completely underneath it, so trainees could not click the step they were asked to do.
// Dock left whenever the target reaches into the right dock column; the check is horizontal only so it does
// not flip while the target is smooth-scrolled into view.
function placePanel(){
  if(!panel||!panel.classList)return;
  let left=false;
  if(!panel.hidden&&highlighted&&typeof highlighted.getBoundingClientRect==='function'){
    const vw=Number(root.innerWidth)||0,width=panel.offsetWidth||390,rect=highlighted.getBoundingClientRect();
    const rightZone=vw-18-width,leftZone=18+width;
    left=vw>=2*width+72&&rect.right>rightZone&&rect.left>=leftZone;
  }
  panel.classList.toggle('rc1501-sop-tour-host-left',left);
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
  if(!session){panel.innerHTML='';panel.hidden=true;clearHighlight();placePanel();return null;}
  panel.hidden=false;panel.innerHTML=render(session);highlightCurrent(session);placePanel();return session;
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
  if(typeof root.addEventListener==='function'){root.addEventListener('resize',placePanel);listeners.push([root,'resize',placePanel]);}
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
