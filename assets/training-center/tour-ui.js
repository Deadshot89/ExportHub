(function(g){
'use strict';

const CLICK_ACTIONS=new Set(['click','open-modal','close-modal','navigate','decision','save-demo','confirm']);
function engine(){const api=g.ExportHubTrainingTourEngine;if(!api||typeof api.start!=='function')throw new Error('TRAINING_TOUR_ENGINE_MISSING');return api;}
function i18n(){const api=g.ExportHubTrainingCenterI18n;if(!api||typeof api.t!=='function')throw new Error('TRAINING_CENTER_I18N_MISSING');return api;}
function tr(key,vars){return i18n().t(key,vars);}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}

function mount({root,scenario,registry,startStepId}={}){
  if(!root||!root.ownerDocument)throw new Error('TRAINING_TOUR_ROOT_REQUIRED');
  if(!registry||typeof registry.find!=='function')throw new Error('TRAINING_TOUR_REGISTRY_REQUIRED');
  const doc=root.ownerDocument;
  const win=doc.defaultView||g;
  const previousFocus=doc.activeElement&&typeof doc.activeElement.focus==='function'?doc.activeElement:null;
  let overlay=null,activeTarget=null,dialog=null,destroyed=false;
  engine().start({scenario,startStepId});

  function clearTarget(){if(activeTarget&&activeTarget.classList)activeTarget.classList.remove('training-tour-target-active');activeTarget=null;}
  function locate(){
    const state=engine().current();
    if(!state||!state.current)return null;
    return registry.find(state.current.targetElement,doc);
  }
  function positionPanel(target){
    const panel=overlay&&overlay.querySelector('[data-training-tour-panel]');
    if(!panel||!target||typeof target.getBoundingClientRect!=='function')return;
    const tr=target.getBoundingClientRect();
    const pr=panel.getBoundingClientRect();
    const vw=Math.max(doc.documentElement.clientWidth,win.innerWidth||0),vh=Math.max(doc.documentElement.clientHeight,win.innerHeight||0);
    const gap=16,margin=12;
    let left=vw-pr.width-margin,top=vh-pr.height-margin;
    if(vw-tr.right>=pr.width+gap){left=tr.right+gap;top=clamp(tr.top,margin,vh-pr.height-margin);}
    else if(tr.left>=pr.width+gap){left=tr.left-pr.width-gap;top=clamp(tr.top,margin,vh-pr.height-margin);}
    else if(vh-tr.bottom>=pr.height+gap){left=clamp(tr.left,margin,vw-pr.width-margin);top=tr.bottom+gap;}
    else if(tr.top>=pr.height+gap){left=clamp(tr.left,margin,vw-pr.width-margin);top=tr.top-pr.height-gap;}
    const overlaps=!(left+pr.width<=tr.left||tr.right<=left||top+pr.height<=tr.top||tr.bottom<=top);
    if(overlaps){left=margin;top=clamp(vh-pr.height-margin,margin,vh-pr.height-margin);}
    panel.style.left=`${Math.round(left)}px`;panel.style.top=`${Math.round(top)}px`;
  }
  function progressList(state){
    const completed=(state.completed||[]).map(step=>`<li class="is-complete">✓ ${esc(step.title||step.stepId)}</li>`).join('');
    const current=state.current?`<li class="is-current" aria-current="step">${esc(state.current.title||state.current.stepId)}</li>`:'';
    const upcoming=(state.upcoming||[]).map(step=>`<li>${esc(step.title||step.stepId)}</li>`).join('');
    return completed+current+upcoming;
  }
  function render(){
    if(destroyed)return;
    clearTarget();
    const state=engine().current();
    if(!state)return;
    if(overlay)overlay.remove();
    overlay=doc.createElement('div');
    overlay.setAttribute('data-training-tour-root','');
    overlay.className='training-tour-root';
    const step=state.current;
    overlay.innerHTML=`
      <div class="training-tour-banner" role="status" aria-live="polite">
        <strong>${esc(tr('tour.bannerTitle'))}</strong>
        <span>${esc(tr('tour.bannerText'))}</span>
      </div>
      <aside class="training-tour-panel" data-training-tour-panel aria-label="${esc(tr('tour.label'))}">
        <div class="training-tour-progress"><span>${esc(tr('tour.progress',{index:state.index,total:state.total}))}</span><strong>${state.progressPercent} %</strong></div>
        <div class="training-tour-meter" aria-hidden="true"><i style="width:${state.progressPercent}%"></i></div>
        ${step?`<h2>${esc(step.title||step.stepId)}</h2><p>${esc(step.helpText||step.instruction||'')}</p>`:`<h2>${esc(tr('tour.completed'))}</h2>`}
        <ol class="training-tour-steps">${progressList(state)}</ol>
        <div class="training-tour-actions">
          <button type="button" data-tour-pause>${esc(state.paused?tr('tour.resume'):tr('tour.pause'))}</button>
          <button type="button" data-tour-restart>${esc(tr('tour.restart'))}</button>
          <button type="button" data-tour-end>${esc(tr('tour.end'))}</button>
        </div>
      </aside>`;
    root.appendChild(overlay);
    if(step){
      try{activeTarget=locate();if(activeTarget&&activeTarget.classList)activeTarget.classList.add('training-tour-target-active');positionPanel(activeTarget);}catch(error){overlay.setAttribute('data-training-target-error',String(error&&error.message||error));}
    }
    overlay.querySelector('[data-tour-pause]')?.addEventListener('click',()=>{const s=engine().current();if(s?.paused)engine().resume();else engine().pause();render();});
    overlay.querySelector('[data-tour-restart]')?.addEventListener('click',()=>{engine().restart();render();});
    overlay.querySelector('[data-tour-end]')?.addEventListener('click',showEndDialog);
  }
  function descriptorFromEvent(event,step,targetKey){
    let action=event.type;
    if(event.type==='click'&&CLICK_ACTIONS.has(step.expectedAction))action=step.expectedAction;
    else if(event.type==='change'&&step.expectedAction==='select')action='select';
    else if(event.type==='change'&&step.expectedAction==='upload-demo')action='upload-demo';
    const node=event.target;
    return {action,targetElement:targetKey,valid:true,value:node&&'value' in node?node.value:undefined,checked:node&&'checked' in node?node.checked:undefined,eventType:event.type};
  }
  function applyDemo(step,eventTarget){
    if(!step||!step.demoOperation)return;
    const guard=g.ExportHubTrainingWriteGuard;
    if(!guard||typeof guard.execute!=='function')throw new Error('TRAINING_WRITE_GUARD_MISSING');
    const payload=typeof step.demoPayload==='function'?step.demoPayload(eventTarget):step.demoPayload;
    guard.execute({mode:'training',operation:step.demoOperation,payload});
  }
  function onInteraction(event){
    if(destroyed||!engine().current()?.current)return;
    const node=event.target&&typeof event.target.closest==='function'?event.target.closest('[data-training-target]'):null;
    if(!node)return;
    const state=engine().current(),step=state.current,targetKey=node.getAttribute('data-training-target')||'';
    if(step.expectedAction==='save-demo'){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    const descriptor=descriptorFromEvent(event,step,targetKey);
    const result=engine().handleAction(descriptor);
    if(result.advanced){applyDemo(step,node);render();}
  }
  function closeDialog(){if(dialog){dialog.remove();dialog=null;}overlay?.querySelector('[data-tour-end]')?.focus();}
  function showEndDialog(){
    if(dialog)return;
    dialog=doc.createElement('div');
    dialog.className='training-tour-confirm';
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',tr('tour.endAria'));
    dialog.innerHTML=`<div class="training-tour-confirm__card"><h2>${esc(tr('tour.confirmTitle'))}</h2><p>${esc(tr('tour.confirmText'))}</p><div><button type="button" data-tour-cancel>${esc(tr('tour.cancel'))}</button><button type="button" data-tour-confirm-end>${esc(tr('tour.end'))}</button></div></div>`;
    root.appendChild(dialog);
    dialog.querySelector('[data-tour-cancel]')?.addEventListener('click',closeDialog);
    dialog.querySelector('[data-tour-confirm-end]')?.addEventListener('click',end);
    dialog.querySelector('[data-tour-cancel]')?.focus();
  }
  function onKey(event){if(event.key==='Escape'&&!dialog){event.preventDefault();showEndDialog();}}
  function onResize(){if(activeTarget)positionPanel(activeTarget);}
  function end(){
    if(destroyed)return;
    destroyed=true;clearTarget();dialog?.remove();overlay?.remove();dialog=null;overlay=null;
    doc.removeEventListener('click',onInteraction,true);doc.removeEventListener('input',onInteraction,true);doc.removeEventListener('change',onInteraction,true);doc.removeEventListener('keydown',onKey,true);win.removeEventListener?.('resize',onResize);
    engine().end();
    try{previousFocus?.focus();}catch(_){}
  }
  doc.addEventListener('click',onInteraction,true);doc.addEventListener('input',onInteraction,true);doc.addEventListener('change',onInteraction,true);doc.addEventListener('keydown',onKey,true);win.addEventListener?.('resize',onResize);
  render();
  return Object.freeze({end,pause:()=>{engine().pause();render();},resume:()=>{engine().resume();render();},restart:()=>{engine().restart();render();},state:()=>engine().current()});
}

g.ExportHubTrainingTourUi=Object.freeze({mount});
})(globalThis);
