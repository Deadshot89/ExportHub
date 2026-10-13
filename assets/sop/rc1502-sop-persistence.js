(function(root){
'use strict';
if(root.ExportHubSopPersistence)return;
const base=root.ExportHubIsoSopUi;
if(!base||typeof base.mount!=='function')return;

function text(value){return String(value==null?'':value).trim();}
function warn(message,error){try{if(root.console&&typeof root.console.warn==='function')root.console.warn(message,error||'');}catch(_){}}
function setStatus(host,status,reason){
  if(!host||typeof host.setAttribute!=='function')return;
  host.setAttribute('data-sop-persist-status',status);
  if(reason)host.setAttribute('data-sop-persist-reason',text(reason));
  else if(typeof host.removeAttribute==='function')host.removeAttribute('data-sop-persist-reason');
}
function hasPendingChange(clean){
  const runtime=clean&&clean.runtime;
  if(!runtime)return false;
  if(runtime.pendingSave===true||runtime.dirty===true)return true;
  const changed=Number(runtime.changeGeneration||0),saved=Number(runtime.lastSavedGeneration||0);
  return changed>saved;
}
async function confirmedPersist(reason,host){
  const label=text(reason)||'RC1502 SOP-Editor bestätigt gespeichert';
  const clean=root.ExportHUBClean;
  try{
    if(!clean||typeof clean.flushSave!=='function'){
      if(typeof root.save==='function')await Promise.resolve(root.save(label));
      throw new Error('Bestätigter ExportHUB-Speicher ist nicht verfügbar');
    }
    if(typeof clean.queueSave==='function'&&!hasPendingChange(clean)){
      const queued=await Promise.resolve(clean.queueSave(label));
      if(queued===false)throw new Error('SOP-Änderung konnte nicht in die Speicherwarteschlange gestellt werden');
    }
    const stored=await Promise.resolve(clean.flushSave(label,{force:true,userInitiated:true}));
    if(stored!==true)throw new Error('SOP-Änderung wurde nicht bestätigt gespeichert');
    setStatus(host,'saved',label);
    return true;
  }catch(error){
    setStatus(host,'error',label);
    warn('RC1502 SOP-Persistenz fehlgeschlagen',error);
    return false;
  }
}
function mount(target,options={}){
  const host=typeof target==='string'&&root.document?root.document.querySelector(target):target;
  const originalChange=typeof options.onEditorChange==='function'?options.onEditorChange:null;
  let chain=Promise.resolve(true);
  function schedule(reason){
    const label=text(reason)||'RC1502 SOP-Editor bestätigt gespeichert';
    setStatus(host,'saving',label);
    chain=chain.catch(()=>false).then(()=>confirmedPersist(label,host));
    return chain;
  }
  const bridged=Object.assign({},options,{onEditorChange(change){
    const action=text(change&&change.action)||'editor-change';
    const result=schedule(`RC1502 SOP-Editor ${action}`);
    if(originalChange){try{originalChange(change);}catch(error){warn('RC1502 onEditorChange Callback fehlgeschlagen',error);}}
    return result;
  }});
  const bridge=base.mount(target,bridged);
  if(!bridge||!host)return bridge;
  function onClick(event){
    const button=event&&event.target&&typeof event.target.closest==='function'?event.target.closest('[data-sop-editor-action="create-overlay"]'):null;
    if(button)schedule('RC1502 Kunden-SOP angelegt');
  }
  host.addEventListener('click',onClick);
  const originalDestroy=typeof bridge.destroy==='function'?bridge.destroy.bind(bridge):null;
  return Object.assign({},bridge,{
    persistence(){return chain;},
    destroy(){host.removeEventListener('click',onClick);if(originalDestroy)originalDestroy();}
  });
}

const wrapped=Object.freeze(Object.assign({},base,{mount}));
root.ExportHubIsoSopUi=wrapped;
root.ExportHubSopPersistence=Object.freeze({confirmedPersist,mount});
})(typeof globalThis!=='undefined'?globalThis:this);
