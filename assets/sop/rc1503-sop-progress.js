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

function applicationState(){
  try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||{};}catch(_){}
  try{if(root.ExportHUBClean&&root.ExportHUBClean.state)return root.ExportHUBClean.state;}catch(_){}
  return root.appState&&typeof root.appState==='object'?root.appState:{};
}
function currentUserId(){
  let user=null;
  try{if(typeof root.__EXPORTHUB_GET_CURRENT_USER__==='function')user=root.__EXPORTHUB_GET_CURRENT_USER__()||null;}catch(_){}
  const state=applicationState();
  user=user||state.currentUser||state.activeUser||root.currentUser||{};
  return text(user&& (user.id||user.userId||user.user||user.username||user.login));
}
function progressMeta(session,sop,userId){
  const source=session&&typeof session==='object'?session:{};
  const document=sop&&typeof sop==='object'?sop:{};
  const meta={
    userId:text(userId)||currentUserId(),
    sopNumber:text(source.sopNumber||document.number),
    version:text(source.version||document.version||document.currentVersion)
  };
  return identity(meta)?meta:null;
}
function persistProgress(reason){
  const clean=root.ExportHUBClean;
  if(!clean||typeof clean.queueSave!=='function')return;
  try{
    Promise.resolve(clean.queueSave(reason||'SOP-Lernfortschritt gespeichert')).then(queued=>{
      if(queued===false||typeof clean.flushSave!=='function')return queued;
      return clean.flushSave(reason||'SOP-Lernfortschritt gespeichert',{force:true});
    }).catch(error=>{try{console.error('[ExportHUB SOP Progress Save]',error);}catch(_){}});
  }catch(error){try{console.error('[ExportHUB SOP Progress Save]',error);}catch(_){}}
}
function applyTransform(transform,meta,payload,reason){
  if(typeof transform!=='function'||!identity(meta))return false;
  const current=applicationState();
  if(!current||typeof current!=='object'||Array.isArray(current))return false;
  let next;
  try{next=payload===undefined?transform(current,meta):transform(current,meta,payload);}catch(_){return false;}
  if(next===current)return false;
  try{current.sopLearningProgress=clone(next.sopLearningProgress)||[];}catch(_){return false;}
  persistProgress(reason);
  return true;
}
function recordStarted(meta){
  if(!meta)return false;
  const viewed=applyTransform(markViewed,meta,undefined,'SOP-Lernfortschritt angesehen');
  const started=applyTransform(markStarted,meta,undefined,'SOP-Lernfortschritt gestartet');
  return viewed||started;
}

let wrappedTour=null;
let wrappedExam=null;
function installRuntimeHooks(){
  const tour=root.ExportHubSopTour;
  if(tour&&typeof tour==='object'&&tour!==wrappedTour){
    const original=tour;
    const next=Object.assign({},original);
    if(typeof original.start==='function')next.start=function(options={}){
      const result=original.start.apply(original,arguments);
      recordStarted(progressMeta(result,options&&options.sop,''));
      return result;
    };
    if(typeof original.handleAction==='function')next.handleAction=function(){
      const result=original.handleAction.apply(original,arguments);
      const session=result&&result.session;
      if(session&&text(session.status)==='completed'){
        const meta=progressMeta(session,null,'');
        if(meta)applyTransform(recordTourCompletion,meta,undefined,'SOP-Tour abgeschlossen');
      }
      return result;
    };
    wrappedTour=Object.freeze(next);
    root.ExportHubSopTour=wrappedTour;
  }

  const exam=root.ExportHubSopExam;
  if(exam&&typeof exam==='object'&&exam!==wrappedExam){
    const original=exam;
    const next=Object.assign({},original);
    if(typeof original.start==='function')next.start=function(options={}){
      const result=original.start.apply(original,arguments);
      if(result&&text(result.status)==='active')recordStarted(progressMeta(result,options&&options.sop,options&&options.userId));
      return result;
    };
    if(typeof original.requestHelp==='function')next.requestHelp=function(){
      const result=original.requestHelp.apply(original,arguments);
      if(result&&result.ok===true){
        const session=result.session||(typeof original.current==='function'?original.current():null);
        const meta=progressMeta(session,null,session&&session.userId);
        if(meta){
          const at=new Date().toISOString();
          const event={
            helpId:`exam-help:${text(session&&session.startedAt)}:${Number(result.helpCount||session&&session.helpCount)||1}:${at}`,
            at,
            source:'exam'
          };
          applyTransform(recordHelp,meta,event,'SOP-Prüfung Hilfe verwendet');
        }
      }
      return result;
    };
    if(typeof original.finish==='function')next.finish=function(){
      const result=original.finish.apply(original,arguments);
      if(result&&text(result.status)==='completed'){
        const meta=progressMeta(result,null,result.userId);
        if(meta){
          const attempt=clone(result)||{};
          attempt.attemptId=`exam:${text(result.startedAt)}:${text(result.completedAt)}`;
          applyTransform(recordExamAttempt,meta,attempt,'SOP-Prüfungsversuch gespeichert');
          if(result.passed===true)applyTransform(markCompleted,meta,undefined,'SOP-Prüfung bestanden');
        }
      }
      return result;
    };
    wrappedExam=Object.freeze(next);
    root.ExportHubSopExam=wrappedExam;
  }
  return !!(wrappedTour||wrappedExam);
}

root.ExportHubSopProgress=Object.freeze({
  key,get,markViewed,markStarted,markCompleted,recordTourCompletion,recordExamAttempt,recordHelp,installRuntimeHooks
});
installRuntimeHooks();
})(typeof globalThis!=='undefined'?globalThis:this);
