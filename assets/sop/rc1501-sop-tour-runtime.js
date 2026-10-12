(function(root){
'use strict';
if(root.ExportHubSopTourRuntime)return;

let mounted=false;
let uiBridge=null;
let observer=null;
let clickHandler=null;
let trainingAutoStarted=false;

function text(value){return String(value==null?'':value).trim();}
function state(){try{return typeof root.__EXPORTHUB_GET_STATE__==='function'?(root.__EXPORTHUB_GET_STATE__()||{}):{};}catch(_){return {};}}
function documents(){
  const catalog=root.ExportHubIsoSopCatalog;
  const canonical=Array.isArray(catalog&&catalog.documents)?catalog.documents:[];
  const current=state();
  const stored=Array.isArray(current&&current.isoSops)?current.isoSops:[];
  const model=root.ExportHubIsoSopModel;
  if(model&&typeof model.reconcileCatalog==='function'){
    try{return model.reconcileCatalog(stored,canonical);}catch(_){}
  }
  return stored.length?stored:canonical;
}
function customerId(current){
  const sh=current&&current.shipment&&typeof current.shipment==='object'?current.shipment:{};
  return text(sh.customerAccount||sh.customerId||sh.customerNumber||sh.customer||current&&current.customerId);
}
function effectiveSop(number){
  const code=text(number);
  if(!code)return null;
  const docs=documents();
  const base=docs.find(doc=>text(doc&&doc.number)===code)||root.ExportHubIsoSopCatalog?.get?.(code)||null;
  if(!base)return null;
  const overlay=root.ExportHubSopOverlay;
  if(!overlay||typeof overlay.resolve!=='function')return base;
  const resolved=overlay.resolve({documents:docs,baseSopNumber:code,customerId:customerId(state()),rights:{read:true}});
  return resolved&&resolved.ok!==false&&resolved.document?resolved.document:base;
}
function validationContext(){
  const current=state();
  const sh=current&&current.shipment&&typeof current.shipment==='object'?current.shipment:{};
  const docs=[];
  for(const key of ['documents','files','attachments'])if(Array.isArray(sh[key]))docs.push(...sh[key]);
  return {root:root.document,state:current,documents:docs};
}
function dataEnvironment(){
  if(root.__EXPORTHUB_DEMO_MODE__===true)return 'demo';
  const forced=text(root.__EXPORTHUB_FORCED_ENVIRONMENT__).toLowerCase();
  if(forced)return forced;
  const current=state();
  const named=text(current&&current._exporthubEnvironment&&current._exporthubEnvironment.name).toLowerCase();
  return named||'production';
}
function demoTrainingUrl(number){
  const code=text(number);
  try{
    const base=root.location&&root.location.href?root.location.href:'https://exporthub360.com/';
    const url=new URL('/demo.html',base);
    url.searchParams.set('sopTraining',code);
    return `${url.pathname}${url.search}`;
  }catch(_){return `/demo.html?sopTraining=${encodeURIComponent(code)}`;}
}
function enhanceVisibleDocuments(){
  if(!uiBridge||typeof uiBridge.enhanceSopDocument!=='function'||!root.document)return;
  for(const article of Array.from(root.document.querySelectorAll('.rc1007-sop-document[data-sop-number]'))){
    const sop=effectiveSop(article.getAttribute('data-sop-number'));
    if(sop)uiBridge.enhanceSopDocument(article,sop);
  }
}
function startByNumber(number){
  const sop=effectiveSop(number);
  if(!sop)throw new Error('SOP nicht gefunden: '+text(number));
  const tour=root.ExportHubSopTour;
  if(!tour||typeof tour.start!=='function')throw new Error('Tour-Engine nicht verfügbar');
  const session=tour.start({sop,mode:'guided'});
  if(uiBridge&&typeof uiBridge.paint==='function')uiBridge.paint();
  return session;
}
function startTrainingByNumber(number,options={}){
  const code=text(number);
  const environment=dataEnvironment();
  if(environment!=='demo'){
    const demoUrl=demoTrainingUrl(code);
    if(options.navigate!==false&&root.location){
      try{if(typeof root.location.assign==='function')root.location.assign(demoUrl);else root.location.href=demoUrl;}catch(_){}
    }
    return {ok:false,reason:'TRAINING_DEMO_ONLY',environment,demoUrl,routed:options.navigate!==false};
  }
  const sop=effectiveSop(code);
  if(!sop)return {ok:false,reason:'TRAINING_SOP_NOT_FOUND',environment:'demo'};
  const training=root.ExportHubSopTraining;
  if(!training||typeof training.start!=='function')return {ok:false,reason:'TRAINING_UNAVAILABLE',environment:'demo'};
  const result=training.start({sop,context:{environment:'demo',state:state()}});
  if(result&&result.ok&&uiBridge&&typeof uiBridge.paint==='function')uiBridge.paint();
  return result;
}
function maybeStartTrainingFromLocation(){
  if(trainingAutoStarted||dataEnvironment()!=='demo'||!root.location)return null;
  let number='';
  try{number=text(new URL(root.location.href).searchParams.get('sopTraining'));}catch(_){}
  if(!number)return null;
  trainingAutoStarted=true;
  return startTrainingByNumber(number,{navigate:false});
}
function mount(){
  if(mounted)return root.ExportHubSopTourRuntime;
  if(!root.document)return null;
  const ui=root.ExportHubSopTourUi;
  if(!ui||typeof ui.mount!=='function')return null;
  uiBridge=ui.mount(root.document,{contextProvider:validationContext});
  if(!uiBridge)return null;
  clickHandler=event=>{
    const target=event&&event.target&&typeof event.target.closest==='function'?event.target:null;
    const trainingButton=target&&target.closest?target.closest('[data-sop-training-start]'):null;
    if(trainingButton){
      event.preventDefault();
      event.stopPropagation();
      startTrainingByNumber(trainingButton.getAttribute('data-sop-training-start'));
      return;
    }
    const button=target&&target.closest?target.closest('[data-sop-tour-start]'):null;
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    startByNumber(button.getAttribute('data-sop-tour-start'));
  };
  root.document.addEventListener('click',clickHandler,true);
  enhanceVisibleDocuments();
  if(typeof root.MutationObserver==='function'){
    observer=new root.MutationObserver(()=>enhanceVisibleDocuments());
    observer.observe(root.document.body||root.document.documentElement,{childList:true,subtree:true});
  }
  mounted=true;
  maybeStartTrainingFromLocation();
  return root.ExportHubSopTourRuntime;
}
function unmount(){
  if(observer){observer.disconnect();observer=null;}
  if(clickHandler&&root.document)root.document.removeEventListener('click',clickHandler,true);
  clickHandler=null;
  if(root.ExportHubSopTourUi&&typeof root.ExportHubSopTourUi.unmount==='function')root.ExportHubSopTourUi.unmount();
  uiBridge=null;mounted=false;
}
function autoMount(){
  if(!root.document)return;
  const tryMount=()=>{
    if(mount())return;
    if(typeof root.setTimeout==='function')root.setTimeout(tryMount,50);
  };
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',tryMount,{once:true});else tryMount();
}

root.ExportHubSopTourRuntime=Object.freeze({mount,unmount,startByNumber,startTrainingByNumber,demoTrainingUrl,dataEnvironment,effectiveSop,validationContext,enhanceVisibleDocuments});
autoMount();
})(typeof globalThis!=='undefined'?globalThis:this);
