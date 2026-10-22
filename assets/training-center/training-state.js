(function(g){
'use strict';

let active=null;
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function start(seed={}){
  active=clone(seed&&typeof seed==='object'?seed:{});
  return snapshot();
}
function snapshot(){return active===null?null:clone(active);}
function mutate(mutator){
  if(active===null)throw new Error('TRAINING_STATE_NOT_ACTIVE');
  if(typeof mutator!=='function')throw new Error('TRAINING_STATE_MUTATOR_REQUIRED');
  const draft=clone(active);
  const result=mutator(draft);
  active=clone(result===undefined?draft:result);
  return snapshot();
}
function dispose(){active=null;}
function isActive(){return active!==null;}

g.ExportHubTrainingState=Object.freeze({start,snapshot,mutate,dispose,isActive});
})(globalThis);
