import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {verify,inspect}=require('../api/shared/pickup-transport-registration-proof.js');
const environment='testservice',companyKey='essentra',pickupDate='2026-11-09',pickupTargetId='FIX-UK';
const id='SHIPMENT-UK-MAIN',ref='REF-UK-MAIN',resourceKey='a'.repeat(64);
const subject={environment,subjectId:id,shipmentId:id,reference:ref,resourceKey};
const pickupRecord={environment,shipmentId:id,reference:ref,accessKey:resourceKey,status:'open',complete:false,expectedColliCount:5};
const shipment={id,reference:ref,companyId:companyKey,plannedPickupDate:pickupDate,pickupTargetId,pickupTargetCompanyKey:companyKey,status:'open'};
const fix={id:pickupTargetId,weekday:1,active:true,siteLabel:'Essentra UK'};
const sources=(overrides={})=>({environment,companyKey,pickupDate,pickupTargetId,
  subject,pickupRecord,shipments:[shipment],fixedTargets:[fix],...overrides});
test('registered main shipment is verified by persisted shipmentId, REF, pickup record and FIX ID',()=>{
 const t=verify(sources());
 assert.equal(t.id,id);assert.equal(t.shipmentId,id);assert.equal(t.reference,ref);
 assert.equal(t.pickupTargetId,pickupTargetId);assert.equal(t.registered,true);
 assert.equal(t.environment,environment);assert.equal(t.companyKey,companyKey);
});
test('the name Essentra UK alone cannot replace the persisted FIX binding',()=>{
 assert.throws(()=>verify(sources({shipments:[{...shipment,pickupTargetId:''}]})),{code:'TRANSPORT_FIX_BINDING_MISSING'});
});
test('a missing registration never creates a link from a shipment alone',()=>{
 assert.throws(()=>verify(sources({subject:null})),{code:'TRANSPORT_NOT_REGISTERED'});
});
test('sub-shipment subject is not silently treated as the registered main shipment',()=>{
 assert.throws(()=>verify(sources({subject:{...subject,subjectId:id+'::sub-1'}})),{code:'TRANSPORT_SUBJECT_MISMATCH'});
 assert.throws(()=>verify(sources({pickupRecord:{...pickupRecord,subShipmentId:'sub-1'}})),{code:'TRANSPORT_PICKUP_MISMATCH'});
});
test('pickup record must match its secret-free index identity and environment',()=>{
 assert.throws(()=>verify(sources({pickupRecord:{...pickupRecord,accessKey:'b'.repeat(64)}})),{code:'TRANSPORT_PICKUP_MISMATCH'});
 assert.throws(()=>verify(sources({pickupRecord:{...pickupRecord,environment:'production'}})),{code:'TRANSPORT_PICKUP_MISMATCH'});
 assert.throws(()=>verify(sources({pickupRecord:{...pickupRecord,reference:'WRONG'}})),{code:'TRANSPORT_PICKUP_MISMATCH'});
});
test('confirmed, cancelled and finished pickup records block new grouping',()=>{
 for(const row of [
  {...pickupRecord,status:'confirmed'}, {...pickupRecord,complete:true},
  {...pickupRecord,deleted:true},{...pickupRecord,remainingPickupCollis:0}
 ])assert.throws(()=>verify(sources({pickupRecord:row})),{code:'TRANSPORT_PICKUP_LOCKED'});
});
test('both cancelled and already collected main shipments are excluded',()=>{
 for(const row of [{...shipment,deleted:true},{...shipment,shipmentStatus:'abgeholt'}])
   assert.throws(()=>verify(sources({shipments:[row]})),{code:'TRANSPORT_SHIPMENT_LOCKED'});
});
test('missing, duplicated or inactive FIX target fails closed',()=>{
 assert.throws(()=>verify(sources({fixedTargets:[]})),{code:'TRANSPORT_FIX_UNVERIFIED'});
 assert.throws(()=>verify(sources({fixedTargets:[fix,fix]})),{code:'TRANSPORT_FIX_UNVERIFIED'});
 assert.throws(()=>verify(sources({fixedTargets:[{...fix,active:false}]})),{code:'TRANSPORT_FIX_UNVERIFIED'});
});
test('FIX weekday must match the exact pickup calendar day',()=>{
 assert.throws(()=>verify(sources({fixedTargets:[{...fix,weekday:2}]})),{code:'TRANSPORT_FIX_WRONG_DAY'});
});
test('a different company, REF, or pickup date cannot hijack the main shipment',()=>{
 assert.throws(()=>verify(sources({shipments:[{...shipment,companyId:'foreign'}]})),{code:'TRANSPORT_SHIPMENT_MISMATCH'});
 assert.throws(()=>verify(sources({shipments:[{...shipment,reference:'FOREIGN'}]})),{code:'TRANSPORT_SHIPMENT_MISMATCH'});
 assert.throws(()=>verify(sources({shipments:[{...shipment,plannedPickupDate:'2026-11-10'}]})),{code:'TRANSPORT_DATE_MISMATCH'});
});
test('two conflicting saved copies of the same shipment are never picked arbitrarily',()=>{
 assert.throws(()=>verify(sources({shipments:[shipment,{...shipment,pickupTargetId:'FIX-FR'}]})),
   {code:'TRANSPORT_SHIPMENT_AMBIGUOUS'});
 assert.equal(verify(sources({shipments:[shipment,{...shipment}]})).id,id);
});
test('a legacy missing explicit pickup target cannot be inferred from customer or label',()=>{
 const stale={...shipment,siteLabel:'Essentra UK',customerNumber:'123'};
 delete stale.pickupTargetId;
 assert.throws(()=>verify(sources({shipments:[stale]})),{code:'TRANSPORT_FIX_BINDING_MISSING'});
});
test('read-only inspector uses authoritative server adapters and never persists anything',async()=>{
 const calls=[];
 const result=await inspect({
  environment,companyKey,pickupDate,pickupTargetId,shipmentId:id,
  team:{state:{shipments:[shipment],savedShipments:[{...shipment}]}},
  accessStore:{async inspectPickupSubject(env,sid){calls.push(['access',env,sid]);return subject}},
  pickupStore:{async getRecord(key,env){calls.push(['record',key,env]);return {record:pickupRecord}}},
  fixedStore:{async list(env,company){calls.push(['fix',env,company]);return [fix]}}
 });
 assert.equal(result.id,id);assert.equal(result.registered,true);
 assert.deepEqual(calls,[['access',environment,id],['record',resourceKey,environment],['fix',environment,companyKey]]);
 assert.equal(JSON.stringify(result).includes(resourceKey),false);
});
test('inspector fails on missing source without reading other records',async()=>{
 let readCount=0;
 await assert.rejects(inspect({environment,companyKey,pickupDate,pickupTargetId,shipmentId:id,
   team:{state:{shipments:[shipment]}},
   accessStore:{async inspectPickupSubject(){return null}},
   pickupStore:{async getRecord(){readCount++;return {record:pickupRecord}}},
   fixedStore:{async list(){readCount++;return [fix]}}
 }),{code:'TRANSPORT_NOT_REGISTERED'});
 assert.equal(readCount,0);
});
