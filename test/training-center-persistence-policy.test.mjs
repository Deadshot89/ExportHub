import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
let trainingCenter=null;
let merge=null;
try{trainingCenter=require('../api/shared/training-center.js');}catch{}
try{merge=require('../api/shared/merge.js');}catch{}

test('Server-Sanitizer existiert und akzeptiert nur den neuen Center-Vertrag',()=>{
  assert.ok(trainingCenter,'api/shared/training-center.js fehlt');
  assert.equal(typeof trainingCenter.sanitizeTrainingCenterPatch,'function');
  const sanitized=trainingCenter.sanitizeTrainingCenterPatch({
    version:2,
    standardProcesses:[{id:'shipment-registration'}],
    customerSops:[{id:'customer-1'}],
    trainings:[{id:'first-shipment'}],
    categories:[{id:'shipping'}],
    favorites:['shipment-registration'],
    recents:['shipment-registration'],
    screenshots:[{id:'shot-1'}],
    learningProgress:[{
      userId:'U1',trainingId:'first-shipment',version:'1',completed:false,progressPercent:50,
      completedAt:null,updatedAt:'2026-10-15T08:00:00Z',
      shipment:{id:'DEMO'},customer:{id:'DEMO'},documents:[{id:'DEMO'}],abd:{id:'DEMO'}
    }],
    shipments:[{id:'DEMO'}],
    customers:[{id:'DEMO'}],
    tasks:[{id:'DEMO'}],
    abdRequests:[{id:'DEMO'}],
    palletAccount:[{id:'DEMO'}],
    history:[{id:'DEMO'}],
    demoSeed:{shipment:{id:'DEMO'}}
  });
  assert.deepEqual(Object.keys(sanitized).sort(),[
    'categories','customerSops','favorites','learningProgress','recents','screenshots','standardProcesses','trainings','version'
  ].sort());
  assert.deepEqual(Object.keys(sanitized.learningProgress[0]).sort(),[
    'completed','completedAt','progressPercent','trainingId','updatedAt','userId','version'
  ].sort());
});

test('mergeState behandelt sopTrainingCenter isoliert und verändert geschützte Geschäftsbestände nicht',()=>{
  assert.ok(trainingCenter,'api/shared/training-center.js fehlt');
  assert.ok(merge,'api/shared/merge.js fehlt');
  const meta={_teamSyncMeta:{fields:{},tombstones:[]}};
  const server={
    ...meta,
    shipments:[{id:'SHIP-1',ref:'ABC123',status:'Erstellt'}],
    customers:[{id:'CUST-1',name:'Produktivkunde'}],
    tasks:[{id:'TASK-1',title:'Produktiv'}],
    sopTrainingCenter:{version:1,standardProcesses:[{id:'old-new-system-entry'}],learningProgress:[]}
  };
  const incoming={
    ...meta,
    sopTrainingCenter:{
      version:2,
      standardProcesses:[{id:'shipment-registration'}],
      learningProgress:[{userId:'U1',trainingId:'first-shipment',version:'1',completed:true,progressPercent:100,updatedAt:'2026-10-15T09:00:00Z',shipment:{id:'DEMO'}}],
      shipments:[{id:'DEMO-SHOULD-DROP'}]
    }
  };
  const merged=merge.mergeState(server,incoming);
  assert.deepEqual(merged.shipments,server.shipments);
  assert.deepEqual(merged.customers,server.customers);
  assert.deepEqual(merged.tasks,server.tasks);
  assert.equal(merged.sopTrainingCenter.version,2);
  assert.deepEqual(merged.sopTrainingCenter.standardProcesses,[{id:'shipment-registration'}]);
  assert.equal(merged.sopTrainingCenter.shipments,undefined);
  assert.equal(merged.sopTrainingCenter.learningProgress[0].shipment,undefined);
});
