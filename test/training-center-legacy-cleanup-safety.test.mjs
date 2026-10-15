import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const file='assets/training-center/legacy-cleanup.js';
const LEGACY_KEYS=[
  'customSops','isoSops','sopLearningProgress','sopFavorites','sopRecents',
  'sopVersions','sopAudit','sopTraining','sopTours','sopScreenshots','sopCatalog'
];
const PROTECTED=[
  'shipments','savedShipments','customers','tasks','abdRequests','customsData','documents',
  'loadingLists','pickups','podRecords','palletAccount','auditLog','history','settings','users'
];

function load(){
  assert.ok(fs.existsSync(file),'Narrow Legacy-Cleanup fehlt');
  const context={};context.globalThis=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  assert.ok(context.ExportHubTrainingLegacyCleanup,'ExportHubTrainingLegacyCleanup fehlt');
  return context.ExportHubTrainingLegacyCleanup;
}
function clone(value){return JSON.parse(JSON.stringify(value));}
function fixture(){
  const state={
    shipments:[{id:'S1',ref:'ABC123',documents:[{id:'D1'}]}],
    savedShipments:[{id:'S2',ref:'XYZ987'}],
    customers:[{id:'C1',name:'Kunde'}],
    tasks:[{id:'T1',title:'Aufgabe'}],
    abdRequests:[{id:'A1',ref:'ABC123'}],
    customsData:{ABC123:{mrn:'MRN-DEMO-PROTECTED'}},
    documents:[{id:'D1',name:'lieferung.pdf'}],
    loadingLists:[{id:'L1',shipmentIds:['S1']}],
    pickups:[{id:'P1',shipmentId:'S1'}],
    podRecords:[{id:'POD1',shipmentId:'S1'}],
    palletAccount:[{id:'PAL1',quantity:4}],
    auditLog:[{id:'H1',action:'shipment.saved'}],
    history:[{id:'H2',action:'pickup.done'}],
    settings:{theme:'glass'},
    users:[{id:'U1',name:'User'}],
    sopTrainingCenter:{standardProcesses:[{id:'shipment-registration'}],learningProgress:[]},
    sopBusinessCriticalUnrelated:{keep:true},
    ordinaryBusinessKey:{keep:'yes'}
  };
  for(const key of LEGACY_KEYS)state[key]=[{legacy:true,key}];
  return state;
}

test('Cleanup entfernt nur explizit allowlistete Legacy-SOP-Schlüssel und mutiert den Eingabestate nicht',()=>{
  const api=load();
  assert.equal(typeof api.cleanup,'function');
  assert.deepEqual(Array.from(api.LEGACY_SOP_KEYS||[]).sort(),LEGACY_KEYS.slice().sort());
  const input=fixture();
  const before=clone(input);
  const next=clone(api.cleanup(input));
  assert.deepEqual(input,before,'Cleanup darf den Eingabestate nicht mutieren');
  for(const key of LEGACY_KEYS)assert.equal(Object.prototype.hasOwnProperty.call(next,key),false,`Legacy-Key blieb erhalten: ${key}`);
  assert.deepEqual(next.sopTrainingCenter,before.sopTrainingCenter,'neues Training Center darf nicht entfernt/verändert werden');
  assert.deepEqual(next.sopBusinessCriticalUnrelated,before.sopBusinessCriticalUnrelated,'unbekannte sop*-Keys dürfen nicht pauschal gelöscht werden');
  assert.deepEqual(next.ordinaryBusinessKey,before.ordinaryBusinessKey);
});

test('geschützte Geschäftssammlungen sind vor/nach Cleanup byte-identisch',()=>{
  const api=load();
  const input=fixture();
  const before=clone(input);
  const next=api.cleanup(input);
  for(const key of PROTECTED){
    assert.equal(JSON.stringify(next[key]),JSON.stringify(before[key]),`Geschäftsdaten verändert: ${key}`);
  }
});
