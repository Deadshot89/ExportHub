import test from 'node:test';
import assert from 'node:assert/strict';
import av from '../api/shared/av-check.js';

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
