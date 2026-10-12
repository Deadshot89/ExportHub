(function(root){
'use strict';
if(root.ExportHubSopProgress)return;

function text(value){return String(value==null?'':value).trim();}
function lower(value){return text(value).toLowerCase();}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function list(value){return Array.isArray(value)?value:[];}
function stamp(value){
  const raw=text(value);
  if(raw&&Number.isFinite(Date.parse(raw)))return new Date(raw).toISOString();
  return new Date().toISOString();
}
function key(userId,sopNumber,version){
  const user=lower(userId),sop=lower(sopNumber),ver=lower(version);
  if(!user||!sop||!ver)return '';
  return `sop-learning:${encodeURIComponent(user)}:${encodeURIComponent(sop)}:${encodeURIComponent(ver)}`;
}
function identity(meta){
  const userId=text(meta&&meta.userId),sopNumber=text(meta&&meta.sopNumber),version=text(meta&&meta.version);
  const id=key(userId,sopNumber,version);
  if(!id)return null;
  return {id,key:id,userId,sopNumber,version};
}
function baseRecord(meta){
  const id=identity(meta);
  if(!id)return null;
  return Object.assign(id,{
    viewedAt:'',startedAt:'',completedAt:'',tourCompletedAt:'',
    helpCount:0,helpEvents:[],examAttempts:[],updatedAt:'',_syncUpdatedAt:''
  });
}
function records(state){return list(state&&state.sopLearningProgress);}
function findIndex(state,id){return records(state).findIndex(item=>item&&text(item.id||item.key)===id);}
function get(state,userId,sopNumber,version){
  const id=key(userId,sopNumber,version);
  if(!id)return null;
  const record=records(state).find(item=>item&&text(item.id||item.key)===id);
  return record?clone(record):null;
}
function mutate(state,meta,updater){
  const currentState=state&&typeof state==='object'&&!Array.isArray(state)?state:{};
  const fresh=baseRecord(meta);
  if(!fresh)return currentState;
  const source=records(currentState);
  const index=findIndex(currentState,fresh.id);
  const previous=index>=0?source[index]:fresh;
  const next=clone(previous)||fresh;
  next.id=fresh.id;next.key=fresh.key;next.userId=fresh.userId;next.sopNumber=fresh.sopNumber;next.version=fresh.version;
  next.examAttempts=list(next.examAttempts);next.helpEvents=list(next.helpEvents);
  next.helpCount=Math.max(Number(next.helpCount)||0,next.helpEvents.length);
  const changed=updater(next,previous)!==false;
  if(!changed)return currentState;
  const outList=source.slice();
  if(index>=0)outList[index]=next;else outList.push(next);
  return Object.assign({},currentState,{sopLearningProgress:outList});
}
function touch(record,at){record.updatedAt=at;record._syncUpdatedAt=at;}
function markViewed(state,meta){
  const at=stamp(meta&&meta.at);
  return mutate(state,meta,record=>{if(record.viewedAt)return false;record.viewedAt=at;touch(record,at);});
}
function markStarted(state,meta){
  const at=stamp(meta&&meta.at);
  return mutate(state,meta,record=>{if(record.startedAt)return false;record.startedAt=at;touch(record,at);});
}
function markCompleted(state,meta){
  const at=stamp(meta&&meta.at);
  return mutate(state,meta,record=>{if(record.completedAt)return false;record.completedAt=at;touch(record,at);});
}
function recordTourCompletion(state,meta){
  const at=stamp(meta&&meta.at);
  return mutate(state,meta,record=>{if(record.tourCompletedAt)return false;record.tourCompletedAt=at;touch(record,at);});
}
function attemptIdentity(attempt){
  const explicit=text(attempt&&attempt.attemptId||attempt&&attempt.id);
  if(explicit)return explicit;
  const started=text(attempt&&attempt.startedAt),completed=text(attempt&&attempt.completedAt);
  return started||completed?`attempt:${started}:${completed}`:'';
}
function recordExamAttempt(state,meta,attempt){
  if(!attempt||typeof attempt!=='object'||Array.isArray(attempt))return state&&typeof state==='object'?state:{};
  const attemptId=attemptIdentity(attempt);
  if(!attemptId)return state&&typeof state==='object'?state:{};
  const event=clone(attempt)||{};
  event.attemptId=attemptId;
  const at=stamp(event.completedAt||event.startedAt||meta&&meta.at);
  return mutate(state,meta,record=>{
    if(record.examAttempts.some(item=>text(item&&item.attemptId||item&&item.id)===attemptId))return false;
    record.examAttempts.push(event);touch(record,at);return true;
  });
}
function helpIdentity(event){
  const explicit=text(event&&event.helpId||event&&event.id);
  if(explicit)return explicit;
  const at=text(event&&event.at);
  return at?`help:${at}:${text(event&&event.source)}`:'';
}
function recordHelp(state,meta,event={}){
  const helpId=helpIdentity(event);
  if(!helpId)return state&&typeof state==='object'?state:{};
  const entry=clone(event)||{};entry.helpId=helpId;
  const at=stamp(entry.at||meta&&meta.at);
  entry.at=at;
  return mutate(state,meta,record=>{
    if(record.helpEvents.some(item=>text(item&&item.helpId||item&&item.id)===helpId))return false;
    record.helpEvents.push(entry);record.helpCount=record.helpEvents.length;touch(record,at);return true;
  });
}

root.ExportHubSopProgress=Object.freeze({key,get,markViewed,markStarted,markCompleted,recordTourCompletion,recordExamAttempt,recordHelp});
})(typeof globalThis!=='undefined'?globalThis:this);
