import test from 'node:test';
import assert from 'node:assert/strict';

for(const name of ['ExportHubTrainingTourEngine'])delete globalThis[name];
await import('../assets/training-center/tour-engine.js').catch(()=>{});
const Engine=globalThis.ExportHubTrainingTourEngine;

const ACTIONS=['click','input','change','select','upload-demo','open-modal','close-modal','navigate','decision','save-demo','confirm'];
function scenarioFor(action='click'){
  return {
    id:'scenario-test',
    steps:[
      {stepId:'s1',title:'Eins',targetElement:'target.one',expectedAction:action,validation:[({descriptor})=>descriptor.valid===true],helpText:'Hilfe 1',successText:'OK 1',nextStep:'s2'},
      {stepId:'s2',title:'Zwei',targetElement:'target.two',expectedAction:'confirm',validation:[],helpText:'Hilfe 2',successText:'OK 2',nextStep:null}
    ]
  };
}

test('TourEngine bietet vollständige Lifecycle-API',()=>{
  assert.ok(Engine,'ExportHubTrainingTourEngine fehlt');
  for(const key of ['start','handleAction','current','pause','resume','restart','end'])assert.equal(typeof Engine[key],'function',key);
});

for(const action of ACTIONS){
  test(`TourEngine akzeptiert Aktionstyp ${action} nur bei passendem Ziel und erfolgreicher Validierung`,()=>{
    assert.ok(Engine,'ExportHubTrainingTourEngine fehlt');
    Engine.start({scenario:scenarioFor(action)});
    const before=Engine.current();
    assert.equal(before.stepId,'s1');
    const result=Engine.handleAction({action,targetElement:'target.one',valid:true});
    assert.equal(result.advanced,true);
    assert.equal(result.completedStepId,'s1');
    assert.equal(Engine.current().stepId,'s2');
    Engine.end();
  });
}

test('falsche Aktion, falsches Ziel und fehlgeschlagene Validierung bewegen den Fortschritt niemals',()=>{
  assert.ok(Engine,'ExportHubTrainingTourEngine fehlt');
  Engine.start({scenario:scenarioFor('click')});
  const wrongAction=Engine.handleAction({action:'input',targetElement:'target.one',valid:true});
  assert.equal(wrongAction.advanced,false);
  assert.equal(wrongAction.reason,'ACTION_MISMATCH');
  assert.equal(Engine.current().stepId,'s1');
  const wrongTarget=Engine.handleAction({action:'click',targetElement:'target.two',valid:true});
  assert.equal(wrongTarget.advanced,false);
  assert.equal(wrongTarget.reason,'TARGET_MISMATCH');
  assert.equal(Engine.current().stepId,'s1');
  const invalid=Engine.handleAction({action:'click',targetElement:'target.one',valid:false});
  assert.equal(invalid.advanced,false);
  assert.equal(invalid.reason,'VALIDATION_FAILED');
  assert.equal(Engine.current().stepId,'s1');
  Engine.end();
});

test('current liefert Schritt X/Y, Prozent, erledigte/aktuelle/kommende Schritte',()=>{
  assert.ok(Engine,'ExportHubTrainingTourEngine fehlt');
  Engine.start({scenario:scenarioFor('click')});
  let current=Engine.current();
  assert.equal(current.index,1);
  assert.equal(current.total,2);
  assert.equal(current.progressPercent,0);
  assert.deepEqual(current.completed,[]);
  assert.equal(current.current.stepId,'s1');
  assert.deepEqual(current.upcoming.map(step=>step.stepId),['s2']);
  Engine.handleAction({action:'click',targetElement:'target.one',valid:true});
  current=Engine.current();
  assert.equal(current.index,2);
  assert.equal(current.progressPercent,50);
  assert.deepEqual(current.completed.map(step=>step.stepId),['s1']);
  Engine.end();
});

test('pause blockiert Aktionen, resume setzt fort, restart setzt auf Start, startStepId springt kontrolliert',()=>{
  assert.ok(Engine,'ExportHubTrainingTourEngine fehlt');
  const scenario=scenarioFor('click');
  Engine.start({scenario});
  Engine.pause();
  assert.equal(Engine.handleAction({action:'click',targetElement:'target.one',valid:true}).reason,'TOUR_PAUSED');
  assert.equal(Engine.current().stepId,'s1');
  Engine.resume();
  Engine.handleAction({action:'click',targetElement:'target.one',valid:true});
  assert.equal(Engine.current().stepId,'s2');
  Engine.restart();
  assert.equal(Engine.current().stepId,'s1');
  Engine.end();
  Engine.start({scenario,startStepId:'s2'});
  assert.equal(Engine.current().stepId,'s2');
  Engine.end();
});

test('end löscht die aktive Tour und current ist danach null',()=>{
  assert.ok(Engine,'ExportHubTrainingTourEngine fehlt');
  Engine.start({scenario:scenarioFor('click')});
  Engine.end();
  assert.equal(Engine.current(),null);
});
