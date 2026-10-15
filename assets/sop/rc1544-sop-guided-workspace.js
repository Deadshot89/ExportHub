(function(root){
'use strict';
if(root.ExportHubSopGuidedWorkspace)return;

function text(value){return String(value==null?'':value).trim();}
function arr(value){return Array.isArray(value)?value:[];}
function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}}
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function unique(values){const seen=new Set();return arr(values).filter(item=>{const key=typeof item==='string'?item:JSON.stringify(item);if(seen.has(key))return false;seen.add(key);return true;});}

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
    title:text(source.title)||instruction||`Schritt ${index+1}`,
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
    title:text(base.title)||text(source.title)||instruction||`Schritt ${index+1}`,
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
  return {
    number:text(doc&&doc.number||doc&&doc.id),
    title:text(doc&&doc.title||doc&&doc.name),
    area:text(doc&&doc.area||doc&&doc.type),
    version:versionOf(doc),
    status:text(currentVersionRecord(doc)&&currentVersionRecord(doc).status||doc&&doc.status),
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
  return `<nav class="rc1544-sop-steps" aria-label="SOP-Schritte">${list.map((step,index)=>{
    const active=index===state.currentStep,done=isCompleted(state,step),allowed=canOpenStep(list,state,index);
    const stepState=done?'done':active?'active':allowed?'open':'locked';
    return `<button type="button" class="rc1544-sop-step${active?' is-active':''}${done?' is-done':''}" data-sop-guided-step="${esc(step.id)}" data-step-index="${index}" data-step-state="${stepState}"${active?' aria-current="step"':''}${allowed?'':` disabled aria-disabled="true"`}><span class="rc1544-sop-step-number">${done?'✓':index+1}</span><span class="rc1544-sop-step-label">${esc(step.title||step.instruction||`Schritt ${index+1}`)}</span>${step.required!==false?'<span class="rc1544-sop-required" aria-label="Pflichtschritt">Pflicht</span>':''}</button>`;
  }).join('')}</nav>`;
}
function listBlock(title,items,kind){
  const values=arr(items).filter(item=>text(typeof item==='string'?item:item&&item.text||item&&item.label));if(!values.length)return'';
  return `<section class="rc1544-sop-context-card" data-kind="${esc(kind||'info')}"><h3>${esc(title)}</h3><ul>${values.map(item=>`<li>${esc(typeof item==='string'?item:item.text||item.label||'')}</li>`).join('')}</ul></section>`;
}
function renderContext(model,step){
  const current=step||{};const warnings=arr(current.warnings).concat(arr(current.commonErrors));
  return `<aside class="rc1544-sop-context" aria-label="Informationen zum Arbeitsschritt">${listBlock('Benötigte Informationen',model&&model.prerequisites,'required')}${listBlock('Prüfen',arr(current.checks),'check')}${text(current.expectedResult)?`<section class="rc1544-sop-context-card" data-kind="result"><h3>Erwartetes Ergebnis</h3><p>${esc(current.expectedResult)}</p></section>`:''}${listBlock('Hinweis / Risiko',warnings,'warning')}${listBlock('Abschlusskontrolle',model&&model.checks,'check')}${listBlock('Abweichungen / Klärung',model&&model.deviations,'warning')}</aside>`;
}

const api=Object.freeze({
  documentModel,progressState,canOpenStep,completeStep,renderNavigation,renderContext,
  currentVersionRecord,sectionsOf,visualsOf,versionOf
});
root.ExportHubSopGuidedWorkspace=api;
})(typeof globalThis!=='undefined'?globalThis:this);
