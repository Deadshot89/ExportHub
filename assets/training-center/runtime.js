(function(g){
'use strict';

const BUILTIN_CATEGORIES=Object.freeze([
  Object.freeze({id:'shipping',title:'Versand'}),
  Object.freeze({id:'training',title:'Training'})
]);

function ui(){const api=g.ExportHubTrainingCenterUi;if(!api||typeof api.render!=='function')throw new Error('TRAINING_CENTER_UI_MISSING');return api;}
function store(){const api=g.ExportHubTrainingCenterStore;if(!api||typeof api.read!=='function')throw new Error('TRAINING_CENTER_STORE_MISSING');return api;}
function model(){const api=g.ExportHubTrainingCenterModel;if(!api||typeof api.normalizeCenter!=='function')throw new Error('TRAINING_CENTER_MODEL_MISSING');return api;}
function coverageDashboard(){const api=g.ExportHubTrainingCoverageDashboard;if(!api||typeof api.mount!=='function')throw new Error('TRAINING_CENTER_COVERAGE_MISSING');return api;}
function copy(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function list(value){return Array.isArray(value)?value:[];}
function text(value){return String(value==null?'':value).trim();}
function byId(values){const out=[];const seen=new Set();for(const value of list(values)){const id=text(value&&value.id);if(!id||seen.has(id))continue;seen.add(id);out.push(copy(value));}return out;}
function mergeById(primary,fallback){const first=byId(primary);const ids=new Set(first.map(item=>text(item.id)));for(const item of byId(fallback)){if(ids.has(text(item.id)))continue;ids.add(text(item.id));first.push(item);}return first;}
function builtInProcesses(){return [g.ExportHubShipmentRegistrationSop,g.ExportHubDhlExpressSop].filter(Boolean).map(copy);}
function builtInTrainings(){return [g.ExportHubTrainingScenarioFirstShipment].filter(Boolean).map(copy);}
function builtInScreenshots(){const api=g.ExportHubTrainingScreenshots;return api&&typeof api.list==='function'?api.list():[];}
function currentState(){try{return typeof g.__EXPORTHUB_GET_STATE__==='function'?(g.__EXPORTHUB_GET_STATE__()||{}):{};}catch(_){return {};}}
function translator(){const api=g.ExportHUBI18n;return api&&typeof api.t==='function'?api.t.bind(api):undefined;}

function bootstrapCenter(state={}){
  const persisted=store().read(state||{});
  const normalized=model().normalizeCenter(persisted);
  return model().normalizeCenter({
    ...normalized,
    standardProcesses:mergeById(normalized.standardProcesses,builtInProcesses()),
    customerSops:byId(normalized.customerSops),
    trainings:mergeById(normalized.trainings,builtInTrainings()),
    categories:mergeById(normalized.categories,BUILTIN_CATEGORIES),
    favorites:list(normalized.favorites),
    recents:list(normalized.recents),
    screenshots:mergeById(normalized.screenshots,builtInScreenshots()),
    learningProgress:list(normalized.learningProgress)
  });
}

function mount(root,context={}){
  if(!root||typeof root!=='object')throw new Error('TRAINING_CENTER_ROOT_MISSING');
  let center=context.center?copy(context.center):bootstrapCenter(context.state||{});
  let view={section:'standard',query:'',categoryId:''};
  let destroyed=false;
  const t=typeof context.t==='function'?context.t:translator();

  function paint(focusHint){
    if(destroyed)return;
    root.innerHTML=ui().render(center,{...view,t});
    bind();
    if(focusHint==='search'){
      const input=root.querySelector('[data-training-center-search]');
      if(input){input.focus();try{const end=input.value.length;input.setSelectionRange(end,end);}catch(_){}}
    }
  }
  function chooseSection(section,focus=false){
    if(!['standard','customer','training'].includes(section))return;
    view.section=section;
    paint();
    if(focus){const target=root.querySelector(`[data-training-center-section="${section}"]`);if(target)target.focus();}
  }
  function handleTabKey(event){
    const tabs=[...root.querySelectorAll('[data-training-center-section]')];
    const current=tabs.indexOf(event.currentTarget);
    if(current<0||!tabs.length)return;
    let next=current;
    if(event.key==='ArrowRight')next=(current+1)%tabs.length;
    else if(event.key==='ArrowLeft')next=(current-1+tabs.length)%tabs.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=tabs.length-1;
    else return;
    event.preventDefault();
    tabs[next].focus();
  }
  function bind(){
    for(const tab of root.querySelectorAll('[data-training-center-section]')){
      tab.addEventListener('click',()=>chooseSection(tab.getAttribute('data-training-center-section')));
      tab.addEventListener('keydown',handleTabKey);
    }
    const search=root.querySelector('[data-training-center-search]');
    if(search)search.addEventListener('input',(event)=>{view.query=event.target.value||'';paint('search');});
    for(const category of root.querySelectorAll('[data-training-center-category]'))category.addEventListener('click',()=>{view.categoryId=category.getAttribute('data-training-center-category')||'';paint();});
  }
  function update(next={}){
    if(next.center)center=copy(next.center);
    if(next.state)center=bootstrapCenter(next.state);
    if(next.section)view.section=next.section;
    if(Object.prototype.hasOwnProperty.call(next,'query'))view.query=String(next.query||'');
    if(Object.prototype.hasOwnProperty.call(next,'categoryId'))view.categoryId=String(next.categoryId||'');
    paint();
  }
  function destroy(){destroyed=true;root.replaceChildren();}
  function state(){return Object.freeze({...view});}

  paint();
  return Object.freeze({update,destroy,state});
}

let routeObserver=null;
let routeSession=null;
let started=false;
let routeRoot=null;

function isSopView(doc){const body=doc&&doc.body;return !!body&&text(body.getAttribute('data-exporthub-view'))==='sop';}
function resolveRoot(doc,options={}){
  if(options.root&&typeof options.root==='object')return options.root;
  if(!doc||typeof doc.querySelector!=='function')return null;
  return doc.querySelector('#content')||doc.querySelector('[data-exporthub-content]')||doc.querySelector('main');
}
function teardownRoute(){
  if(routeSession){try{routeSession.center.destroy();}catch(_){}try{routeSession.coverage.destroy();}catch(_){}routeSession=null;}
  if(routeRoot&&routeRoot.querySelector){const host=routeRoot.querySelector('[data-training-center-route]');if(host)host.remove();}
  routeRoot=null;
}
function ensureRoute(options={}){
  const doc=options.document||g.document;
  if(!doc||!isSopView(doc)){teardownRoute();return false;}
  const root=resolveRoot(doc,options);if(!root)return false;
  const existing=root.querySelector&&root.querySelector('[data-training-center-route]');
  if(existing&&routeSession&&routeRoot===root)return true;
  teardownRoute();
  root.replaceChildren();
  const route=doc.createElement('section');
  route.setAttribute('data-training-center-route','active');
  route.setAttribute('aria-label','SOP & Training Center');
  route.innerHTML='<div data-training-center-main-host></div><div data-training-center-coverage-host></div>';
  root.appendChild(route);
  const center=bootstrapCenter(typeof options.getState==='function'?options.getState():currentState());
  const t=typeof options.t==='function'?options.t:translator();
  const mainHost=route.querySelector('[data-training-center-main-host]');
  const coverageHost=route.querySelector('[data-training-center-coverage-host]');
  const centerMount=mount(mainHost,{center,t});
  const coverageMount=coverageDashboard().mount(coverageHost,{center});
  routeSession={center:centerMount,coverage:coverageMount};
  routeRoot=root;
  return true;
}
function start(options={}){
  const doc=options.document||g.document;
  if(!doc)return Object.freeze({stop});
  if(started){ensureRoute(options);return Object.freeze({stop});}
  started=true;
  ensureRoute(options);
  const Observer=options.MutationObserver||g.MutationObserver;
  if(typeof Observer==='function'){
    let scheduled=false;
    routeObserver=new Observer(()=>{
      if(scheduled)return;scheduled=true;
      const run=()=>{scheduled=false;ensureRoute(options);};
      if(typeof g.queueMicrotask==='function')g.queueMicrotask(run);else run();
    });
    const target=doc.body||doc.documentElement;
    if(target)routeObserver.observe(target,{attributes:true,attributeFilter:['data-exporthub-view'],childList:true,subtree:true});
  }
  return Object.freeze({stop});
}
function stop(){
  started=false;
  if(routeObserver){try{routeObserver.disconnect();}catch(_){}routeObserver=null;}
  teardownRoute();
}

const api=Object.freeze({mount,bootstrapCenter,start,stop});
g.ExportHubTrainingCenterRuntime=api;

if(g.document){
  const boot=()=>{try{start();}catch(error){try{console.error('Training Center start failed',error);}catch(_){}}};
  if(g.document.readyState==='loading'&&typeof g.document.addEventListener==='function')g.document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
}
})(globalThis);
