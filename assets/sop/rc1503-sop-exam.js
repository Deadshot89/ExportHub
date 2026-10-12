(function(root){
'use strict';
if(root.ExportHubSopExam)return;

let active=null;

function text(value){return String(value==null?'':value).trim();}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function list(value){return Array.isArray(value)?value:[];}
function now(){return Date.now();}
function orderedSteps(sop){
  return list(sop&&sop.steps).map((step,index)=>({step,index})).sort((a,b)=>{
    const ao=Number.isFinite(Number(a.step&&a.step.order))?Number(a.step.order):a.index+1;
    const bo=Number.isFinite(Number(b.step&&b.step.order))?Number(b.step.order):b.index+1;
    return ao-bo||a.index-b.index;
  }).map(item=>item.step).filter(step=>step&&typeof step==='object');
}
function isRelevant(step){return !!(step&&step.exam&&step.exam.relevant===true);}
function isRequired(step){return isRelevant(step)&&step.exam.required!==false;}
function stableKeyOf(step){return text(step&&step.target&&(step.target.stableKey||step.target.key));}
function expectedActionOf(step){return text(step&&step.expectedAction).toLowerCase();}
function publicSession(){return active?clone(active):null;}
function errorEntry(type,stepId,details){
  const entry={type:text(type)};
  if(text(stepId))entry.stepId=text(stepId);
  if(details&&typeof details==='object')entry.details=clone(details);
  return entry;
}
function fail(reason,stepId,details){
  if(active)active.errors.push(errorEntry(reason,stepId,details));
  return {ok:false,reason:text(reason),stepId:text(stepId),session:publicSession()};
}
function validator(){
  const api=root.ExportHubSopTourValidator;
  return api&&typeof api.evaluateAll==='function'?api:null;
}
function validateChecks(checks,context){
  const conditions=list(checks);
  if(conditions.length===0)return {ok:true,reason:'OK',details:{count:0}};
  const api=validator();
  if(!api)return {ok:false,reason:'VALIDATOR_UNAVAILABLE',details:{}};
  try{return api.evaluateAll(conditions,context&&typeof context==='object'?context:{});}catch(error){
    return {ok:false,reason:'VALIDATOR_ERROR',details:{message:text(error&&error.message)}};
  }
}
function start(options={}){
  const sop=options.sop&&typeof options.sop==='object'?clone(options.sop):null;
  if(!sop)return {ok:false,reason:'EXAM_SOP_REQUIRED'};
  const userId=text(options.userId);
  if(!userId)return {ok:false,reason:'EXAM_USER_REQUIRED'};
  const steps=orderedSteps(sop);
  const relevantSteps=steps.filter(isRelevant);
  const requiredSteps=relevantSteps.filter(isRequired);
  const startedAt=now();
  active={
    status:'active',
    userId,
    sopNumber:text(sop.number),
    version:text(sop.version||sop.currentVersion),
    startedAt,
    completedAt:null,
    durationMs:0,
    requiredSteps:requiredSteps.map(step=>text(step.id)).filter(Boolean),
    correctSteps:[],
    errors:[],
    skippedSteps:[],
    helpCount:0,
    finalStateOk:null,
    passed:null,
    _sop:sop,
    _requiredSteps:requiredSteps,
    _cursor:0
  };
  const snapshot=publicSession();
  delete snapshot._sop;
  delete snapshot._requiredSteps;
  delete snapshot._cursor;
  return snapshot;
}
function current(){
  const snapshot=publicSession();
  if(!snapshot)return null;
  delete snapshot._sop;
  delete snapshot._requiredSteps;
  delete snapshot._cursor;
  return snapshot;
}
function recordAction(input={}){
  if(!active||active.status!=='active')return {ok:false,reason:'EXAM_NOT_ACTIVE'};
  const action=text(input.action).toLowerCase();
  const stableKey=text(input.stableKey);
  const required=list(active._requiredSteps);
  const cursor=Number(active._cursor)||0;
  const expected=required[cursor];
  if(!expected)return fail('NO_REQUIRED_STEP_PENDING','',{action,stableKey});

  const matchingLaterIndex=required.findIndex((step,index)=>index>cursor&&stableKeyOf(step)===stableKey&&expectedActionOf(step)===action);
  if(matchingLaterIndex>cursor){
    const later=required[matchingLaterIndex];
    return fail('OUT_OF_ORDER',text(later&&later.id),{expectedStepId:text(expected&&expected.id),action,stableKey});
  }

  const expectedKey=stableKeyOf(expected);
  const expectedAction=expectedActionOf(expected);
  if(action!==expectedAction||stableKey!==expectedKey){
    return fail('WRONG_ACTION',text(expected&&expected.id),{expectedAction,expectedStableKey:expectedKey,action,stableKey});
  }

  const checked=validateChecks(expected.checks,input.context);
  if(!checked.ok){
    return fail('STEP_CHECK_FAILED',text(expected&&expected.id),{validatorReason:text(checked.reason),validatorDetails:checked.details||{}});
  }

  const stepId=text(expected.id);
  if(stepId&&!active.correctSteps.includes(stepId))active.correctSteps.push(stepId);
  active._cursor=cursor+1;
  return {ok:true,reason:'OK',stepId,session:current()};
}
function requestHelp(){
  if(!active||active.status!=='active')return {ok:false,reason:'EXAM_NOT_ACTIVE'};
  active.helpCount+=1;
  return {ok:true,reason:'OK',helpCount:active.helpCount,session:current()};
}
function finish(finalContext={}){
  if(!active||active.status!=='active')return {ok:false,reason:'EXAM_NOT_ACTIVE'};
  const requiredIds=list(active.requiredSteps);
  active.skippedSteps=requiredIds.filter(id=>!active.correctSteps.includes(id));
  const finalChecks=list(active._sop&&active._sop.examConfig&&active._sop.examConfig.finalChecks);
  const finalResult=validateChecks(finalChecks,finalContext);
  active.finalStateOk=!!finalResult.ok;
  if(!finalResult.ok){
    active.errors.push(errorEntry('FINAL_STATE_FAILED','',{validatorReason:text(finalResult.reason),validatorDetails:finalResult.details||{}}));
  }
  active.completedAt=now();
  active.durationMs=Math.max(0,active.completedAt-active.startedAt);
  active.passed=active.errors.length===0&&active.skippedSteps.length===0&&active.finalStateOk;
  active.status='completed';
  const result=current();
  return result;
}

root.ExportHubSopExam=Object.freeze({start,recordAction,requestHelp,finish,current});
})(typeof globalThis!=='undefined'?globalThis:this);
