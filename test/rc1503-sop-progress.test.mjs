import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

await import('../assets/sop/rc1503-sop-progress.js').catch(()=>{});
const progress=globalThis.ExportHubSopProgress;
const require=createRequire(import.meta.url);
const {mergeState}=require('../api/shared/merge.js');

const ID={userId:'USER-1',sopNumber:'SOP-EH-060',version:'2.0'};
const meta=()=>({_teamSyncMeta:{fields:{},tombstones:[]}});
function at(n){return `2026-10-12T10:0${n}:00.000Z`;}

test('Progress API ist vorhanden',()=>{
  assert.ok(progress,'ExportHubSopProgress fehlt');
  for(const name of ['key','get','markViewed','markStarted','markCompleted','recordTourCompletion','recordExamAttempt','recordHelp']){
    assert.equal(typeof progress[name],'function',`${name} fehlt`);
  }
});

test('Progress-Schlüssel trennt Benutzer SOP und Version deterministisch',()=>{
  assert.ok(progress,'ExportHubSopProgress fehlt');
  const base=progress.key('USER-1','SOP-EH-060','2.0');
  assert.equal(base,progress.key(' USER-1 ',' SOP-EH-060 ',' 2.0 '));
  assert.notEqual(base,progress.key('USER-2','SOP-EH-060','2.0'));
  assert.notEqual(base,progress.key('USER-1','SOP-EH-061','2.0'));
  assert.notEqual(base,progress.key('USER-1','SOP-EH-060','2.1'));
});

test('Viewed Started Completed sind immutable und versionsgebunden',()=>{
  const original={sopLearningProgress:[]};
  const viewed=progress.markViewed(original,{...ID,at:at(1)});
  const started=progress.markStarted(viewed,{...ID,at:at(2)});
  const completed=progress.markCompleted(started,{...ID,at:at(3)});
  assert.deepEqual(original,{sopLearningProgress:[]},'Original-State darf nicht mutiert werden');
  const record=progress.get(completed,ID.userId,ID.sopNumber,ID.version);
  assert.equal(record.userId,ID.userId);
  assert.equal(record.sopNumber,ID.sopNumber);
  assert.equal(record.version,ID.version);
  assert.equal(record.viewedAt,at(1));
  assert.equal(record.startedAt,at(2));
  assert.equal(record.completedAt,at(3));
});

test('alte SOP-Version bleibt historisch wenn neue Version begonnen wird',()=>{
  let state={sopLearningProgress:[]};
  state=progress.markCompleted(state,{...ID,version:'1.0',at:at(1)});
  state=progress.markStarted(state,{...ID,version:'2.0',at:at(2)});
  const oldRecord=progress.get(state,ID.userId,ID.sopNumber,'1.0');
  const newRecord=progress.get(state,ID.userId,ID.sopNumber,'2.0');
  assert.equal(oldRecord.completedAt,at(1));
  assert.equal(newRecord.completedAt,'');
  assert.equal(newRecord.startedAt,at(2));
  assert.equal(state.sopLearningProgress.length,2);
});

test('Prüfungsversuche werden append-only gespeichert und nicht überschrieben',()=>{
  let state={sopLearningProgress:[]};
  const a={attemptId:'ATT-1',passed:false,startedAt:at(1),completedAt:at(2),errors:[{type:'WRONG_ACTION'}]};
  const b={attemptId:'ATT-2',passed:true,startedAt:at(3),completedAt:at(4),errors:[]};
  state=progress.recordExamAttempt(state,ID,a);
  state=progress.recordExamAttempt(state,ID,b);
  state=progress.recordExamAttempt(state,ID,a);
  const record=progress.get(state,ID.userId,ID.sopNumber,ID.version);
  assert.deepEqual(record.examAttempts.map(item=>item.attemptId),['ATT-1','ATT-2']);
  assert.equal(record.examAttempts[0].passed,false);
  assert.equal(record.examAttempts[1].passed,true);
});

test('Tour-Abschluss und Hilfen werden getrennt protokolliert',()=>{
  let state={sopLearningProgress:[]};
  state=progress.recordTourCompletion(state,{...ID,at:at(1)});
  state=progress.recordHelp(state,ID,{helpId:'HELP-1',at:at(2),source:'exam'});
  state=progress.recordHelp(state,ID,{helpId:'HELP-2',at:at(3),source:'training'});
  state=progress.recordHelp(state,ID,{helpId:'HELP-1',at:at(2),source:'exam'});
  const record=progress.get(state,ID.userId,ID.sopNumber,ID.version);
  assert.equal(record.tourCompletedAt,at(1));
  assert.equal(record.helpCount,2);
  assert.deepEqual(record.helpEvents.map(item=>item.helpId),['HELP-1','HELP-2']);
});

test('State-Merge erhält unabhängige Fortschrittsdatensätze verschiedener Benutzer und Versionen',()=>{
  const a=progress.markStarted({sopLearningProgress:[]},{...ID,at:at(1)}).sopLearningProgress[0];
  const b=progress.markStarted({sopLearningProgress:[]},{...ID,userId:'USER-2',at:at(2)}).sopLearningProgress[0];
  const c=progress.markStarted({sopLearningProgress:[]},{...ID,version:'3.0',at:at(3)}).sopLearningProgress[0];
  const merged=mergeState({...meta(),sopLearningProgress:[a]},{...meta(),sopLearningProgress:[b,c]});
  assert.equal(merged.sopLearningProgress.length,3);
  assert.deepEqual(new Set(merged.sopLearningProgress.map(item=>item.id)),new Set([a.id,b.id,c.id]));
});

test('State-Merge vereinigt konkurrierende append-only Exam- und Hilfe-Historien desselben Records',()=>{
  let serverState={sopLearningProgress:[]};
  serverState=progress.recordExamAttempt(serverState,ID,{attemptId:'ATT-S',passed:false,startedAt:at(1),completedAt:at(2)});
  serverState=progress.recordHelp(serverState,ID,{helpId:'HELP-S',at:at(2),source:'exam'});
  let incomingState={sopLearningProgress:[]};
  incomingState=progress.recordExamAttempt(incomingState,ID,{attemptId:'ATT-I',passed:true,startedAt:at(3),completedAt:at(4)});
  incomingState=progress.recordHelp(incomingState,ID,{helpId:'HELP-I',at:at(4),source:'exam'});

  const merged=mergeState({...meta(),...serverState},{...meta(),...incomingState});
  const record=progress.get(merged,ID.userId,ID.sopNumber,ID.version);
  assert.deepEqual(new Set(record.examAttempts.map(item=>item.attemptId)),new Set(['ATT-S','ATT-I']));
  assert.deepEqual(new Set(record.helpEvents.map(item=>item.helpId)),new Set(['HELP-S','HELP-I']));
  assert.equal(record.helpCount,2);
});
