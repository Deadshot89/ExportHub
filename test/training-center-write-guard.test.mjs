import test from 'node:test';
import assert from 'node:assert/strict';

for(const name of ['ExportHubTrainingState','ExportHubTrainingDemoAdapter','ExportHubTrainingWriteGuard'])delete globalThis[name];
await import('../assets/training-center/training-state.js').catch(()=>{});
await import('../assets/training-center/demo-adapter.js').catch(()=>{});
await import('../assets/training-center/training-write-guard.js').catch(()=>{});

const state=globalThis.ExportHubTrainingState;
const demo=globalThis.ExportHubTrainingDemoAdapter;
const guard=globalThis.ExportHubTrainingWriteGuard;

test('Training-Write ohne produktiven Callback wird ausschließlich an DemoAdapter geroutet',()=>{
  assert.ok(state&&demo&&guard,'Training Write Guard Abhängigkeiten fehlen');
  state.start({shipment:{id:'DEMO-SHIPMENT',status:'Entwurf'}});
  const result=guard.execute({mode:'training',operation:'shipment.save',payload:{id:'DEMO-SHIPMENT',status:'Erstellt'}});
  assert.equal(result.mode,'training');
  assert.equal(result.persisted,false);
  assert.equal(state.snapshot().shipment.status,'Erstellt');
  state.dispose();
});

test('jeder explizite produktive Schreibversuch im Trainingsmodus wird hart blockiert und nie aufgerufen',()=>{
  assert.ok(state&&guard,'Training Write Guard fehlt');
  state.start({shipment:{id:'DEMO-SHIPMENT'}});
  let productiveCalls=0;
  assert.throws(()=>guard.execute({
    mode:'training',
    operation:'shipment.save',
    payload:{id:'DEMO-SHIPMENT'},
    productive:()=>{productiveCalls++;return {ok:true};}
  }),/TRAINING_PRODUCTIVE_WRITE_BLOCKED/);
  assert.equal(productiveCalls,0);
  state.dispose();
});

test('Produktivmodus benötigt expliziten produktiven Callback und ruft ihn genau einmal auf',()=>{
  assert.ok(guard,'Training Write Guard fehlt');
  let calls=0;
  const result=guard.execute({mode:'productive',operation:'shipment.save',payload:{id:'SHIP-1'},productive:(payload,operation)=>{calls++;return {payload,operation};}});
  assert.equal(calls,1);
  assert.equal(result.mode,'productive');
  assert.equal(result.persisted,true);
  assert.deepEqual(result.result,{payload:{id:'SHIP-1'},operation:'shipment.save'});
  assert.throws(()=>guard.execute({mode:'productive',operation:'shipment.save',payload:{id:'SHIP-1'}}),/PRODUCTIVE_WRITE_HANDLER_REQUIRED/);
});

test('Produktivmodus kann bei aktivem Training den Write Guard nicht umgehen',()=>{
  assert.ok(state&&guard,'Write Guard/TrainingState missing');
  state.start({shipment:{id:'DEMO-SHIPMENT'}});
  let productionWrites=0;
  try{
    assert.throws(()=>guard.execute({
      mode:'productive',operation:'shipment.save',payload:{id:'LIVE-123'},
      productive:()=>{productionWrites++;return {saved:true};}
    }),/TRAINING_PRODUCTIVE_WRITE_BLOCKED/);
    assert.equal(productionWrites,0,'no productive callback may execute during demo');
    assert.equal(state.snapshot().shipment.id,'DEMO-SHIPMENT');
  }finally{state.dispose();}
});

test('unbekannter Modus wird fail-closed blockiert',()=>{
  assert.ok(guard,'Training Write Guard fehlt');
  assert.throws(()=>guard.execute({mode:'unknown',operation:'shipment.save',payload:{}}),/WRITE_GUARD_MODE_INVALID/);
});
