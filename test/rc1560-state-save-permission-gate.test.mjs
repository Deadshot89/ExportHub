import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const policy=require('../api/shared/user-policy.js');
const guard=require('../api/shared/state-write-guard.js');
const secureMerge=require('../api/shared/secure-merge.js');
const writeContext=require('../api/shared/state-write-context.js');
const source=fs.readFileSync(new URL('../api/exporthub-state/index.js',import.meta.url),'utf8');

function right(level){
  return {level,visible:level!=='none',read:level!=='none',edit:level==='edit'||level==='admin',admin:level==='admin',functionAdmin:level==='admin'};
}
function viewer(rights={}){
  return {id:'U-READER',user:'reader',login:'reader',name:'Reader',role:'Benutzer',active:true,permissions:[],rights:{
    start:right('view'),dashboard:right('view'),tasks:right('none'),shipment:right('none'),
    shipmentoverview:right('none'),sop:right('none'),customers:right('none'),...rights
  }};
}
function runAs(user,callback){
  return writeContext.run(()=>{writeContext.captureUser(user);return callback();});
}
// Verify the actual API entry gate implementation, rather than a copy of its logic.
function apiEntryGate(user){
  const first=source.indexOf('function hasAnyEditRight(user){');
  const end=source.indexOf('function publicUser(user,adminView=false){',first);
  assert.ok(first>=0&&end>first,'entry gate helpers available');
  const helpers=source.slice(first,end);
  const context={isAdmin:policy.isAdmin,stateWriteGuard:guard};
  vm.runInNewContext(helpers,context);
  return context.canAttemptStateSave(user);
}

test('RC1560: global state endpoint retains the secure merge runtime and checks both save gates',()=>{
  assert.match(source,/if\(!canAttemptStateSave\(current\.user\)\)throw error\('WRITE_FORBIDDEN'/);
  assert.match(source,/if\(!canAttemptStateSave\(fresh\)\)throw error\('WRITE_FORBIDDEN'/);
  const runtime=fs.readFileSync(new URL('../api/exporthub-state/runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/mergeModule\.exports\s*=\s*secureMerge/);
  assert.match(source,/permissionDetails:denyInfo/);
});

test('RC1560: a user without any edit or scoped read permission stays blocked',()=>{
  assert.equal(apiEntryGate(viewer()),false);
});

test('RC1560: read-only SOP learner can save own learning progress',()=>{
  const user=viewer({sop:right('view')});
  assert.equal(apiEntryGate(user),true);
  const server={sopLearningProgress:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  const incoming=structuredClone(server);
  incoming.sopLearningProgress=[{
    id:'sop-learning:reader:sop-001:v1',key:'sop-learning:reader:sop-001:v1',
    userId:'U-READER',sopNumber:'SOP-001',version:'v1',
    startedAt:'2026-10-20T08:00:00.000Z',updatedAt:'2026-10-20T08:00:00.000Z'
  }];
  const merged=runAs(user,()=>secureMerge.mergeState(server,incoming));
  assert.equal(merged.sopLearningProgress.length,1);
  assert.equal(merged.sopLearningProgress[0].userId,'U-READER');
});

test('RC1560: read-only shipment registration can append its own audit event only',()=>{
  const user=viewer({shipmentoverview:right('view')});
  assert.equal(apiEntryGate(user),true);
  const shipment={id:'S1',ref:'ABC123',status:'Erstellt',shipmentHistory:[]};
  const server={shipments:[shipment],savedShipments:[structuredClone(shipment)],_teamSyncMeta:{fields:{},tombstones:[]}};
  const incoming=structuredClone(server);
  const event={id:'REG-1',at:'2026-10-20T08:00:00.000Z',type:'registration',
    label:'Versandanmeldung gestartet',actor:{id:'U-READER',name:'Reader',role:'Benutzer'},
    details:{reference:'ABC123',mailType:'Versandanmeldung'},source:'exporthub',version:'RC1151'};
  for(const key of ['shipments','savedShipments'])incoming[key][0].shipmentHistory.push(structuredClone(event));
  const merged=runAs(user,()=>secureMerge.mergeState(server,incoming));
  assert.equal(merged.shipments[0].shipmentHistory.length,1);
  assert.equal(merged.savedShipments[0].shipmentHistory.length,1);
});

test('RC1560 security: read-only rights cannot be used to change shipment status or customer data',()=>{
  const user=viewer({shipmentoverview:right('view'),sop:right('view')});
  assert.equal(apiEntryGate(user),true);
  const server={shipments:[{id:'S1',ref:'ABC123',status:'Erstellt'}],customers:[{id:'C1',name:'Original'}],_teamSyncMeta:{fields:{},tombstones:[]}};
  const incoming=structuredClone(server);
  incoming.shipments[0].status='Abgeholt';
  incoming.customers[0].name='Manipuliert';
  assert.throws(()=>runAs(user,()=>secureMerge.mergeState(server,incoming)),
    e=>e&&e.code==='STATE_MODULE_WRITE_FORBIDDEN'&&e.status===403);
});
