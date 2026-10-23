(function(root){
'use strict';
if(root.ExportHubSopVisuals)return;

const VISUAL_TYPES=Object.freeze(['screenshot','placeholder']);
const ANNOTATION_TYPES=Object.freeze(['focus','arrow','marker','caption','crop','expectedResult']);

function text(value){return String(value==null?'':value).trim();}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function array(value){return Array.isArray(value)?value:[];}
function number(value,fallback=0){const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;}
function normalizeAnnotation(annotation){
  const source=annotation&&typeof annotation==='object'?clone(annotation):{};
  const rawType=text(source.type);
  const type=rawType==='expected-result'?'expectedResult':rawType;
  return Object.assign({},source,{type});
}
function normalize(visual){
  const source=visual&&typeof visual==='object'?clone(visual):{};
  const type=text(source.type)||'screenshot';
  return Object.assign({},source,{
    type,
    stepId:text(source.stepId),
    src:text(source.src),
    caption:text(source.caption),
    required:source.required!==false,
    order:number(source.order,0),
    annotations:array(source.annotations).map(normalizeAnnotation)
  });
}
function currentVersion(document){
  const doc=document&&typeof document==='object'?document:{};
  const wanted=text(doc.currentVersion||doc.version);
  if(!wanted)return null;
  return array(doc.versions).find(version=>text(version&&version.version)===wanted)||null;
}
function stepsOf(document){
  const doc=document&&typeof document==='object'?document:{};
  const version=currentVersion(doc);
  if(version&&version.content&&Array.isArray(version.content.steps))return version.content.steps;
  if(doc.sections&&Array.isArray(doc.sections.steps))return doc.sections.steps;
  if(Array.isArray(doc.steps))return doc.steps;
  return [];
}
function rawVisualsOf(document){
  const doc=document&&typeof document==='object'?document:{};
  const version=currentVersion(doc);
  if(version&&Array.isArray(version.visuals))return version.visuals;
  return array(doc.visuals);
}
function issue(code,visual,index,extra={}){return Object.assign({code,index,stepId:text(visual&&visual.stepId)},extra);}
function validateForDocument(document){
  const stepIds=new Set(stepsOf(document).map(step=>text(step&&step.id)).filter(Boolean));
  const normalized=rawVisualsOf(document).map(normalize);
  const errors=[];
  const warnings=[];
  const orphaned=[];
  normalized.forEach((visual,index)=>{
    if(!VISUAL_TYPES.includes(visual.type))errors.push(issue('VISUAL_TYPE_UNSUPPORTED',visual,index,{type:visual.type}));
    if(!visual.stepId)errors.push(issue('STEP_ID_REQUIRED',visual,index));
    else if(!stepIds.has(visual.stepId)){
      errors.push(issue('ORPHANED_STEP_ID',visual,index));
      if(!orphaned.includes(visual.stepId))orphaned.push(visual.stepId);
    }
    if(visual.type==='screenshot'&&!visual.src)errors.push(issue('SCREENSHOT_SRC_REQUIRED',visual,index));
    if(visual.type==='placeholder')warnings.push(issue('PLACEHOLDER_VISUAL',visual,index));
    visual.annotations.forEach((annotation,annotationIndex)=>{
      if(!ANNOTATION_TYPES.includes(text(annotation&&annotation.type))){
        errors.push(issue('ANNOTATION_TYPE_UNSUPPORTED',visual,index,{annotationIndex,type:text(annotation&&annotation.type)}));
      }
    });
  });
  return {ok:errors.length===0,errors,warnings,orphaned,visuals:normalized};
}
function visualsForStep(document,stepId){
  const wanted=text(stepId);
  return rawVisualsOf(document)
    .map((visual,index)=>({visual:normalize(visual),index}))
    .filter(item=>item.visual.stepId===wanted)
    .sort((a,b)=>a.visual.order-b.visual.order||a.index-b.index)
    .map(item=>item.visual);
}

root.ExportHubSopVisuals=Object.freeze({
  VISUAL_TYPES,
  ANNOTATION_TYPES,
  normalize,
  validateForDocument,
  visualsForStep
});
})(typeof globalThis!=='undefined'?globalThis:this);
