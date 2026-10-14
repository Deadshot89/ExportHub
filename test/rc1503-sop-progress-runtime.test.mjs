import test from 'node:test';
import assert from 'node:assert/strict';

const SOP={number:'SOP-EH-060',title:'ABD Prozess',version:'2.0',steps:[{id:'s1',tour:{enabled:true},exam:{relevant:true}}]};
const state={
  _exporthubEnvironment:{name:'demo'},
  currentUser:{id:'USER-42',name:'Demo Prüfer'},
  sopLearningProgress:[]
};
const saveCalls=[];
let tourSession=null;
let examSession=null;

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

globalThis.__EXPORTHUB_GET_STATE__=()=>state;
globalThis.__EXPORTHUB_GET_CURRENT_USER__=()=>state.currentUser;
globalThis.ExportHUBClean={
  queueSave(reason){saveCalls.push(['queue',String(reason||'')]);return true;},
  flushSave(reason,options){saveCalls.push(['flush',String(reason||''),options||{}]);return Promise.resolve(true);}
};
globalThis.ExportHubSopTour={
  start({sop,mode}){
    tourSession={mode:mode||'guided',status:'active',sopNumber:sop.number,version:sop.version,completedStepIds:[]};
    return clone(tourSession);
  },
  current(){return clone(tourSession);},
  handleAction(){
    tourSession={...tourSession,status:'completed',completedStepIds:['s1']};
    return {advanced:true,reason:'STEP_COMPLETED',session:clone(tourSession)};
  },
  end(){if(tourSession)tourSession={...tourSession,status:'ended'};return clone(tourSession);},
  storageKey:'test-tour'
};
globalThis.ExportHubSopTraining={
  start({sop}){
    const session=globalThis.ExportHubSopTour.start({sop,mode:'training'});
    return {ok:true,environment:'demo',simulation:true,session};
  },
  current(){return tourSession&&tourSession.mode==='training'?{status:tourSession.status,sopNumber:tourSession.sopNumber,version:tourSession.version}:null;},
  simulate(){return {ok:true,simulated:true,externalExecuted:false};},
  end(){return {ok:true,status:'ended'};},
  allowedEffects:['status']
};
globalThis.ExportHubSopExam={
  start({sop,userId}){
    examSession={mode:'exam',status:'active',userId,sopNumber:sop.number,version:sop.version,startedAt:'2026-10-12T10:10:00.000Z',helpCount:0,errors:[],skippedSteps:[],correctSteps:[]};
    return clone(examSession);
  },
  current(){return clone(examSession);},
  requestHelp(){examSession={...examSession,helpCount:(examSession?.helpCount||0)+1};return {ok:true,helpCount:examSession.helpCount,session:clone(examSession)};},
  finish(){
    examSession={...examSession,status:'completed',passed:true,correctSteps:['s1'],completedAt:'2026-10-12T10:12:00.000Z',durationMs:120000,finalStateOk:true};
    return clone(examSession);
  },
  end(){if(examSession)examSession={...examSession,status:'ended'};return clone(examSession);}
};

await import('../assets/sop/rc1503-sop-progress.js');
const progress=globalThis.ExportHubSopProgress;

test('Progress Runtime Hooks können installiert werden und verändern keine fachfremden State-Felder',()=>{
  assert.ok(progress,'ExportHubSopProgress fehlt');
  assert.equal(typeof progress.installRuntimeHooks,'function','installRuntimeHooks fehlt');
  const beforeUser=state.currentUser;
  const installed=progress.installRuntimeHooks();
  assert.equal(installed,true);
  assert.strictEqual(state.currentUser,beforeUser);
});

test('Tour/Training schreibt viewed started und tourCompleted versionsgebunden in den App-State',()=>{
  progress.installRuntimeHooks();
  const started=globalThis.ExportHubSopTraining.start({sop:SOP,context:{environment:'demo'}});
  assert.equal(started.ok,true);
  let record=progress.get(state,'USER-42','SOP-EH-060','2.0');
  assert.ok(record?.viewedAt,'viewedAt fehlt');
  assert.ok(record?.startedAt,'startedAt fehlt');
  assert.equal(record?.tourCompletedAt,'');

  const action=globalThis.ExportHubSopTour.handleAction({action:'click',stableKey:'shipment-abd-decision',context:{}});
  assert.equal(action.session.status,'completed');
  record=progress.get(state,'USER-42','SOP-EH-060','2.0');
  assert.ok(record?.tourCompletedAt,'tourCompletedAt fehlt nach Tour-Abschluss');
});

test('Prüfung protokolliert Hilfe und Versuch append-only und markiert bestandene Version abgeschlossen',()=>{
  progress.installRuntimeHooks();
  const exam=globalThis.ExportHubSopExam.start({sop:SOP,userId:'USER-42'});
  assert.equal(exam.status,'active');
  globalThis.ExportHubSopExam.requestHelp();
  const result=globalThis.ExportHubSopExam.finish({});
  assert.equal(result.passed,true);

  const record=progress.get(state,'USER-42','SOP-EH-060','2.0');
  assert.equal(record?.helpCount,1);
  assert.equal(record?.helpEvents.length,1);
  assert.equal(record?.examAttempts.length,1);
  assert.equal(record?.examAttempts[0].passed,true);
  assert.ok(record?.completedAt,'completedAt fehlt nach bestandener Prüfung');
  assert.ok(saveCalls.some(call=>call[0]==='queue'),'Progress-Änderungen wurden nicht zur Speicherung vorgemerkt');
});
