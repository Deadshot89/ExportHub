(function(root){
'use strict';
if(root.ExportHubSopTraining)return;

const ALLOWED_EFFECTS=Object.freeze(['mail','avis','qr','status','pallet','external-portal']);
let active=null;

function text(value){return String(value==null?'':value).trim();}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function environmentOf(context){
  const c=context&&typeof context==='object'?context:{};
  const values=[
    c.environment,
    c.dataEnvironment,
    c._exporthubEnvironment&&c._exporthubEnvironment.name,
    c.state&&c.state._exporthubEnvironment&&c.state._exporthubEnvironment.name
  ].map(text).filter(Boolean).map(value=>value.toLowerCase());
  const unique=[...new Set(values)];
  return unique.length===1?unique[0]:'';
}
function denied(environment){
  return {ok:false,reason:'TRAINING_DEMO_ONLY',environment:environment||'',simulation:false};
}
function canStart(context){
  const environment=environmentOf(context);
  return environment==='demo'
    ?{ok:true,reason:'',environment:'demo',simulation:true}
    :denied(environment);
}
function publicSession(){
  if(!active)return null;
  return clone(active);
}
function start(options={}){
  const gate=canStart(options.context);
  if(!gate.ok)return gate;
  const sop=options.sop&&typeof options.sop==='object'?options.sop:null;
  if(!sop)return {ok:false,reason:'TRAINING_SOP_REQUIRED',environment:'demo',simulation:true};
  const tour=root.ExportHubSopTour;
  if(!tour||typeof tour.start!=='function')return {ok:false,reason:'TRAINING_TOUR_UNAVAILABLE',environment:'demo',simulation:true};
  let session;
  try{session=tour.start({sop,mode:'training'});}catch(error){
    return {ok:false,reason:'TRAINING_TOUR_START_FAILED',environment:'demo',simulation:true,message:text(error&&error.message)};
  }
  active={
    status:'active',
    environment:'demo',
    simulation:true,
    sopNumber:text(sop.number),
    version:text(sop.version||sop.currentVersion),
    startedAt:new Date().toISOString()
  };
  return {ok:true,reason:'',environment:'demo',simulation:true,session:clone(session),training:publicSession()};
}
function simulate(effect,payload){
  if(!active||active.status!=='active')return {ok:false,reason:'TRAINING_NOT_ACTIVE',environment:'demo',simulation:true};
  const name=text(effect).toLowerCase();
  if(!ALLOWED_EFFECTS.includes(name))return {ok:false,reason:'TRAINING_EFFECT_NOT_ALLOWED',environment:'demo',simulation:true,effect:name};
  return {
    ok:true,
    reason:'SIMULATED',
    simulated:true,
    simulation:true,
    environment:'demo',
    effect:name,
    externalExecuted:false,
    payload:clone(payload&&typeof payload==='object'?payload:{})
  };
}
function end(){
  if(!active)return {ok:false,reason:'TRAINING_NOT_ACTIVE',status:'idle',environment:'demo',simulation:true};
  const tour=root.ExportHubSopTour;
  let tourSession=null;
  if(tour&&typeof tour.end==='function'){
    try{tourSession=tour.end();}catch(_){}
  }
  const ended={ok:true,reason:'',status:'ended',environment:'demo',simulation:true,training:publicSession(),session:clone(tourSession)};
  active=null;
  return ended;
}

root.ExportHubSopTraining=Object.freeze({
  canStart,
  start,
  simulate,
  end,
  current:publicSession,
  allowedEffects:ALLOWED_EFFECTS
});
})(typeof globalThis!=='undefined'?globalThis:this);
