import test from 'node:test';
import assert from 'node:assert/strict';

let localWrites=0,sessionWrites=0;
globalThis.localStorage={getItem:()=>null,setItem:()=>{localWrites++;},removeItem:()=>{localWrites++;}};
globalThis.sessionStorage={getItem:()=>null,setItem:()=>{sessionWrites++;},removeItem:()=>{sessionWrites++;}};
for(const name of ['ExportHubTrainingState','ExportHubTrainingDemoAdapter','ExportHubTrainingController'])delete globalThis[name];
await import('../assets/training-center/training-state.js').catch(()=>{});
await import('../assets/training-center/demo-adapter.js').catch(()=>{});
await import('../assets/training-center/training-controller.js').catch(()=>{});

const state=globalThis.ExportHubTrainingState;
const demo=globalThis.ExportHubTrainingDemoAdapter;
const controller=globalThis.ExportHubTrainingController;

test('TrainingState lebt ausschließlich im Arbeitsspeicher und klont Seed/Snapshots',()=>{
  assert.ok(state,'ExportHubTrainingState fehlt');
  const seed={customer:{id:'DEMO-CUSTOMER'},shipment:{id:'DEMO-SHIPMENT',colli:[]}};
  const started=state.start(seed);
  assert.notEqual(started,seed);
  seed.shipment.id='MUTATED-OUTSIDE';
  assert.equal(state.snapshot().shipment.id,'DEMO-SHIPMENT');
  const snap=state.snapshot();
  snap.shipment.id='MUTATED-SNAPSHOT';
  assert.equal(state.snapshot().shipment.id,'DEMO-SHIPMENT');
  assert.equal(localWrites,0);
  assert.equal(sessionWrites,0);
});

test('mutate ändert nur aktiven Memory-State und dispose vernichtet alle Demo-Geschäftsdaten',()=>{
  assert.ok(state,'ExportHubTrainingState fehlt');
  state.start({shipment:{id:'DEMO-SHIPMENT',status:'Entwurf'}});
  state.mutate((draft)=>{draft.shipment.status='Erstellt';draft.documents=[{id:'DEMO-DOC'}];return draft;});
  assert.equal(state.snapshot().shipment.status,'Erstellt');
  assert.deepEqual(state.snapshot().documents,[{id:'DEMO-DOC'}]);
  state.dispose();
  assert.equal(state.snapshot(),null);
  assert.throws(()=>state.mutate(()=>{}),/TRAINING_STATE_NOT_ACTIVE/);
  assert.equal(localWrites,0);
  assert.equal(sessionWrites,0);
});

test('DemoAdapter schreibt Sendung, Dokument und ABD ausschließlich in TrainingState',()=>{
  assert.ok(state&&demo,'Training State/Demo Adapter fehlt');
  state.start({shipment:{id:'DEMO-SHIPMENT'},documents:[],abdRequests:[]});
  demo.execute('shipment.save',{id:'DEMO-SHIPMENT',status:'Erstellt'});
  demo.execute('document.add',{id:'DEMO-DOC',name:'Beispiel.pdf'});
  demo.execute('abd.save',{id:'DEMO-ABD',status:'Beispiel'});
  const snap=state.snapshot();
  assert.equal(snap.shipment.status,'Erstellt');
  assert.deepEqual(snap.documents,[{id:'DEMO-DOC',name:'Beispiel.pdf'}]);
  assert.deepEqual(snap.abdRequests,[{id:'DEMO-ABD',status:'Beispiel'}]);
  assert.equal(localWrites+sessionWrites,0);
  state.dispose();
});

test('TrainingController start/pause/resume/restart/end verwaltet ausschließlich Memory-State',()=>{
  assert.ok(controller,'ExportHubTrainingController fehlt');
  const scenario={id:'first-shipment',demoSeed:{shipment:{id:'DEMO-SHIPMENT',status:'Entwurf'}}};
  const started=controller.start(scenario);
  assert.equal(started.trainingId,'first-shipment');
  assert.equal(controller.status().mode,'training');
  controller.pause();
  assert.equal(controller.status().paused,true);
  controller.resume();
  assert.equal(controller.status().paused,false);
  state.mutate(d=>{d.shipment.status='Geändert';return d;});
  controller.restart();
  assert.equal(state.snapshot().shipment.status,'Entwurf');
  controller.end();
  assert.equal(controller.status().mode,'idle');
  assert.equal(state.snapshot(),null);
  assert.equal(localWrites+sessionWrites,0);
});
