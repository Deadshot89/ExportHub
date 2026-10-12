(function(root){
'use strict';
if(root.ExportHubSopStepContract)return;

function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function text(value){return String(value==null?'':value).trim();}
function arr(value){return Array.isArray(value)?clone(value):[];}
function obj(value){return value&&typeof value==='object'&&!Array.isArray(value)?clone(value):{};}
function normalizeTarget(value){
  const source=obj(value);
  const target={stableKey:text(source.stableKey),selector:text(source.selector)};
  const type=text(source.type);
  if(type)target.type=type;
  return target;
}

function normalizeStep(step,index){
  const position=Number.isInteger(index)&&index>=0?index:0;
  const source=typeof step==='string'?{text:step}:(step&&typeof step==='object'?clone(step):{});
  const fallbackId=`step-${position+1}`;
  const target=normalizeTarget(source.target);
  const tour=Object.assign({enabled:false,highlight:false,blockWrongNavigation:false},obj(source.tour));
  const training=Object.assign({enabled:false,sideEffectPolicy:'sandbox'},obj(source.training));
  const exam=Object.assign({relevant:false,weight:1,allowHint:false},obj(source.exam));
  return {
    id:text(source.id)||fallbackId,
    order:Number.isFinite(Number(source.order))&&Number(source.order)>0?Number(source.order):position+1,
    title:text(source.title),
    instruction:text(source.instruction||source.text),
    page:text(source.page),
    target,
    expectedAction:text(source.expectedAction),
    field:source.field==null?null:clone(source.field),
    inputRule:source.inputRule==null?null:clone(source.inputRule),
    checks:arr(source.checks),
    expectedResult:text(source.expectedResult),
    warnings:arr(source.warnings),
    commonErrors:arr(source.commonErrors),
    troubleshooting:arr(source.troubleshooting),
    visuals:arr(source.visuals),
    tour,
    training,
    exam
  };
}

function normalizeSteps(steps){
  return (Array.isArray(steps)?steps:[]).map((step,index)=>normalizeStep(step,index));
}

function validateSteps(steps){
  const normalized=normalizeSteps(steps);
  const errors=[];
  const seen=new Set();
  for(const step of normalized){
    if(!text(step.id)){errors.push('Step-ID fehlt');continue;}
    if(seen.has(step.id))errors.push(`Step-ID doppelt: ${step.id}`);
    seen.add(step.id);
  }
  return {ok:errors.length===0,errors,steps:normalized};
}

root.ExportHubSopStepContract=Object.freeze({normalizeStep,normalizeSteps,validateSteps});
})(typeof globalThis!=='undefined'?globalThis:this);
