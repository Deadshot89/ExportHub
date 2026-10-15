(function(g){
'use strict';

let session=null;
function prepareScenario(value){
  if(!value||typeof value!=='object'||!value.id||!Array.isArray(value.steps)||!value.steps.length)throw new Error('TRAINING_TOUR_SCENARIO_INVALID');
  const ids=new Set();
  const steps=value.steps.map((step,index)=>{
    if(!step||typeof step!=='object'||!step.stepId)throw new Error('TRAINING_TOUR_STEP_INVALID');
    if(ids.has(step.stepId))throw new Error('TRAINING_TOUR_STEP_DUPLICATE');
    ids.add(step.stepId);
    return {...step,order:Number(step.order)||index+1,validation:Array.isArray(step.validation)?step.validation.slice():[]};
  });
  return {...value,steps};
}
function visibleStep(step){return step?{...step,validation:Array.isArray(step.validation)?step.validation.slice():[]}:null;}
function activeOrThrow(){if(!session)throw new Error('TRAINING_TOUR_NOT_ACTIVE');return session;}
function snapshot(){
  if(!session)return null;
  const total=session.scenario.steps.length;
  const currentStep=session.finished?null:session.scenario.steps[session.index];
  return Object.freeze({
    scenarioId:session.scenario.id,
    stepId:currentStep?currentStep.stepId:null,
    index:session.finished?total:session.index+1,
    total,
    progressPercent:total?Math.round(session.completed.length/total*100):0,
    paused:session.paused,
    finished:session.finished,
    completed:session.completed.map(visibleStep),
    current:visibleStep(currentStep),
    upcoming:session.finished?[]:session.scenario.steps.slice(session.index+1).map(visibleStep)
  });
}
function start({scenario,startStepId}={}){
  const prepared=prepareScenario(scenario);
  let index=0;
  if(startStepId){
    index=prepared.steps.findIndex(step=>step.stepId===startStepId);
    if(index<0)throw new Error('TRAINING_TOUR_START_STEP_UNKNOWN');
  }
  session={scenario:prepared,startIndex:index,index,paused:false,finished:false,completed:prepared.steps.slice(0,index)};
  return snapshot();
}
function validateStep(step,descriptor){
  const context={descriptor,step,scenario:session.scenario,current:snapshot()};
  for(const rule of step.validation||[]){
    try{
      if(typeof rule==='function'){if(rule(context)!==true)return false;continue;}
      if(typeof rule==='string'){if(descriptor&&descriptor.validation&&descriptor.validation[rule]===true)continue;if(descriptor&&descriptor[rule]===true)continue;return false;}
      if(rule&&typeof rule==='object'&&rule.field){if(descriptor&&descriptor[rule.field]===rule.equals)continue;return false;}
      if(rule===true)continue;
      return false;
    }catch(_){return false;}
  }
  return true;
}
function handleAction(descriptor={}){
  const s=activeOrThrow();
  if(s.finished)return {advanced:false,reason:'TOUR_COMPLETED',state:snapshot()};
  if(s.paused)return {advanced:false,reason:'TOUR_PAUSED',state:snapshot()};
  const step=s.scenario.steps[s.index];
  if(String(descriptor.action||'')!==String(step.expectedAction||''))return {advanced:false,reason:'ACTION_MISMATCH',state:snapshot(),helpText:step.helpText};
  if(String(descriptor.targetElement||'')!==String(step.targetElement||''))return {advanced:false,reason:'TARGET_MISMATCH',state:snapshot(),helpText:step.helpText};
  if(!validateStep(step,descriptor))return {advanced:false,reason:'VALIDATION_FAILED',state:snapshot(),helpText:step.helpText};
  if(!s.completed.some(done=>done.stepId===step.stepId))s.completed.push(step);
  const completedStepId=step.stepId;
  const nextId=step.nextStep;
  if(nextId==null){s.index=s.scenario.steps.length;s.finished=true;}
  else{
    const nextIndex=s.scenario.steps.findIndex(item=>item.stepId===nextId);
    if(nextIndex<0)throw new Error('TRAINING_TOUR_NEXT_STEP_UNKNOWN');
    s.index=nextIndex;
  }
  return {advanced:true,completedStepId,successText:step.successText,completed:s.finished,state:snapshot()};
}
function current(){return snapshot();}
function pause(){const s=activeOrThrow();s.paused=true;return snapshot();}
function resume(){const s=activeOrThrow();s.paused=false;return snapshot();}
function restart(){const s=activeOrThrow();s.index=s.startIndex;s.finished=false;s.paused=false;s.completed=s.scenario.steps.slice(0,s.startIndex);return snapshot();}
function end(){session=null;return null;}

g.ExportHubTrainingTourEngine=Object.freeze({start,handleAction,current,pause,resume,restart,end});
})(globalThis);
