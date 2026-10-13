(function(root){
'use strict';
if(root.ExportHubSopCoverageRuntime)return;

const PANEL_ID='exporthub-rc1506-sop-coverage-panel';
const HOST_ID='exporthub-rc1506-sop-coverage-host';
let controller=null;
let panel=null;
let observer=null;
let scheduled=false;

function text(value){return String(value==null?'':value).trim();}
function list(value){return Array.isArray(value)?value:[];}
function state(){
  try{return typeof root.__EXPORTHUB_GET_STATE__==='function'?(root.__EXPORTHUB_GET_STATE__()||{}):{};}catch(_){return {};}
}
function sopRights(){
  const s=state();
  const candidates=[
    s&&s.rights&&s.rights.sop,
    s&&s.currentUser&&s.currentUser.rights&&s.currentUser.rights.sop,
    root.currentUser&&root.currentUser.rights&&root.currentUser.rights.sop,
    root.__EXPORTHUB_RIGHTS__&&root.__EXPORTHUB_RIGHTS__.sop
  ];
  for(const value of candidates)if(value&&typeof value==='object')return value;
  return {};
}
function adminAllowed(scope){
  const rights=sopRights();
  if(rights.admin===true||rights.functionAdmin===true||rights.level==='admin')return true;
  const node=scope&&scope.querySelector?scope.querySelector('[data-sop-approve]'):null;
  return !!node;
}
function activeSopView(){
  if(!root.document)return null;
  const content=root.document.getElementById('content');
  if(content&&content.classList&&content.classList.contains('rc1007-sop-view'))return content;
  return root.document.querySelector?root.document.querySelector('.rc1007-sop-view'):null;
}
function documents(){
  const s=state();
  if(Array.isArray(s.isoSops)&&s.isoSops.length)return s.isoSops;
  return list(root.ExportHubIsoSopCatalog&&root.ExportHubIsoSopCatalog.documents);
}
function customers(){
  const s=state();
  const source=[...list(s.customers),...list(s.customerMaster)];
  const byId=new Map();
  for(const item of source){
    const id=text(item&&((item.id!==undefined?item.id:undefined)??item.customerId??item.account??item.customerAccount));
    if(!id)continue;
    const name=text(item&&((item.name!==undefined?item.name:undefined)??item.customerName??item.deliveryName??item.label))||id;
    if(!byId.has(id))byId.set(id,{id,name});
  }
  for(const doc of documents()){
    if(text(doc&&doc.type)!=='customer')continue;
    const id=text(doc&&doc.customerId);if(id&&!byId.has(id))byId.set(id,{id,name:id});
  }
  return Array.from(byId.values());
}
function focusStep(stepId){
  const id=text(stepId);if(!id||!root.document)return;
  const run=()=>{
    const node=root.document.getElementById(id);if(!node)return false;
    try{node.scrollIntoView({block:'center',behavior:'smooth'});}catch(_){try{node.scrollIntoView();}catch(__){}}
    try{if(!node.hasAttribute('tabindex'))node.setAttribute('tabindex','-1');node.focus({preventScroll:true});}catch(_){}
    return true;
  };
  if(run())return;
  let tries=0;const retry=()=>{tries+=1;if(run()||tries>=8)return;if(typeof root.requestAnimationFrame==='function')root.requestAnimationFrame(retry);else root.setTimeout(retry,25);};
  retry();
}
function openSop(target){
  if(!target||!text(target.sopNumber)||!root.document)return false;
  try{if(typeof root.setView==='function')root.setView('sop');}catch(_){}
  const wanted=text(target.sopNumber);
  const buttons=Array.from(root.document.querySelectorAll('[data-sop-open]'));
  const button=buttons.find(node=>text(node.getAttribute('data-sop-open'))===wanted);
  if(button&&typeof button.click==='function'){
    button.click();
    if(target.kind==='step'&&target.stepId)focusStep(target.stepId);
    return true;
  }
  try{root.__EXPORTHUB_SOP_PENDING_NAV__=JSON.parse(JSON.stringify(target));}catch(_){}
  try{
    if(typeof root.CustomEvent==='function'&&root.dispatchEvent)root.dispatchEvent(new root.CustomEvent('exporthub:sop:navigate',{detail:target}));
  }catch(_){}
  return false;
}
function destroyController(){
  if(controller&&typeof controller.destroy==='function'){try{controller.destroy();}catch(_){}}
  controller=null;
}
function ensurePanel(){
  if(!root.document)return null;
  const sopView=activeSopView();
  if(!sopView||!adminAllowed(sopView)){
    if(panel&&panel.isConnected&&panel.remove)panel.remove();
    panel=null;destroyController();return null;
  }
  if(panel&&!panel.isConnected){panel=null;destroyController();}
  if(!panel){
    panel=root.document.createElement('section');
    panel.id=PANEL_ID;
    panel.className='rc1506-coverage-admin-shell';
    panel.setAttribute('aria-label','SOPMaster Coverage Administration');
    const host=root.document.createElement('div');host.id=HOST_ID;panel.appendChild(host);
    sopView.insertBefore(panel,sopView.firstChild||null);
  }
  const api=root.ExportHubSopCoverageDashboard;
  const host=root.document.getElementById(HOST_ID);
  if(!controller&&api&&typeof api.mount==='function'&&host){
    controller=api.mount(host,{documents:documents(),customers:customers(),onNavigate:openSop});
  }
  return panel;
}
function schedule(){
  if(scheduled)return;scheduled=true;
  const run=()=>{scheduled=false;ensurePanel();};
  if(typeof root.requestAnimationFrame==='function')root.requestAnimationFrame(run);else root.setTimeout(run,0);
}
function start(){
  if(!root.document)return false;
  const begin=()=>{
    ensurePanel();
    if(typeof root.MutationObserver==='function'&&!observer){
      observer=new root.MutationObserver(schedule);
      observer.observe(root.document.body||root.document.documentElement,{childList:true,subtree:true});
    }
  };
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',begin,{once:true});else begin();
  return true;
}
function refresh(){
  ensurePanel();
  if(controller&&typeof controller.refresh==='function')return controller.refresh({documents:documents(),customers:customers()});
  return null;
}
function stop(){
  if(observer){observer.disconnect();observer=null;}
  destroyController();
  if(panel&&panel.remove)panel.remove();panel=null;
}

root.ExportHubSopCoverageRuntime=Object.freeze({start,refresh,stop,ensurePanel,openSop,adminAllowed,activeSopView,documents,customers});
start();
})(typeof globalThis!=='undefined'?globalThis:this);
