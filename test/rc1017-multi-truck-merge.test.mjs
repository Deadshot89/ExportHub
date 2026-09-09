import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {mergeState}=require('../api/shared/merge.js');

function unit(id,status,extra={}){
  return {id,sequence:Number(id.slice(-1))||1,total:2,status,rows:[{id:'row-'+id,count:1,weight:100,ldm:.4}],pickup:{},pod:{},generatedDocuments:[],...extra};
}
function shipment(updatedAt,multiTruck){return {id:'s1',ref:'ABC123',updatedAt,status:'Erstellt',rows:[{id:'r1',count:2,weight:200,ldm:.8}],multiTruck}}

test('RC1017 Merge: neuer leerer Client darf bestehende loadUnits nicht löschen',()=>{
  const server={shipments:[shipment('2026-09-09T10:00:00Z',{enabled:true,splitVersion:1,loadUnits:[unit('u1','Bereit zur Abholung'),unit('u2','Bereit zur Abholung')]})]};
  const incoming={shipments:[shipment('2026-09-09T10:01:00Z',{enabled:true,splitVersion:1,loadUnits:[]})]};
  const merged=mergeState(server,incoming);
  assert.equal(merged.shipments[0].multiTruck.loadUnits.length,2);
});

test('RC1017 Merge: stale Client darf abgeholten Teil-LKW nicht zurücksetzen',()=>{
  const server={shipments:[shipment('2026-09-09T10:00:00Z',{enabled:true,splitVersion:1,loadUnits:[unit('u1','Abgeholt',{pickup:{confirmedAt:'2026-09-09T10:00:00Z'}}),unit('u2','Bereit zur Abholung')]})]};
  const incoming={shipments:[shipment('2026-09-09T10:01:00Z',{enabled:true,splitVersion:1,loadUnits:[unit('u1','Bereit zur Abholung'),unit('u2','Bereit zur Abholung')]})]};
  const merged=mergeState(server,incoming);
  const u1=merged.shipments[0].multiTruck.loadUnits.find(x=>x.id==='u1');
  assert.equal(u1.status,'Abgeholt');
  assert.equal(u1.pickup.confirmedAt,'2026-09-09T10:00:00Z');
});

test('RC1017 Merge: neue Split-Version ersetzt offene Einheiten, bewahrt aber bereits abgeholte Einheiten',()=>{
  const server={shipments:[shipment('2026-09-09T10:00:00Z',{enabled:true,splitVersion:1,loadUnits:[unit('u1','Abgeholt'),unit('u2','Bereit zur Abholung')]})]};
  const incoming={shipments:[shipment('2026-09-09T10:02:00Z',{enabled:true,splitVersion:2,loadUnits:[unit('v1','Bereit zur Abholung'),unit('v2','Bereit zur Abholung'),unit('v3','Bereit zur Abholung')]})]};
  const merged=mergeState(server,incoming);
  const mt=merged.shipments[0].multiTruck;
  assert.equal(mt.splitVersion,2);
  assert.deepEqual(mt.loadUnits.map(x=>x.id).sort(),['u1','v1','v2','v3']);
});

test('RC1017 Merge: POD und generierte Dokumente werden je loadUnit.id verlustsicher zusammengeführt',()=>{
  const server={shipments:[shipment('2026-09-09T10:00:00Z',{enabled:true,splitVersion:1,loadUnits:[unit('u1','POD vorhanden',{pod:{confirmedAt:'2026-09-09T10:00:00Z'},generatedDocuments:[{id:'pod-1',kind:'pod'}]})]})]};
  const incoming={shipments:[shipment('2026-09-09T10:01:00Z',{enabled:true,splitVersion:1,loadUnits:[unit('u1','POD vorhanden',{generatedDocuments:[{id:'load-1',kind:'load-list'}]})]})]};
  const merged=mergeState(server,incoming);
  const u1=merged.shipments[0].multiTruck.loadUnits[0];
  assert.equal(u1.pod.confirmedAt,'2026-09-09T10:00:00Z');
  assert.deepEqual(u1.generatedDocuments.map(x=>x.id).sort(),['load-1','pod-1']);
});
