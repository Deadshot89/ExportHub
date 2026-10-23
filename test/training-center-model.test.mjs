import test from 'node:test';
import assert from 'node:assert/strict';

delete globalThis.ExportHubTrainingCenterModel;
await import('../assets/training-center/model.js').catch(()=>{});
const model=globalThis.ExportHubTrainingCenterModel;

test('Training-Center-Modell ist als neue eigenständige Runtime verfügbar',()=>{
  assert.ok(model,'ExportHubTrainingCenterModel fehlt');
  assert.equal(typeof model.normalizeCenter,'function');
  assert.equal(typeof model.normalizeLearningProgress,'function');
});

test('normalizeCenter erzeugt ausschließlich den neuen leeren Datenvertrag',()=>{
  assert.ok(model,'ExportHubTrainingCenterModel fehlt');
  const center=model.normalizeCenter(null);
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
});

test('Lernfortschritt verwirft jedes nicht freigegebene Feld',()=>{
  assert.ok(model,'ExportHubTrainingCenterModel fehlt');
  const normalized=model.normalizeLearningProgress({
    userId:'USER-1',
    trainingId:'first-shipment',
    version:'1.0',
    completed:true,
    progressPercent:100,
    completedAt:'2026-10-15T08:00:00.000Z',
    updatedAt:'2026-10-15T08:01:00.000Z',
    shipment:{id:'DEMO-SHIPMENT'},
    customer:{id:'DEMO-CUSTOMER'},
    documents:[{id:'DEMO-DOC'}],
    abd:{id:'DEMO-ABD'},
    secret:'must-not-survive'
  });
  assert.deepEqual(normalized,{
    userId:'USER-1',
    trainingId:'first-shipment',
    version:'1.0',
    completed:true,
    progressPercent:100,
    completedAt:'2026-10-15T08:00:00.000Z',
    updatedAt:'2026-10-15T08:01:00.000Z'
  });
});

test('normalizeCenter klont freigegebene Center-Daten und entfernt unbekannte Root-Felder',()=>{
  assert.ok(model,'ExportHubTrainingCenterModel fehlt');
  const source={
    version:3,
    standardProcesses:[{id:'shipment-registration',title:'Sendung anmelden'}],
    customerSops:[{id:'customer-1',baseProcessId:'shipment-registration'}],
    trainings:[{id:'first-shipment'}],
    categories:[{id:'shipping'}],
    favorites:['shipment-registration'],
    recents:['shipment-registration'],
    screenshots:[{id:'shot-1'}],
    learningProgress:[{userId:'U1',trainingId:'first-shipment',version:'1',completed:false,progressPercent:25,updatedAt:'2026-10-15T08:00:00Z',demoShipment:{id:'NO'}}],
    isoSops:[{number:'LEGACY'}],
    demoShipment:{id:'NO'},
    arbitrary:'NO'
  };
  const normalized=model.normalizeCenter(source);
  assert.equal(normalized.version,3);
  assert.equal(normalized.standardProcesses[0].id,'shipment-registration');
  assert.equal(normalized.learningProgress[0].demoShipment,undefined);
  assert.equal(normalized.isoSops,undefined);
  assert.equal(normalized.demoShipment,undefined);
  assert.equal(normalized.arbitrary,undefined);
  assert.notEqual(normalized.standardProcesses,source.standardProcesses);
});
