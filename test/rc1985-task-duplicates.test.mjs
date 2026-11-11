import test from 'node:test';
import assert from 'node:assert/strict';
import av from '../api/shared/av-check.js';
import merge from '../api/shared/merge.js';

const NOW='2026-11-11T11:00:00.000Z';

function shipment(account){
  return {id:'S-1',ref:'ABC123',customerAccount:account,customerName:'Example Customer',
    abdFiles:[{name:'ABD_ABC123.pdf'}]};
}

test('RC1985 new mandatory AV upload task includes the shipment customer number',()=>{
  const state={shipments:[shipment('001234')],tasks:[]};
  const result=av.applyUploadRequirement(state,'ABC123',[],NOW);
  assert.equal(result.status,'upload-pending');
  assert.equal(state.tasks.length,1);
  assert.equal(state.tasks[0].customerNumber,'001234');
  assert.equal(state.tasks[0].linkedAccount,'001234');
  assert.equal(state.tasks[0].linkedShipmentRef,'ABC123');
  assert.equal(state.shipments[0].customerAccount,'001234','shipment account is unchanged');
});

test('RC1985 two conflicting shipment copies never assign an unverified number',()=>{
  const state={shipments:[shipment('1001')],savedShipments:[{...shipment('2002'),id:'S-2'}],tasks:[]};
  const result=av.applyUploadRequirement(state,'ABC123',[],NOW);
  assert.equal(result.createdTask,true);
  assert.equal(Object.prototype.hasOwnProperty.call(state.tasks[0],'customerNumber'),false,
    'unknown customer must not become an explicitly cleared account');
  assert.equal(state.tasks[0].linkedAccount,'');
});

test('RC1985 verified AV missing scan creates account-linked task without changing shipment',()=>{
  const state={shipments:[shipment('3344')],tasks:[]};
  const result=av.applyResult(state,'ABC123',{avFiles:[]},NOW);
  assert.equal(result.status,'missing');
  assert.equal(state.tasks[0].customerNumber,'3344');
  assert.equal(state.tasks[0].linkedShipmentRef,'ABC123');
});

test('RC1985 existing explicitly cleared account is not restored by an AV check',()=>{
  const existing={id:'task:av-missing:ABC123',sourceType:'av_missing',
    linkedShipmentRef:'ABC123',customerNumber:'',linkedAccount:'',status:'offen'};
  const state={shipments:[shipment('3344')],tasks:[existing]};
  av.applyUploadRequirement(state,'ABC123',[],NOW);
  assert.equal(existing.customerNumber,'');
  assert.equal(existing.linkedAccount,'');
});


test('RC1985: confirmed task deletion survives later stale-device edits and keeps shipment originals',()=>{
  const original={
    shipments:[{id:'S-1',ref:'ABC123',customerAccount:'001234',status:'Bereit zur Abholung'}],
    tasks:[
      {id:'task:av-missing:ABC123',title:'AV hochladen',sourceType:'av_missing',
        updatedAt:'2026-11-11T08:00:00Z'},
      {id:'legacy-av-ABC123',title:'AV hochladen',sourceType:'av_missing',
        updatedAt:'2026-11-11T08:00:00Z'}
    ],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const deleting=JSON.parse(JSON.stringify(original));
  deleting.tasks=deleting.tasks.filter(task=>task.id!=='legacy-av-ABC123');
  deleting._teamSyncMeta.tombstones.push({collection:'tasks',id:'legacy-av-ABC123',
    deletedAt:'2026-11-11T10:00:00Z',explicitUserAction:true});
  const acknowledged=merge.mergeState(original,deleting);
  assert.deepEqual(acknowledged.tasks.map(task=>task.id),['task:av-missing:ABC123']);
  const stale=JSON.parse(JSON.stringify(original));
  stale.tasks[1].updatedAt='2026-11-11T12:00:00Z';
  stale.tasks[1]._syncUpdatedAt='2026-11-11T12:00:00Z';
  const afterOtherDevice=merge.mergeState(acknowledged,stale);
  assert.deepEqual(afterOtherDevice.tasks.map(task=>task.id),['task:av-missing:ABC123'],
    'an outdated device cannot resurrect a user-deleted task with a newer timestamp');
  assert.ok(afterOtherDevice._teamSyncMeta.tombstones.some(t=>
    t.collection==='tasks'&&t.id==='legacy-av-ABC123'&&t.explicitUserAction===true));
  assert.equal(afterOtherDevice.shipments[0].ref,'ABC123');
  assert.equal(afterOtherDevice.shipments[0].customerAccount,'001234');
  assert.equal(afterOtherDevice.shipments[0].status,'Bereit zur Abholung');
});

test('RC1985: stale task deletion does not block other new tasks or change shipment tombstone rules',()=>{
  const baseline={shipments:[{id:'S-1',ref:'ABC123',status:'Bereit zur Abholung'}],
    tasks:[{id:'to-delete',title:'Legacy',updatedAt:'2026-11-11T08:00:00Z'}],
    _teamSyncMeta:{fields:{},tombstones:[]}};
  const deleteState={tasks:[],_teamSyncMeta:{fields:{},tombstones:[{
    collection:'tasks',id:'to-delete',deletedAt:'2026-11-11T10:00:00Z',explicitUserAction:true
  }]}};
  const merged=merge.mergeState(baseline,deleteState);
  const next=merge.mergeState(merged,{tasks:[
    {id:'to-delete',title:'Unwanted restored copy',updatedAt:'2026-11-11T15:00:00Z'},
    {id:'new-independent-task',title:'Neue Aufgabe',updatedAt:'2026-11-11T15:00:00Z'}
  ],_teamSyncMeta:{fields:{},tombstones:[]}});
  assert.deepEqual(next.tasks.map(t=>t.id),['new-independent-task']);
  assert.equal(next.shipments[0].status,'Bereit zur Abholung');
});

test('RC1985: confirmed task deletion outlives normal tombstone retention',()=>{
  const old='2020-01-01T00:00:00Z';
  const state={tasks:[],_teamSyncMeta:{fields:{},tombstones:[
    {collection:'tasks',id:'deleted-manual-task',deletedAt:old,explicitUserAction:true},
    {collection:'tasks',id:'old-temporary-task',deletedAt:old},
    {collection:'shipments',id:'old-shipment',deletedAt:old,explicitUserAction:true}
  ]}};
  merge.pruneTombstones(state,1);
  assert.deepEqual(state._teamSyncMeta.tombstones.map(t=>t.id),['deleted-manual-task'],
    'confirmed task deletion is permanent; other collection retention rules remain unchanged');
  const stale=merge.mergeState(state,{tasks:[
    {id:'deleted-manual-task',title:'Offline legacy copy',updatedAt:new Date().toISOString()},
    {id:'new-task',title:'Fresh work',updatedAt:new Date().toISOString()}
  ],_teamSyncMeta:{fields:{},tombstones:[]}});
  assert.deepEqual(stale.tasks.map(task=>task.id),['new-task']);
});

test('RC1985: later automatic tombstone cannot downgrade user-confirmed deletion',()=>{
  const stored={tasks:[],_teamSyncMeta:{fields:{},tombstones:[{
    collection:'tasks',id:'deleted-task',deletedAt:'2026-11-11T10:00:00Z',
    explicitUserAction:true
  }]}};
  const stale={tasks:[{id:'deleted-task',title:'Reintroduced from stale device',
    updatedAt:'2026-11-11T14:00:00Z'}],_teamSyncMeta:{fields:{},tombstones:[{
      collection:'tasks',id:'deleted-task',deletedAt:'2026-11-11T12:00:00Z',
      explicitUserAction:false
  }]}};
  const merged=merge.mergeState(stored,stale);
  assert.deepEqual(merged.tasks,[],'confirmed deletion cannot be downgraded');
  assert.equal(merged._teamSyncMeta.tombstones[0].explicitUserAction,true);
  merge.pruneTombstones(merged,1);
  assert.equal(merged._teamSyncMeta.tombstones[0].explicitUserAction,true);
});
