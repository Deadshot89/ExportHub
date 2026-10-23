(function(g){
'use strict';

const CENTER_ARRAY_KEYS=['standardProcesses','customerSops','trainings','categories','favorites','recents','screenshots'];
const LEARNING_KEYS=['userId','trainingId','version','completed','progressPercent','completedAt','updatedAt'];

function isObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}

function normalizeLearningProgress(value){
  const source=isObject(value)?value:{};
  const out={};
  for(const key of LEARNING_KEYS){
    if(!Object.prototype.hasOwnProperty.call(source,key))continue;
    let next=source[key];
    if(key==='completed')next=next===true;
    if(key==='progressPercent'){
      const number=Number(next);
      next=Number.isFinite(number)?Math.max(0,Math.min(100,number)):0;
    }
    out[key]=clone(next);
  }
  return out;
}

function normalizeCenter(value){
  const source=isObject(value)?value:{};
  const versionNumber=Number(source.version);
  const out={version:Number.isFinite(versionNumber)&&versionNumber>0?versionNumber:1};
  for(const key of CENTER_ARRAY_KEYS)out[key]=Array.isArray(source[key])?clone(source[key]):[];
  out.learningProgress=Array.isArray(source.learningProgress)?source.learningProgress.filter(isObject).map(normalizeLearningProgress):[];
  return out;
}

g.ExportHubTrainingCenterModel=Object.freeze({
  CENTER_ARRAY_KEYS:Object.freeze(CENTER_ARRAY_KEYS.slice()),
  LEARNING_KEYS:Object.freeze(LEARNING_KEYS.slice()),
  normalizeCenter,
  normalizeLearningProgress
});
})(globalThis);
