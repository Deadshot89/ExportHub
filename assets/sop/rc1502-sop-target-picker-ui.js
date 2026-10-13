(function(root){
'use strict';
if(root.ExportHubSopTargetPickerUi)return;
const base=root.ExportHubIsoSopUi;
if(!base||typeof base.renderDocument!=='function'||typeof base.mount!=='function')return;

function text(value){return String(value==null?'':value).trim();}
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function arr(value){return Array.isArray(value)?value:[];}
function draftOf(doc){const wanted=text(doc&&doc.draftVersion);return wanted?arr(doc&&doc.versions).find(item=>text(item&&item.version)===wanted&&text(item&&item.status)==='Entwurf')||null:null;}
function stepOf(doc,stepId){const draft=draftOf(doc);return arr(draft&&draft.content&&draft.content.steps).find(step=>text(step&&step.id)===text(stepId))||null;}
function targetKey(step){return text(step&&step.target&&step.target.stableKey);}
function targetStatusMarkup(step){
  const key=targetKey(step);const status=key?'saved':'missing';const label=key?'Gespeichertes Tourziel':'Noch kein Tourziel';
  return `<div class="rc1502-sop-target" data-sop-editor-target-key="${esc(key)}"><div class="rc1502-sop-target-head"><span>Tourziel</span><span class="rc1502-sop-target-status" data-status="${status}" aria-live="polite">${esc(label)}</span></div><code>${esc(key||'—')}</code><div class="rc1502-sop-editor-step-actions"><button type="button" data-sop-editor-action="pick-target">Ziel auswählen</button><button type="button" data-sop-editor-action="test-target"${key?'':' disabled'}>Ziel testen</button><button type="button" data-sop-editor-action="cancel-target-pick">Auswahl abbrechen</button></div></div>`;
}
function injectTargets(html,doc){
  const draft=draftOf(doc);if(!draft)return String(html||'');const steps=arr(draft.content&&draft.content.steps);let out=String(html||'');
  for(const step of steps){
    const id=text(step&&step.id);if(!id)continue;const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const pattern=new RegExp(`(<article class="rc1502-sop-editor-step" data-sop-editor-step="${escaped}">[\\s\\S]*?)(</article>)`);
    out=out.replace(pattern,(match,body,close)=>body.includes('data-sop-editor-target-key=')?match:`${body}${targetStatusMarkup(step)}${close}`);
  }
  return out;
}
function activeDocument(state){const number=text(state&&state.activeNumber);return arr(state&&state.documents).find(doc=>text(doc&&doc.number)===number)||null;}
function replaceDocument(state,next){if(!state||!next)return false;const number=text(next.number);const index=arr(state.documents).findIndex(doc=>text(doc&&doc.number)===number);if(index>=0)state.documents.splice(index,1,next);else state.documents.push(next);return true;}
function persist(reason){if(typeof root.save==='function'){try{root.save(reason||'RC1502 Tourziel aktualisiert');}catch(error){if(root.console&&root.console.warn)root.console.warn('RC1502 Target Picker konnte nicht sofort speichern',error);}}}
function statusText(result){
  const error=text(result&&result.error||result&&result.code);if(result&&result.ok)return {status:'unique',message:'Tourziel eindeutig gefunden'};
  if(error==='TARGET_KEY_REQUIRED')return {status:'invalid',message:'Dieses Element besitzt keinen data-tour-key'};
  if(error==='TARGET_NOT_FOUND')return {status:'missing',message:'Tourziel wurde nicht gefunden'};
  if(error==='TARGET_AMBIGUOUS')return {status:'duplicate',message:'Tourziel ist mehrfach vorhanden'};
  return {status:'invalid',message:'Tourziel konnte nicht geprüft werden'};
}
function setStatus(row,result){const node=row&&row.querySelector?row.querySelector('.rc1502-sop-target-status'):null;if(!node)return;const state=statusText(result);node.setAttribute('data-status',state.status);node.textContent=state.message;}
function decorateRows(host,state){
  const doc=activeDocument(state);const draft=draftOf(doc);if(!host||!draft||!host.querySelectorAll)return;
  for(const row of Array.from(host.querySelectorAll('[data-sop-editor-step]'))){
    if(row.querySelector('.rc1502-sop-target'))continue;const step=stepOf(doc,row.getAttribute('data-sop-editor-step'));if(!step)continue;
    if(typeof row.insertAdjacentHTML==='function')row.insertAdjacentHTML('beforeend',targetStatusMarkup(step));
  }
}
function renderDocument(doc,options={}){return injectTargets(base.renderDocument(doc,options),doc);}
function renderWorkspace(options={}){
  const html=base.renderWorkspace(options);const docs=arr(options.documents);const active=docs.find(doc=>text(doc&&doc.number)===text(options.activeNumber))||docs[0]||null;return injectTargets(html,active);
}
function mount(target,options={}){
  const bridge=base.mount(target,options);if(!bridge)return bridge;
  const host=typeof target==='string'&&root.document?root.document.querySelector(target):target;if(!host)return bridge;
  const api=root.ExportHubSopEditor;let observer=null;
  const enhance=()=>{try{if(root.ExportHubSopTourTargets&&typeof root.ExportHubSopTourTargets.annotatePilotTargets==='function')root.ExportHubSopTourTargets.annotatePilotTargets(root.document);}catch(_){}decorateRows(host,bridge.state);};
  function rowFromEvent(event){return event&&event.target&&typeof event.target.closest==='function'?event.target.closest('[data-sop-editor-step]'):null;}
  function onPointerDown(event){const button=event&&event.target&&typeof event.target.closest==='function'?event.target.closest('[data-sop-editor-action="cancel-target-pick"]'):null;if(!button||!api||typeof api.cancelTargetPick!=='function')return;const row=rowFromEvent(event);const result=api.cancelTargetPick();setStatus(row,{ok:result.cancelled,error:result.cancelled?null:'TARGET_NOT_FOUND'});}
  function onClick(event){
    const button=event&&event.target&&typeof event.target.closest==='function'?event.target.closest('[data-sop-editor-action="pick-target"],[data-sop-editor-action="test-target"],[data-sop-editor-action="cancel-target-pick"]'):null;if(!button||!api)return;
    const action=text(button.getAttribute('data-sop-editor-action'));const row=rowFromEvent(event);if(!row)return;const stepId=text(row.getAttribute('data-sop-editor-step'));const doc=activeDocument(bridge.state);if(!doc)return;
    if(action==='cancel-target-pick'){const result=api.cancelTargetPick();setStatus(row,{ok:result.cancelled,error:result.cancelled?null:'TARGET_NOT_FOUND'});return;}
    if(action==='test-target'){
      const holder=row.querySelector('[data-sop-editor-target-key]');const key=text(holder&&holder.getAttribute('data-sop-editor-target-key'));const result=api.testTarget(key,root.document);setStatus(row,result);return;
    }
    if(action==='pick-target'){
      if(root.ExportHubSopTourTargets&&typeof root.ExportHubSopTourTargets.annotatePilotTargets==='function')root.ExportHubSopTourTargets.annotatePilotTargets(root.document);
      setStatus(row,{ok:false,code:'TARGET_KEY_REQUIRED'});const status=row.querySelector('.rc1502-sop-target-status');if(status){status.setAttribute('data-status','picking');status.textContent='Klicke jetzt das gewünschte hervorgehobene Element';}
      try{
        api.beginTargetPick(stepId,{document:doc,version:doc.draftVersion,scope:root.document,onSelected(result){replaceDocument(bridge.state,result.document);persist('RC1502 Tourziel aktualisiert');if(typeof options.onEditorChange==='function')options.onEditorChange({action:'pick-target',document:result.document,state:bridge.state});if(typeof bridge.open==='function')bridge.open(text(result.document.number));enhance();},onError(result){setStatus(row,{ok:false,error:result.code||result.error,status:result.status});}});
      }catch(error){setStatus(row,{ok:false,error:'TARGET_NOT_FOUND'});if(typeof options.onEditorError==='function')options.onEditorError(error);}
    }
  }
  host.addEventListener('pointerdown',onPointerDown,true);host.addEventListener('click',onClick);
  if(typeof root.MutationObserver==='function'){observer=new root.MutationObserver(enhance);observer.observe(host,{childList:true,subtree:true});}
  enhance();
  const originalDestroy=typeof bridge.destroy==='function'?bridge.destroy.bind(bridge):null;
  return Object.assign({},bridge,{destroy(){if(observer)observer.disconnect();host.removeEventListener('pointerdown',onPointerDown,true);host.removeEventListener('click',onClick);if(api&&typeof api.cancelTargetPick==='function')api.cancelTargetPick();if(originalDestroy)originalDestroy();}});
}

const wrapped=Object.freeze(Object.assign({},base,{renderDocument,renderWorkspace,mount}));
root.ExportHubIsoSopUi=wrapped;
root.ExportHubSopTargetPickerUi=Object.freeze({injectTargets,targetStatusMarkup,statusText,decorateRows,mount});
})(typeof globalThis!=='undefined'?globalThis:this);
