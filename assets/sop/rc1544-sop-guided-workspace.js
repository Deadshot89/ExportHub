(function(root){
'use strict';
if(root.ExportHubSopGuidedWorkspace)return;

function text(value){return String(value==null?'':value).trim();}
function arr(value){return Array.isArray(value)?value:[];}
function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}}
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function unique(values){const seen=new Set();return arr(values).filter(item=>{const key=typeof item==='string'?item:JSON.stringify(item);if(seen.has(key))return false;seen.add(key);return true;});}
function tr(key,vars){
  try{
    if(root.ExportHUBI18n&&typeof root.ExportHUBI18n.t==='function'){
      const value=root.ExportHUBI18n.t(key,vars);
      if(value)return value;
    }
  }catch(_){}
  let value=String(key||'');
  for(const [name,replacement] of Object.entries(vars||{}))value=value.replaceAll(`{{${name}}}`,String(replacement));
  return value;
}

function currentVersionRecord(doc){
  try{
    const api=root.ExportHubIsoSopModel;
    if(api&&typeof api.currentVersionRecord==='function'){
      const record=api.currentVersionRecord(doc);
      if(record)return record;
    }
  }catch(_){}
  const versions=arr(doc&&doc.versions);
  if(!versions.length)return null;
  const wanted=text(doc&&doc.currentVersion||doc&&doc.version||doc&&doc.draftVersion);
  if(wanted){const exact=versions.find(item=>text(item&&item.version)===wanted);if(exact)return exact;}
  return versions[versions.length-1]||null;
}
function sectionsOf(doc){
  const version=currentVersionRecord(doc);
  if(version&&version.content&&typeof version.content==='object')return version.content;
  return doc&&doc.sections&&typeof doc.sections==='object'?doc.sections:{};
}
function visualsOf(doc){
  const version=currentVersionRecord(doc);
  if(version&&Array.isArray(version.visuals))return version.visuals;
  return arr(doc&&doc.visuals);
}
function versionOf(doc){
  const version=currentVersionRecord(doc);
  return text(version&&version.version)||text(doc&&doc.currentVersion)||text(doc&&doc.version)||'1.0';
}

function fallbackNormalizeStep(step,index){
  const source=typeof step==='string'?{text:step}:(step&&typeof step==='object'?clone(step):{});
  const instruction=text(source.instruction||source.text||source.description||source.action);
  return {
    ...source,
    id:text(source.id)||`step-${index+1}`,
    order:Number.isFinite(Number(source.order))?Number(source.order):index+1,
    title:text(source.title)||instruction||tr('sop.guided.stepLabel',{number:index+1}),
    instruction,
    checks:arr(source.checks||source.check),
    warnings:arr(source.warnings||source.warning),
    commonErrors:arr(source.commonErrors),
    troubleshooting:arr(source.troubleshooting),
    visuals:arr(source.visuals),
    expectedResult:text(source.expectedResult),
    required:source.required!==false&&source.optional!==true
  };
}
function normalizeStep(step,index){
  let normalized=null;
  try{
    const contract=root.ExportHubSopStepContract;
    if(contract&&typeof contract.normalizeStep==='function')normalized=contract.normalizeStep(step,index);
  }catch(_){}
  const source=typeof step==='string'?{text:step}:(step&&typeof step==='object'?step:{});
  const base=normalized||fallbackNormalizeStep(step,index);
  const instruction=text(base.instruction||source.instruction||source.text||source.description||source.action);
  return {
    ...clone(base),
    id:text(base.id)||text(source.id)||`step-${index+1}`,
    order:Number.isFinite(Number(base.order))?Number(base.order):index+1,
    title:text(base.title)||text(source.title)||instruction||tr('sop.guided.stepLabel',{number:index+1}),
    instruction,
    checks:arr(base.checks).length?arr(base.checks):arr(source.checks||source.check),
    warnings:arr(base.warnings).length?arr(base.warnings):arr(source.warnings||source.warning),
    commonErrors:arr(base.commonErrors).length?arr(base.commonErrors):arr(source.commonErrors),
    troubleshooting:arr(base.troubleshooting).length?arr(base.troubleshooting):arr(source.troubleshooting),
    expectedResult:text(base.expectedResult||source.expectedResult),
    visuals:arr(base.visuals).length?arr(base.visuals):arr(source.visuals),
    required:source.required!==false&&source.optional!==true
  };
}
function attachVisuals(doc,steps){
  const documentVisuals=visualsOf(doc).filter(visual=>visual&&text(visual.type)!=='process');
  return steps.map(step=>{
    const linked=documentVisuals.filter(visual=>text(visual&&visual.stepId)===step.id);
    return {...step,visuals:unique(arr(step.visuals).concat(linked))};
  });
}
function documentModel(doc){
  const sections=sectionsOf(doc);
  const steps=attachVisuals(doc,arr(sections.steps).map(normalizeStep));
  const version=currentVersionRecord(doc);
  return {
    number:text(doc&&doc.number||doc&&doc.id),
    title:text(doc&&doc.title||doc&&doc.name),
    area:text(doc&&doc.area||doc&&doc.type),
    version:versionOf(doc),
    status:text(version&&version.status||doc&&doc.status),
    prerequisites:arr(sections.prerequisites||doc&&doc.prerequisites||doc&&doc.requirements),
    checks:arr(sections.checks||doc&&doc.checks),
    deviations:arr(sections.deviations||doc&&doc.deviations),
    resources:arr(sections.resources||doc&&doc.resources),
    responsibilities:arr(sections.responsibilities||doc&&doc.responsibilities),
    portalUrl:text(doc&&doc.portalUrl||sections.portalUrl),
    portal:text(doc&&doc.portal||sections.portal),
    steps,
    source:doc
  };
}

function progressState(steps,stored){
  const list=arr(steps),ids=new Set(list.map(step=>text(step&&step.id)).filter(Boolean));
  const source=stored&&typeof stored==='object'?stored:{};
  const completed={};
  if(source.completed&&typeof source.completed==='object'){
    for(const [id,value] of Object.entries(source.completed))if(ids.has(id)&&value!==undefined&&value!==false)completed[id]=value;
  }
  let currentStep=Number.isFinite(Number(source.currentStep))?Math.trunc(Number(source.currentStep)):0;
  currentStep=Math.max(0,Math.min(Math.max(0,list.length-1),currentStep));
  return {currentStep,completed};
}
function isCompleted(progress,step){return !!(progress&&progress.completed&&Object.prototype.hasOwnProperty.call(progress.completed,text(step&&step.id)));}
function canOpenStep(steps,progress,index){
  const list=arr(steps);if(index<0||index>=list.length)return false;
  for(let i=0;i<index;i++)if(list[i]&&list[i].required!==false&&!isCompleted(progress,list[i]))return false;
  return true;
}
function completeStep(steps,progress,index){
  const list=arr(steps);const next=progressState(list,progress);
  if(index<0||index>=list.length||!canOpenStep(list,next,index))return next;
  const id=text(list[index]&&list[index].id);if(id)next.completed[id]=new Date().toISOString();
  if(index<list.length-1&&canOpenStep(list,next,index+1))next.currentStep=index+1;else next.currentStep=index;
  return next;
}

function renderNavigation(steps,progress){
  const list=arr(steps);const state=progressState(list,progress);
  return `<nav class="rc1544-sop-steps" aria-label="${esc(tr('sop.guided.steps'))}">${list.map((step,index)=>{
    const active=index===state.currentStep,done=isCompleted(state,step),allowed=canOpenStep(list,state,index);
    const stepState=done?'done':active?'active':allowed?'open':'locked';
    return `<button type="button" class="rc1544-sop-step${active?' is-active':''}${done?' is-done':''}" data-sop-guided-step="${esc(step.id)}" data-step-index="${index}" data-step-state="${stepState}"${active?' aria-current="step"':''}${allowed?'':` disabled aria-disabled="true"`}><span class="rc1544-sop-step-number">${done?'✓':index+1}</span><span class="rc1544-sop-step-label">${esc(step.title||step.instruction||tr('sop.guided.stepLabel',{number:index+1}))}</span>${step.required!==false?`<span class="rc1544-sop-required" aria-label="${esc(tr('sop.guided.required'))}">${esc(tr('sop.guided.required'))}</span>`:''}</button>`;
  }).join('')}</nav>`;
}
function itemText(item){return text(typeof item==='string'?item:item&&item.text||item&&item.label);}
function listBlock(title,items,kind){
  const values=arr(items).filter(item=>itemText(item));if(!values.length)return'';
  return `<section class="rc1544-sop-context-card" data-kind="${esc(kind||'info')}"><h3>${esc(title)}</h3><ul>${values.map(item=>`<li>${esc(itemText(item))}</li>`).join('')}</ul></section>`;
}
function renderContext(model,step){
  const current=step||{};const warnings=arr(current.warnings).concat(arr(current.commonErrors));
  return `<aside class="rc1544-sop-context" aria-label="${esc(tr('sop.guided.context'))}">${listBlock(tr('sop.guided.requiredInfo'),model&&model.prerequisites,'required')}${listBlock(tr('sop.guided.check'),arr(current.checks),'check')}${text(current.expectedResult)?`<section class="rc1544-sop-context-card" data-kind="result"><h3>${esc(tr('sop.guided.expectedResult'))}</h3><p>${esc(current.expectedResult)}</p></section>`:''}${listBlock(tr('sop.guided.risk'),warnings,'warning')}${listBlock(tr('sop.guided.completionCheck'),model&&model.checks,'check')}${listBlock(tr('sop.guided.deviations'),model&&model.deviations,'warning')}</aside>`;
}

function applicationState(){try{return typeof root.__EXPORTHUB_GET_STATE__==='function'?(root.__EXPORTHUB_GET_STATE__()||{}):{};}catch(_){return {};}}
function sourceDocuments(options){
  const state=applicationState();
  if(Array.isArray(state.isoSops)&&state.isoSops.length)return state.isoSops;
  if(Array.isArray(options&&options.documents)&&options.documents.length)return options.documents;
  return arr(root.ExportHubIsoSopCatalog&&root.ExportHubIsoSopCatalog.documents);
}
function findDocument(options,number){
  const list=sourceDocuments(options);const stored=list.find(doc=>text(doc&&doc.number)===text(number));
  if(stored)return stored;
  try{const catalog=root.ExportHubIsoSopCatalog;if(catalog&&typeof catalog.get==='function')return catalog.get(number)||null;}catch(_){}
  return null;
}
function sessionKey(model){return `exporthub:sop-guided:${encodeURIComponent(model.number)}:${encodeURIComponent(model.version)}`;}
function readSession(model){
  try{const raw=root.sessionStorage&&root.sessionStorage.getItem(sessionKey(model));return progressState(model.steps,raw?JSON.parse(raw):null);}catch(_){return progressState(model.steps,null);}
}
function writeSession(model,progress){
  try{if(root.sessionStorage)root.sessionStorage.setItem(sessionKey(model),JSON.stringify(progressState(model.steps,progress)));}catch(_){}
}
function supportingNodes(documentNode,workSection){
  return Array.from(documentNode.children).filter(node=>node!==workSection&&!node.classList.contains('rc1007-sop-doc-actions')&&!node.classList.contains('rc1544-sop-guided'));
}

function decorateDocument(host,options){
  if(!host||!host.querySelector)return false;
  const documentNode=host.querySelector('.rc1007-sop-document[data-sop-number]');
  if(!documentNode||documentNode.hasAttribute('data-rc1544-decorated'))return false;
  const number=text(documentNode.getAttribute('data-sop-number'));const doc=findDocument(options,number);if(!doc)return false;
  const model=documentModel(doc);if(!model.steps.length){documentNode.setAttribute('data-rc1544-decorated','empty');return false;}
  const workSection=documentNode.querySelector('#work-steps');const workList=workSection&&workSection.querySelector('.rc1007-sop-steps');if(!workSection||!workList)return false;
  documentNode.setAttribute('data-rc1544-decorated','true');
  let progress=readSession(model);if(!canOpenStep(model.steps,progress,progress.currentStep))progress.currentStep=0;

  const shell=root.document.createElement('section');shell.className='rc1544-sop-guided';shell.setAttribute('data-rc1544-guided','');
  shell.innerHTML=`<header class="rc1544-sop-guided-head"><div><p class="rc1544-sop-eyebrow">${esc(model.area||'SOP')}</p><h1>${esc(model.title)}</h1><p>${esc(model.number)} · <span data-sop-guided-version-label>${esc(tr('sop.guided.version'))}</span> ${esc(model.version)}</p></div><div class="rc1544-sop-progress-wrap"><div class="rc1544-sop-progress-text"><strong data-sop-guided-count></strong><span data-sop-guided-percent></span></div><progress class="rc1544-sop-progress" max="100" value="0"></progress><div class="rc1544-sop-head-actions"><button type="button" data-sop-guided-catalog-toggle aria-expanded="false"></button><button type="button" data-sop-guided-support-toggle aria-expanded="false"></button></div></div></header><div class="rc1544-sop-grid"><aside class="rc1544-sop-nav"><label class="rc1544-sop-search"><span data-sop-guided-search-label></span><input type="search" data-sop-guided-search></label><div data-sop-guided-nav></div></aside><main class="rc1544-sop-main" data-sop-guided-main></main><div data-sop-guided-context></div></div><footer class="rc1544-sop-footer"><button type="button" data-sop-guided-back></button><span data-sop-guided-footer-count></span><button type="button" class="rc1544-sop-complete" data-sop-guided-complete></button><button type="button" class="rc1544-sop-next" data-sop-guided-next></button></footer>`;
  const controls=documentNode.querySelector('.rc1007-sop-doc-actions');if(controls&&controls.nextSibling)documentNode.insertBefore(shell,controls.nextSibling);else documentNode.prepend(shell);
  const main=shell.querySelector('[data-sop-guided-main]');main.appendChild(workSection);
  workSection.classList.add('rc1544-sop-active-work');
  supportingNodes(documentNode,workSection).forEach(node=>node.classList.add('rc1544-sop-supporting'));

  const outerWorkspace=host.querySelector('.rc1009-sop-workspace');const catalog=outerWorkspace&&outerWorkspace.querySelector(':scope > .rc1009-sop-sidebar');const catalogButton=shell.querySelector('[data-sop-guided-catalog-toggle]');if(catalogButton)catalogButton.setAttribute('aria-expanded',String(!!catalog&&!catalog.hidden));
  const supportNodes=Array.from(documentNode.querySelectorAll(':scope > .rc1544-sop-supporting'));

  function syncLabels(){
    const catalogButton=shell.querySelector('[data-sop-guided-catalog-toggle]');if(catalogButton)catalogButton.textContent=tr('sop.guided.catalog');
    const supportButton=shell.querySelector('[data-sop-guided-support-toggle]');if(supportButton)supportButton.textContent=tr('sop.guided.details');
    const searchLabel=shell.querySelector('[data-sop-guided-search-label]');if(searchLabel)searchLabel.textContent=tr('sop.guided.search');
    const search=shell.querySelector('[data-sop-guided-search]');if(search)search.placeholder=tr('sop.guided.searchPlaceholder');
    const back=shell.querySelector('[data-sop-guided-back]');if(back)back.textContent=tr('sop.guided.back');
    const complete=shell.querySelector('[data-sop-guided-complete]');if(complete)complete.textContent=tr('sop.guided.complete');
    const next=shell.querySelector('[data-sop-guided-next]');if(next)next.textContent=tr('sop.guided.next');
    const versionLabel=shell.querySelector('[data-sop-guided-version-label]');if(versionLabel)versionLabel.textContent=tr('sop.guided.version');
  }
  function sync(){
    progress=progressState(model.steps,progress);const index=progress.currentStep;const step=model.steps[index];
    writeSession(model,progress);syncLabels();
    shell.querySelector('[data-sop-guided-nav]').innerHTML=renderNavigation(model.steps,progress);
    shell.querySelector('[data-sop-guided-context]').innerHTML=renderContext(model,step);
    const nodes=Array.from(workList.children);nodes.forEach((node,nodeIndex)=>{
      const normalized=model.steps[nodeIndex];const visible=nodeIndex===index;node.hidden=!visible;
      if(visible)node.setAttribute('data-rc1544-active-step','true');else node.removeAttribute('data-rc1544-active-step');
      if(normalized&&!node.querySelector('.rc1007-sop-visual')&&!node.querySelector('.rc1544-sop-media-placeholder')){
        const placeholder=root.document.createElement('div');placeholder.className='rc1544-sop-media-placeholder';placeholder.setAttribute('role','note');placeholder.textContent=tr('sop.guided.missingImage');node.querySelector('.rc1007-sop-step-content')?.appendChild(placeholder);
      }else{
        const placeholder=node.querySelector('.rc1544-sop-media-placeholder');if(placeholder)placeholder.textContent=tr('sop.guided.missingImage');
      }
    });
    const done=model.steps.filter(candidate=>isCompleted(progress,candidate)).length;const percent=model.steps.length?Math.round(done/model.steps.length*100):0;
    const count=tr('sop.guided.stepOf',{current:index+1,total:model.steps.length});
    shell.querySelector('[data-sop-guided-count]').textContent=count;
    shell.querySelector('[data-sop-guided-percent]').textContent=`${percent} %`;
    shell.querySelector('.rc1544-sop-progress').value=percent;
    shell.querySelector('[data-sop-guided-footer-count]').textContent=count;
    shell.querySelector('[data-sop-guided-back]').disabled=index===0;
    shell.querySelector('[data-sop-guided-complete]').disabled=isCompleted(progress,step);
    const next=shell.querySelector('[data-sop-guided-next]');next.disabled=index>=model.steps.length-1||!canOpenStep(model.steps,progress,index+1);
  }

  function setStep(index){if(!canOpenStep(model.steps,progress,index))return false;progress.currentStep=index;sync();return true;}
  function onClick(event){
    const stepButton=event.target&&event.target.closest?event.target.closest('[data-sop-guided-step]'):null;if(stepButton){setStep(Number(stepButton.getAttribute('data-step-index')));return;}
    if(event.target&&event.target.closest&&event.target.closest('[data-sop-guided-back]')){setStep(Math.max(0,progress.currentStep-1));return;}
    if(event.target&&event.target.closest&&event.target.closest('[data-sop-guided-complete]')){progress=completeStep(model.steps,progress,progress.currentStep);sync();return;}
    if(event.target&&event.target.closest&&event.target.closest('[data-sop-guided-next]')){setStep(Math.min(model.steps.length-1,progress.currentStep+1));return;}
    const catalogToggle=event.target&&event.target.closest?event.target.closest('[data-sop-guided-catalog-toggle]'):null;if(catalogToggle&&catalog){catalog.hidden=!catalog.hidden;outerWorkspace.classList.toggle('rc1544-sop-catalog-collapsed',catalog.hidden);catalogToggle.setAttribute('aria-expanded',String(!catalog.hidden));return;}
    const supportToggle=event.target&&event.target.closest?event.target.closest('[data-sop-guided-support-toggle]'):null;if(supportToggle){const show=supportToggle.getAttribute('aria-expanded')!=='true';supportToggle.setAttribute('aria-expanded',String(show));supportNodes.forEach(node=>node.classList.toggle('is-visible',show));return;}
  }
  function onInput(event){
    const input=event.target&&event.target.matches&&event.target.matches('[data-sop-guided-search]')?event.target:null;if(!input)return;const query=text(input.value).toLowerCase();
    shell.querySelectorAll('[data-sop-guided-step]').forEach(button=>{const step=model.steps[Number(button.getAttribute('data-step-index'))];const hay=[step&&step.title,step&&step.instruction,...arr(step&&step.checks),...arr(step&&step.warnings)].map(text).join(' ').toLowerCase();button.hidden=!!query&&!hay.includes(query);});
  }
  const onLanguage=()=>sync();
  shell.addEventListener('click',onClick);shell.addEventListener('input',onInput);
  if(root.addEventListener){root.addEventListener('exporthub:language-changed',onLanguage);root.addEventListener('exporthub:sop-guided-i18n-ready',onLanguage);}
  sync();
  documentNode.__rc1544Sync=sync;
  documentNode.__rc1544Destroy=()=>{
    shell.removeEventListener('click',onClick);shell.removeEventListener('input',onInput);
    if(root.removeEventListener){root.removeEventListener('exporthub:language-changed',onLanguage);root.removeEventListener('exporthub:sop-guided-i18n-ready',onLanguage);}
  };
  return true;
}

let attempts=0;
function install(){
  const base=root.ExportHubIsoSopUi;if(!base||typeof base.mount!=='function'){
    attempts+=1;if(attempts<120&&typeof root.setTimeout==='function')root.setTimeout(install,25);return false;
  }
  if(base.__rc1544Guided)return true;
  function mount(target,options={}){
    const host=typeof target==='string'&&root.document?root.document.querySelector(target):target;const controller=base.mount(target,options);if(!host)return controller;
    let scheduled=false;const paint=()=>{if(scheduled)return;scheduled=true;Promise.resolve().then(()=>{scheduled=false;decorateDocument(host,options);});};paint();
    const observer=typeof root.MutationObserver==='function'?new root.MutationObserver(paint):null;if(observer)observer.observe(host,{childList:true,subtree:true});
    const originalDestroy=controller&&typeof controller.destroy==='function'?controller.destroy.bind(controller):null;
    return Object.assign({},controller||{},{destroy(){if(observer)observer.disconnect();host.querySelectorAll('[data-rc1544-decorated]').forEach(node=>{try{if(typeof node.__rc1544Destroy==='function')node.__rc1544Destroy();}catch(_){}});if(originalDestroy)originalDestroy();}});
  }
  const wrapped=Object.freeze(Object.assign({},base,{mount,__rc1544Guided:true}));root.ExportHubIsoSopUi=wrapped;return true;
}

const api=Object.freeze({
  documentModel,progressState,canOpenStep,completeStep,renderNavigation,renderContext,
  currentVersionRecord,sectionsOf,visualsOf,versionOf,decorateDocument,install
});
root.ExportHubSopGuidedWorkspace=api;
install();
})(typeof globalThis!=='undefined'?globalThis:this);
