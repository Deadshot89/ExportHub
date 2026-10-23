(function(root){
'use strict';
if(root.ExportHubSopTour)return;

const STORAGE_KEY='exporthub.sopTour.resume';
let session=null;

function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function text(value){return String(value==null?'':value).trim();}
function enabledSteps(sop){return (Array.isArray(sop&&sop.steps)?sop.steps:[]).filter(step=>step&&step.tour&&step.tour.enabled===true).map(clone);}
function completedCount(){return session?new Set(session.completedStepIds||[]).size:0;}
function percent(){if(!session||!session.steps.length)return 0;return Math.round((completedCount()/session.steps.length)*100);}
function publicSession(){
  if(!session)return null;
  const index=Math.max(0,Math.min(session.index,session.steps.length-1));
  return clone({
    sopNumber:session.sopNumber,title:session.title,version:session.version,mode:session.mode,status:session.status,
    index:session.index,total:session.steps.length,stepNumber:session.steps.length?index+1:0,percent:percent(),
    completedStepIds:session.completedStepIds,wrongActions:session.wrongActions,currentStep:session.steps[index]||null,feedback:session.feedback||null
  });
}
function persist(){
  if(!session)return;
  const storage=root&&root.localStorage;
  if(!storage||typeof storage.setItem!=='function')return;
  const marker={
    sopNumber:session.sopNumber,version:session.version,mode:session.mode,index:session.index,status:session.status,
    completedStepIds:clone(session.completedStepIds),wrongActions:session.wrongActions
  };
  try{storage.setItem(STORAGE_KEY,JSON.stringify(marker));}catch(_){}
}
function clearMarker(){
  const storage=root&&root.localStorage;
  if(storage&&typeof storage.removeItem==='function'){try{storage.removeItem(STORAGE_KEY);}catch(_){}}
}
function feedback(reason,details){session.feedback={reason:text(reason),details:details&&typeof details==='object'?clone(details):{}};}

function start(options={}){
  const sop=options.sop&&typeof options.sop==='object'?options.sop:null;
  if(!sop)throw new Error('SOP fehlt');
  const steps=enabledSteps(sop);
  if(!steps.length)throw new Error('SOP besitzt keine aktivierten Tour-Schritte');
  session={
    sopNumber:text(sop.number),title:text(sop.title),version:text(sop.version||sop.currentVersion),mode:text(options.mode)||'guided',
    steps,index:0,status:'active',completedStepIds:[],wrongActions:0,feedback:null
  };
  persist();
  return publicSession();
}
function current(){return publicSession();}
function pause(){if(!session)return null;if(session.status==='active'){session.status='paused';feedback('SESSION_PAUSED');persist();}return publicSession();}
function resume(){if(!session)return null;if(session.status==='paused'){session.status='active';session.feedback=null;persist();}return publicSession();}
function end(){if(!session)return null;session.status='ended';feedback('SESSION_ENDED');clearMarker();return publicSession();}
function previous(){
  if(!session)return null;
  if(session.index>0)session.index-=1;
  if(session.status==='completed')session.status='active';
  session.feedback=null;persist();return publicSession();
}
function addCompleted(id){const value=text(id);if(value&&!session.completedStepIds.includes(value))session.completedStepIds.push(value);}
function fail(reason,details,{wrong=false}={}){
  if(wrong)session.wrongActions+=1;
  feedback(reason,details);persist();
  return {advanced:false,reason:text(reason),details:clone(details||{}),session:publicSession()};
}
function handleAction(descriptor={}){
  if(!session)return {advanced:false,reason:'SESSION_NOT_STARTED',details:{},session:null};
  if(session.status==='paused')return {advanced:false,reason:'SESSION_PAUSED',details:{},session:publicSession()};
  if(session.status==='completed')return {advanced:false,reason:'SESSION_COMPLETED',details:{},session:publicSession()};
  if(session.status!=='active')return {advanced:false,reason:'SESSION_NOT_ACTIVE',details:{},session:publicSession()};
  const step=session.steps[session.index];
  if(!step)return fail('STEP_NOT_FOUND');
  const expectedAction=text(step.expectedAction).toLowerCase();
  const actualAction=text(descriptor.action).toLowerCase();
  if(!actualAction||actualAction!==expectedAction)return fail('ACTION_MISMATCH',{expectedAction,actualAction},{wrong:true});
  const expectedTarget=text(step.target&&step.target.stableKey);
  const actualTarget=text(descriptor.stableKey);
  if(expectedTarget&&actualTarget!==expectedTarget)return fail('TARGET_MISMATCH',{expectedTarget,actualTarget},{wrong:true});
  const validator=root.ExportHubSopTourValidator;
  if(!validator||typeof validator.evaluateAll!=='function')return fail('VALIDATOR_UNAVAILABLE');
  const checks=Array.isArray(step.checks)?step.checks:[];
  const validation=validator.evaluateAll(checks,descriptor.context&&typeof descriptor.context==='object'?descriptor.context:{});
  if(!validation.ok)return fail(validation.reason,validation.details);
  addCompleted(step.id);
  session.feedback={reason:'STEP_COMPLETED',details:{stepId:text(step.id)}};
  if(session.index>=session.steps.length-1){
    session.status='completed';
  }else{
    session.index+=1;
  }
  persist();
  return {advanced:true,reason:'STEP_COMPLETED',details:{stepId:text(step.id)},session:publicSession()};
}

root.ExportHubSopTour=Object.freeze({start,pause,resume,end,previous,current,handleAction,storageKey:STORAGE_KEY});
})(typeof globalThis!=='undefined'?globalThis:this);
