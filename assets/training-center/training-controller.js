(function(g){
'use strict';

let session={mode:'idle',paused:false,trainingId:null,scenario:null};
function state(){const api=g.ExportHubTrainingState;if(!api||typeof api.start!=='function')throw new Error('TRAINING_STATE_MISSING');return api;}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function status(){return Object.freeze(clone({mode:session.mode,paused:session.paused,trainingId:session.trainingId}));}
function snapshot(){
  const api=state();
  return Object.freeze(clone({
    active:typeof api.isActive==='function'?api.isActive():session.mode==='training',
    mode:session.mode,
    paused:session.paused,
    trainingId:session.trainingId,
    data:typeof api.snapshot==='function'?api.snapshot():null
  }));
}
function start(scenario){
  if(!scenario||typeof scenario!=='object'||!scenario.id)throw new Error('TRAINING_SCENARIO_REQUIRED');
  const stored=clone(scenario);
  session={mode:'training',paused:false,trainingId:String(stored.id),scenario:stored};
  state().start(stored.demoSeed||{});
  return status();
}
function requireActive(){if(session.mode!=='training')throw new Error('TRAINING_SESSION_NOT_ACTIVE');}
function pause(){requireActive();session.paused=true;return status();}
function resume(){requireActive();session.paused=false;return status();}
function restart(){
  requireActive();
  state().start((session.scenario&&session.scenario.demoSeed)||{});
  session.paused=false;
  return status();
}
function end(){
  state().dispose();
  session={mode:'idle',paused:false,trainingId:null,scenario:null};
  return status();
}

g.ExportHubTrainingController=Object.freeze({start,pause,resume,restart,end,status,snapshot});
})(globalThis);