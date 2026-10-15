(function(g){
'use strict';

function model(){
  const api=g.ExportHubTrainingCenterModel;
  if(!api||typeof api.normalizeCenter!=='function')throw new Error('TRAINING_CENTER_MODEL_MISSING');
  return api;
}
function isObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}

function read(state){
  const source=isObject(state)?state:{};
  return model().normalizeCenter(source.sopTrainingCenter);
}

function writeCenter(state,patch){
  const source=isObject(state)?state:{};
  const current=read(source);
  const nextPatch=isObject(patch)?patch:{};
  const nextState=clone(source)||{};
  nextState.sopTrainingCenter=model().normalizeCenter(Object.assign({},current,nextPatch));
  return nextState;
}

g.ExportHubTrainingCenterStore=Object.freeze({read,writeCenter});
})(globalThis);
