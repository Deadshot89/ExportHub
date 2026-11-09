import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {propose}=require('../api/shared/pickup-transport-association-rules.js');
const date='2026-11-09',companyKey='essentra',environment='testservice';
const transport={id:'transport-UK-20261109',pickupTargetId:'FIX-UK',companyKey,pickupDate:date,registered:true,siteLabel:'Essentra UK'};
const task={id:'pick-UK',pickupTargetId:'FIX-UK',pickupTargetCompanyKey:companyKey,customerNumber:'00123, 00045, 00067',recurrence:'weekly',weekdays:[1]};
const sh=(reference,customerNumber,rest={})=>({reference,customerNumber,companyId:'essentra',plannedPickupDate:date,pickupStatus:'open',...rest});
const args=extras=>({companyKey,environment,pickupDate:date,transports:[transport],tasks:[task],shipments:[sh('REF-A','123'),sh('REF-B','45')],...extras});
test('A, B and later C associate only with registered exact transport ID and date',()=>{
 const first=propose(args({}));assert.deepEqual(first.proposals.map(x=>x.ref),['REF-A','REF-B']);
 assert.ok(first.proposals.every(x=>x.transportId===transport.id));
 const next=propose(args({shipments:[sh('REF-A','123'),sh('REF-B','45'),sh('REF-C','00067')]}));
 assert.deepEqual(next.proposals.map(x=>x.ref),['REF-A','REF-B','REF-C']);
});
test('transport display name must never be used as a match or an unregistered pickup',()=>{
 const noId=propose(args({transports:[{...transport,id:'',siteLabel:'Essentra UK'}]}));
 assert.deepEqual(noId.proposals,[]);
 const noRegister=propose(args({transports:[{...transport,registered:false}]}));
 assert.deepEqual(noRegister.proposals,[]);
});
test('company and environment cannot be borrowed from another tenant or day',()=>{
 assert.deepEqual(propose(args({shipments:[sh('A','123',{companyId:'other'})]})).proposals,[]);
 assert.deepEqual(propose(args({transports:[{...transport,companyKey:'other'}]})).proposals,[]);
 assert.deepEqual(propose(args({shipments:[sh('A','123',{plannedPickupDate:'2026-11-10'})]})).proposals,[]);
 assert.throws(()=>propose(args({pickupDate:'2026-11-31'})),{code:'ASSOCIATION_SCOPE_INVALID'});
 assert.throws(()=>propose(args({environment:'demo'})),{code:'ASSOCIATION_SCOPE_INVALID'});
});
test('cancelled and completed shipments are not newly linked, even with conflicting status aliases',()=>{
 const r=propose(args({shipments:[sh('A','123',{shipmentStatus:'Storniert'}),sh('B','45',{status:'abgeholt'}),sh('C','67',{remainingPickupCollis:0,expectedColliCount:2}),sh('D','123')]}));
 assert.deepEqual(r.proposals.map(x=>x.ref),['D']);
});
test('the same account appearing in two FIX tasks or transports blocks a silent association',()=>{
 const other={...transport,id:'transport-FR',pickupTargetId:'FIX-FR'};
 const overlapping={...task,pickupTargetId:'FIX-FR',customerNumber:'00045'};
 const r=propose(args({transports:[transport,other],tasks:[task,overlapping]}));
 assert.deepEqual(r.proposals.map(x=>x.ref),['REF-A']);
 assert.ok(r.conflicts.some(x=>x.code==='TRANSPORT_ASSIGNMENT_AMBIGUOUS'&&x.ref==='REF-B'));
});
test('the same FIX with two registered transports is ambiguous, never arbitrarily picked',()=>{
 const r=propose(args({transports:[transport,{...transport,id:'transport-UK-2'}]}));
 assert.deepEqual(r.proposals,[]);
 assert.ok(r.conflicts.some(x=>x.code==='TRANSPORT_ASSIGNMENT_AMBIGUOUS'));
});
test('manual links survive resync and are not overwritten even after task edit',()=>{
 const existing={ref:'REF-A',transportId:'MANUAL-OTHER',pickupDate:date,mode:'manual',active:true};
 const r=propose(args({existingLinks:[existing]}));
 assert.deepEqual(r.proposals.map(x=>x.ref),['REF-B']);
 assert.ok(r.conflicts.some(x=>x.code==='MANUAL_OVERRIDE_PROTECTED'&&x.ref==='REF-A'));
 assert.equal(existing.transportId,'MANUAL-OTHER');
});
test('explicitly cleared customer number never comes back from stale linkedAccount',()=>{
 const r=propose(args({tasks:[{...task,customerNumber:'',linkedAccount:'123,45'}]}));
 assert.deepEqual(r.proposals,[]);
});
test('duplicate REF records are blocked rather than double counted',()=>{
 const r=propose(args({shipments:[sh('REF-A','123'),sh('REF-A','123'),sh('REF-B','45')]}));
 assert.deepEqual(r.proposals.map(x=>x.ref),['REF-B']);
 assert.ok(r.conflicts.some(x=>x.code==='SHIPMENT_REF_AMBIGUOUS'&&x.ref==='REF-A'));
});
test('proposals are pure and never alter status, QR or POD',()=>{
 const input=args({shipments:[sh('REF-A','123',{pod:{signed:true},qrCode:'secret'})]});
 const before=JSON.stringify(input);
 const out=propose(input);assert.equal(out.proposals.length,1);assert.equal(JSON.stringify(input),before);
});
