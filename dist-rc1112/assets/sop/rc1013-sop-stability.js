(function(root){
'use strict';
if(!root||root.__EXPORTHUB_RC1013_SOP_STABILITY__)return;
let attempts=0;
function install(){
  const ui=root.ExportHubIsoSopUI;
  if(!ui||typeof ui.mount!=='function'){
    attempts+=1;
    if(attempts<80&&typeof root.setTimeout==='function')root.setTimeout(install,25);
    return false;
  }
  if(ui.__rc1013StableMount)return true;
  const originalMount=ui.mount;
  function schedulePaint(controller){
    if(!controller||controller.__rc1013PaintScheduled)return;
    controller.__rc1013PaintScheduled=true;
    const run=function(){controller.__rc1013PaintScheduled=false;if(controller.__rc1013Destroyed)return;try{controller.refresh();}catch(error){if(root.console&&root.console.error)root.console.error('RC1013 SOP Renderfehler',error);}};
    if(typeof root.requestAnimationFrame==='function')root.requestAnimationFrame(run);else if(typeof root.queueMicrotask==='function')root.queueMicrotask(run);else root.setTimeout(run,0);
  }
  function stableMount(target,options){
    const controller=originalMount.call(ui,target,options);
    const host=typeof target==='string'&&root.document?root.document.querySelector(target):target;
    if(!controller||!host||typeof host.addEventListener!=='function')return controller;
    function onFilterCapture(event){
      const el=event&&event.target;
      const key=el&&el.getAttribute?el.getAttribute('data-sop-filter'):'';
      if(!key)return;
      event.stopImmediatePropagation();
      controller.state.filters[key]=el.value;
      schedulePaint(controller);
    }
    host.addEventListener('input',onFilterCapture,true);
    host.addEventListener('change',onFilterCapture,true);
    const originalDestroy=typeof controller.destroy==='function'?controller.destroy.bind(controller):null;
    controller.destroy=function(){
      controller.__rc1013Destroyed=true;
      host.removeEventListener('input',onFilterCapture,true);
      host.removeEventListener('change',onFilterCapture,true);
      if(originalDestroy)originalDestroy();
    };
    return controller;
  }
  Object.defineProperty(stableMount,'name',{value:'mount'});
  ui.mount=stableMount;
  ui.__rc1013StableMount=true;
  root.__EXPORTHUB_RC1013_SOP_STABILITY__=true;
  return true;
}
install();
})(typeof globalThis!=='undefined'?globalThis:this);
