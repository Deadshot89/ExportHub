import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {verify,inspect}=require('../api/shared/pickup-transport-registration-proof.js');
const environment='testservice',companyKey='essentra',pickupDate='2026-11-09',pickupTargetId='FIX-UK';
const id='MAIN-UK',ref='REF-UK',resourceKey='a'.repeat(64);
const subject={environment,subjectId:id,shipmentId:id,reference:ref,resourceKey};
const pickupRecord={environment,shipmentId:id,reference:ref,accessKey:resourceKey,status:'open',expectedColliCount:5};
const shipment={id,reference:ref,companyId:companyKey,plannedPickupDate:pickupDate,status:'open'};
const target={id:pickupTargetId,weekday:1,active:true};
const binding={shipmentId:id,reference:ref,pickupTargetId,pickupDate,companyKey,environment,active:true};
const req=(extra={})=>({environment,companyKey,pickupDate,pickupTargetId,subject,pickupRecord,
 shipments:[shipment],fixedTargets:[target],...extra});
test('separate persisted binding makes a registered main shipment verifiable without touching team state',()=>{
 const row=verify(req({storedBinding:binding}));
 assert.equal(row.id,id);assert.equal(row.pickupTargetId,pickupTargetId);assert.equal(row.registered,true);
 assert.equal(shipment.pickupTargetId,undefined);
});
test('without team or separate persisted binding, normal GET fails closed',()=>{
 assert.throws(()=>verify(req()),{code:'TRANSPORT_FIX_BINDING_MISSING'});
});
test('explicit pre-bind inspection accepts a registered main shipment without a prior binding',()=>{
 assert.equal(verify(req({permitNewBinding:true})).registered,true);
});
test('a conflicting existing binding cannot be silently overwritten',()=>{
 const old={...binding,pickupTargetId:'FIX-FR'};
 assert.throws(()=>verify(req({storedBinding:old})),{code:'TRANSPORT_FIX_BINDING_CONFLICT'});
 assert.throws(()=>verify(req({storedBinding:old,permitNewBinding:true})),{code:'TRANSPORT_FIX_BINDING_CONFLICT'});
 assert.equal(verify(req({storedBinding:old,permitNewBinding:true,confirmOverride:true})).registered,true);
});
test('stale main shipment team field is never silently replaced by the separate binding',()=>{
 const stale={...shipment,pickupTargetId:'FIX-FR',pickupTargetCompanyKey:companyKey};
 assert.throws(()=>verify(req({shipments:[stale],storedBinding:binding,permitNewBinding:true,confirmOverride:true})),
  {code:'TRANSPORT_FIX_BINDING_CONFLICT'});
});
test('a saved binding with mismatched company, date or REF blocks verification',()=>{
 for(const corrupt of [{...binding,companyKey:'foreign'},{...binding,environment:'production'},
  {...binding,pickupDate:'2026-11-10'},{...binding,reference:'WRONG-REF'}]){
  assert.throws(()=>verify(req({storedBinding:corrupt})),{code:'TRANSPORT_BINDING_IDENTITY_MISMATCH'});
 }
});
test('inspect loads previously saved binding from the authenticated server store, not caller fields',async()=>{
 const read=[];
 const result=await inspect({environment,companyKey,pickupDate,pickupTargetId,shipmentId:id,
  team:{state:{shipments:[shipment]}},
  accessStore:{async inspectPickupSubject(){return subject}},
  pickupStore:{async getRecord(){return {record:pickupRecord}}},
  fixedStore:{async list(){return [target]}},
  bindingStore:{async read(s){read.push(s);return {bindings:[binding]}}}
 });
 assert.equal(result.id,id);assert.equal(read.length,1);
 assert.deepEqual(read[0],{environment,companyKey});
});
test('untrusted duplicate main bindings fail closed, even with one matching row',async()=>{
 await assert.rejects(inspect({environment,companyKey,pickupDate,pickupTargetId,shipmentId:id,
  team:{state:{shipments:[shipment]}},
  accessStore:{async inspectPickupSubject(){return subject}},
  pickupStore:{async getRecord(){return {record:pickupRecord}}},
  fixedStore:{async list(){return [target]}},
  bindingStore:{async read(){return {bindings:[binding,{...binding,pickupTargetId:'FIX-FR'}]}}}
 }),{code:'TRANSPORT_BINDING_AMBIGUOUS'});
});
