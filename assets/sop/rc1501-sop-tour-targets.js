(function(root){
'use strict';
if(root.ExportHubSopTourTargets)return;

function text(value){return String(value==null?'':value).trim();}
function escapeKey(value){return text(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"');}
function queryAll(scope,selector){
  if(!scope||typeof scope.querySelectorAll!=='function')return null;
  try{return Array.from(scope.querySelectorAll(selector)||[]);}catch(_){return null;}
}
function find(stableKey,scope){
  const key=text(stableKey);
  if(!key)return {ok:false,element:null,error:'KEY_REQUIRED'};
  const targetRoot=scope||(root&&root.document);
  const nodes=queryAll(targetRoot,`[data-tour-key="${escapeKey(key)}"]`);
  if(nodes===null)return {ok:false,element:null,error:'ROOT_UNAVAILABLE'};
  if(nodes.length===0)return {ok:false,element:null,error:'TARGET_NOT_FOUND'};
  if(nodes.length>1)return {ok:false,element:null,error:'TARGET_AMBIGUOUS'};
  return {ok:true,element:nodes[0],error:null};
}
function annotateOne(scope,selector,key,annotated,errors){
  const nodes=queryAll(scope,selector);
  if(nodes===null){errors.push({code:'ROOT_UNAVAILABLE',selector,key});return;}
  if(nodes.length===0)return;
  if(nodes.length>1){errors.push({code:'ANCHOR_AMBIGUOUS',selector,key,count:nodes.length});return;}
  const element=nodes[0];
  const existing=text(element&&typeof element.getAttribute==='function'?element.getAttribute('data-tour-key'):'');
  if(existing&&existing!==key){errors.push({code:'KEY_CONFLICT',selector,key,existing});return;}
  if(element&&typeof element.setAttribute==='function'){
    element.setAttribute('data-tour-key',key);
    if(!annotated.includes(key))annotated.push(key);
  }else errors.push({code:'TARGET_NOT_ANNOTATABLE',selector,key});
}
function annotatePilotTargets(scope){
  const targetRoot=scope||(root&&root.document);
  const annotated=[];const errors=[];
  if(!targetRoot||typeof targetRoot.querySelectorAll!=='function')return {ok:false,annotated,errors:[{code:'ROOT_UNAVAILABLE'}]};
  annotateOne(targetRoot,'[data-sop-open="SOP-EH-060"]','sop-open-SOP-EH-060',annotated,errors);
  annotateOne(targetRoot,'#rc363BlockAbdDecision','shipment-abd-decision',annotated,errors);
  return {ok:errors.length===0,annotated,errors};
}

root.ExportHubSopTourTargets=Object.freeze({find,annotatePilotTargets});
})(typeof globalThis!=='undefined'?globalThis:this);
