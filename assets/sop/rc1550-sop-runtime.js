(function(root){
'use strict';
if(root.ExportHubRc1550SopRuntime)return;

function applicationState(){
  try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||null;}catch(_){}
  try{if(root.ExportHUBClean&&root.ExportHUBClean.state)return root.ExportHUBClean.state;}catch(_){}
  try{if(root.appState&&typeof root.appState==='object')return root.appState;}catch(_){}
  return null;
}
function sameDocuments(a,b){
  try{return JSON.stringify(a||[])===JSON.stringify(b||[]);}catch(_){return false;}
}
function persist(reason){
  try{if(typeof root.save==='function'){root.save(reason);return true;}}catch(error){try{root.console&&root.console.warn&&root.console.warn('RC1550 SOP-State konnte nicht sofort gespeichert werden',error);}catch(_){} }
  return false;
}
function reconcileState(){
  const state=applicationState();
  const model=root.ExportHubIsoSopModel;
  const catalog=root.ExportHubSopActiveCatalog;
  if(!state||!model||typeof model.reconcileCatalog!=='function'||!catalog||!Array.isArray(catalog.documents))return {changed:false,documents:[]};
  const stored=Array.isArray(state.isoSops)?state.isoSops:[];
  let next;
  try{next=model.reconcileCatalog(stored,catalog.documents);}catch(error){try{root.console&&root.console.warn&&root.console.warn('RC1550 SOP-State-Abgleich fehlgeschlagen',error);}catch(_){}return {changed:false,documents:stored};}
  if(sameDocuments(stored,next))return {changed:false,documents:stored};
  if(Array.isArray(state.isoSops))state.isoSops.splice(0,state.isoSops.length,...next);
  else state.isoSops=next;
  persist('RC1550 aktiven SOP-Katalog bereinigt');
  return {changed:true,documents:state.isoSops};
}

const api=Object.freeze({reconcileState,applicationState});
root.ExportHubRc1550SopRuntime=api;
reconcileState();
})(typeof globalThis!=='undefined'?globalThis:this);
