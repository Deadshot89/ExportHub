import test from 'node:test';
import assert from 'node:assert/strict';

delete globalThis.ExportHubTrainingCenterModel;
delete globalThis.ExportHubTrainingCenterStore;
globalThis.ExportHubIsoSopCatalog={list:()=>[{number:'SOP-LEGACY-1'}]};
await import('../assets/training-center/model.js').catch(()=>{});
await import('../assets/training-center/store.js').catch(()=>{});
const store=globalThis.ExportHubTrainingCenterStore;

test('read liest ausschließlich state.sopTrainingCenter und niemals Legacy-SOP-Bestände',()=>{
  assert.ok(store,'ExportHubTrainingCenterStore fehlt');
  const legacyOnlyState={
    isoSops:[{id:'legacy',number:'SOP-LEGACY-1'}],
    sopLearningProgress:[{id:'legacy-progress',userId:'U1'}],
    customSops:[{id:'legacy-custom'}]
  };
  const center=store.read(legacyOnlyState);
  assert.deepEqual(center,{
    version:1,
    standardProcesses:[],
    customerSops:[],
    trainings:[],
    categories:[],
    favorites:[],
    recents:[],
    screenshots:[],
    learningProgress:[]
  });
  assert.equal(JSON.stringify(center).includes('LEGACY'),false);
});

test('ein explizit leerer neuer Center bleibt leer und fällt nicht auf alte Globals zurück',()=>{
  assert.ok(store,'ExportHubTrainingCenterStore fehlt');
  const center=store.read({
    sopTrainingCenter:{},
    isoSops:[{number:'SOP-LEGACY-2'}],
    sopLearningProgress:[{userId:'LEGACY'}]
  });
  assert.equal(center.standardProcesses.length,0);
  assert.equal(center.learningProgress.length,0);
});

test('writeCenter schreibt nur sopTrainingCenter und lässt Legacy- sowie Geschäftsdaten unverändert',()=>{
  assert.ok(store,'ExportHubTrainingCenterStore fehlt');
  const original={
    isoSops:[{number:'SOP-LEGACY'}],
    sopLearningProgress:[{userId:'LEGACY'}],
    shipments:[{id:'SHIP-1'}],
    customers:[{id:'CUST-1'}]
  };
  const next=store.writeCenter(original,{standardProcesses:[{id:'shipment-registration'}]});
  assert.notEqual(next,original);
  assert.deepEqual(next.isoSops,original.isoSops);
  assert.deepEqual(next.sopLearningProgress,original.sopLearningProgress);
  assert.deepEqual(next.shipments,original.shipments);
  assert.deepEqual(next.customers,original.customers);
  assert.deepEqual(next.sopTrainingCenter.standardProcesses,[{id:'shipment-registration'}]);
});
