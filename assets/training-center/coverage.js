(function(g){
'use strict';

function list(value){return Array.isArray(value)?value:[];}
function text(value){return String(value==null?'':value).trim();}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function registry(){
  const api=g.ExportHubTrainingCoverageRegistry;
  if(!api||!Array.isArray(api.entries))throw new Error('TRAINING_COVERAGE_REGISTRY_MISSING');
  return api;
}
function centerOf(value){
  const source=value&&typeof value==='object'?value:{};
  return {
    standardProcesses:list(source.standardProcesses),
    customerSops:list(source.customerSops),
    trainings:list(source.trainings),
    screenshots:list(source.screenshots)
  };
}
function standardProcess(center,id){return center.standardProcesses.find(item=>text(item&&item.id)===text(id))||null;}
function stepIsComplete(step){
  if(!step||typeof step!=='object')return false;
  const requiredText=['stepId','title','shortInstruction','explanation','purpose','targetElement','expectedAction','helpText','successText'];
  if(requiredText.some(key=>!text(step[key])))return false;
  const requiredLists=['checkpoints','commonErrors','warnings','validation'];
  if(requiredLists.some(key=>!Array.isArray(step[key])||!step[key].length))return false;
  return true;
}
function relevantSteps(sop,entry){
  const steps=list(sop&&sop.steps);
  if(entry.requiredStepId)return steps.filter(step=>text(step&&step.stepId)===entry.requiredStepId);
  return steps;
}
function imagesFor(center,sop,entry){
  const wanted=text(sop&&sop.id);
  const all=center.screenshots.filter(item=>text(item&&item.processId)===wanted&&text(item&&item.src));
  if(entry.requiredStepId)return all.filter(item=>text(item&&item.stepId)===entry.requiredStepId);
  return all;
}
function imageCoverageComplete(center,sop,entry){
  if(entry.requiredImage!==true)return true;
  const steps=relevantSteps(sop,entry);
  if(!steps.length)return false;
  const images=imagesFor(center,sop,entry);
  const imageStepIds=new Set(images.map(item=>text(item&&item.stepId)).filter(Boolean));
  return steps.every(step=>imageStepIds.has(text(step&&step.stepId)));
}
function tourPresent(center,sop){
  const id=text(sop&&sop.id);
  return center.trainings.some(item=>text(item&&item.processId)===id&&list(item&&item.steps).length>0);
}
function customerOverlay(center,sop,customerId){
  const id=text(customerId);
  if(!id)return {present:false,id:'',status:''};
  const found=center.customerSops.find(item=>text(item&&item.customerId)===id&&text(item&&item.baseProcessId)===text(sop&&sop.id))||null;
  return found?{present:true,id:text(found.id),status:text(found.status)}:{present:false,id:'',status:''};
}
function evaluate(entry,center,options={}){
  const row={
    id:entry.id,
    title:entry.title,
    area:entry.area,
    standardProcessId:entry.standardProcessId,
    requiredStepId:entry.requiredStepId||'',
    status:'missing',
    reasons:[],
    version:'',
    capabilities:{tour:false,image:false},
    customerOverlay:{present:false,id:'',status:''}
  };
  const sop=standardProcess(center,entry.standardProcessId);
  if(!sop){row.reasons.push('SOP_MISSING');return row;}
  row.version=text(sop.version);
  row.customerOverlay=customerOverlay(center,sop,options.customerId);
  const steps=relevantSteps(sop,entry);
  const released=text(sop.status)==='released';
  const structureOk=steps.length>0&&steps.every(stepIsComplete);
  const imageOk=imageCoverageComplete(center,sop,entry);
  const hasTour=tourPresent(center,sop);
  row.capabilities.image=imageOk;
  row.capabilities.tour=hasTour;
  if(!released)row.reasons.push('SOP_NOT_RELEASED');
  if(!structureOk)row.reasons.push('STEP_INCOMPLETE');
  if(entry.requiredImage===true&&!imageOk)row.reasons.push('IMAGE_MISSING');
  if(entry.tourRequired===true&&!hasTour)row.reasons.push('TOUR_MISSING');
  row.status=row.reasons.length?'incomplete':'complete';
  return row;
}
function scan(value,options={}){
  const center=centerOf(value);
  const entries=Array.isArray(options.entries)?options.entries:registry().entries;
  const items=entries.map(entry=>evaluate(entry,center,options));
  const counts={
    total:items.length,
    missing:items.filter(item=>item.status==='missing').length,
    incomplete:items.filter(item=>item.status==='incomplete').length,
    complete:items.filter(item=>item.status==='complete').length,
    tour:items.filter(item=>item.capabilities.tour).length,
    image:items.filter(item=>item.capabilities.image).length
  };
  const percentage=counts.total?Math.round((counts.complete/counts.total)*100):100;
  return {items:clone(items),counts,percentage};
}

g.ExportHubTrainingCoverage=Object.freeze({scan,evaluate});
})(globalThis);
