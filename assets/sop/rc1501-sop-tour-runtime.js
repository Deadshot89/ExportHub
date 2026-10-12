(function(root){
'use strict';
if(root.ExportHubSopTourRuntime)return;

let mounted=false;
let uiBridge=null;
let observer=null;
let clickHandler=null;

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
function mount(){
  if(mounted)return root.ExportHubSopTourRuntime;
  if(!root.document)return null;
  const ui=root.ExportHubSopTourUi;
  if(!ui||typeof ui.mount!=='function')return null;
  uiBridge=ui.mount(root.document,{contextProvider:validationContext});
  if(!uiBridge)return null;
  clickHandler=event=>{
    const button=event&&event.target&&typeof event.target.closest==='function'?event.target.closest('[data-sop-tour-start]'):null;
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

root.ExportHubSopTourRuntime=Object.freeze({mount,unmount,startByNumber,effectiveSop,validationContext,enhanceVisibleDocuments});
autoMount();
})(typeof globalThis!=='undefined'?globalThis:this);
