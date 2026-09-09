import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

function api(){return require('../api/shared/multi-truck-pickup.js')}
function shipment(){return {id:'s1',ref:'ABC123',status:'Erstellt',processStatus:'Erstellt',multiTruck:{enabled:true,splitVersion:2,loadUnits:[
  {id:'u1',sequence:1,total:2,status:'Bereit zur Abholung',rows:[{id:'r1',count:4,weight:800,ldm:1.6}],pickup:{},pod:{}},
  {id:'u2',sequence:2,total:2,status:'Bereit zur Abholung',rows:[{id:'r2',count:3,weight:600,ldm:1.2}],pickup:{},pod:{}}
]}}}

test('RC1017 Pickup: jeder Teil-LKW erhält eine eigene Public-Access-Identität',()=>{
  const p=api();
  assert.equal(p.pickupSubjectId('s1','u1',2),'s1|load:u1|split:2');
  assert.equal(p.pickupSubjectId('s1','u2',2),'s1|load:u2|split:2');
  assert.notEqual(p.pickupSubjectId('s1','u1',2),p.pickupSubjectId('s1','u2',2));
  assert.equal(p.pickupSubjectId('s1','',0),'s1');
});

test('RC1017 Pickup: veraltete splitVersion wird sicher abgewiesen',()=>{
  const p=api();
  assert.throws(()=>p.resolveLoadUnit(shipment(),'u1',1),e=>e&&e.code==='PICKUP_SPLIT_OUTDATED');
  assert.equal(p.resolveLoadUnit(shipment(),'u1',2).id,'u1');
});

test('RC1017 Pickup: Snapshot enthält ausschließlich Colli des gewählten LKW',()=>{
  const p=api(),sh=shipment(),snap=p.buildLoadUnitSnapshot(sh,'u2',2);
  assert.equal(snap.loadUnitId,'u2');
  assert.equal(snap.loadUnitSequence,2);
  assert.equal(snap.loadUnitTotal,2);
  assert.equal(snap.splitVersion,2);
  assert.deepEqual(snap.rows.map(r=>r.id),['r2']);
});

test('RC1017 Pickup: Abschluss von LKW 1 verändert LKW 2 nicht und Hauptstatus wartet auf alle LKW',()=>{
  const p=api(),sh=shipment();
  const next=p.applyPickupRecordToShipment(sh,{shipmentId:'s1',reference:'ABC123',loadUnitId:'u1',splitVersion:2,status:'confirmed',confirmedAt:'2026-09-09T13:00:00Z',pickupHistory:[{id:'p1',confirmedAt:'2026-09-09T13:00:00Z',colliCount:4,complete:true}],podFiles:[{id:'pod1',kind:'signed-loadlist'}]});
  assert.equal(next.multiTruck.loadUnits.find(x=>x.id==='u1').status,'POD vorhanden');
  assert.equal(next.multiTruck.loadUnits.find(x=>x.id==='u2').status,'Bereit zur Abholung');
  assert.equal(next.status,'Erstellt');
});

test('RC1017 Pickup: wenn alle Teil-LKW POD haben, folgt der Hauptstatus',()=>{
  const p=api(),sh=shipment();
  sh.multiTruck.loadUnits[0].status='POD vorhanden';
  sh.multiTruck.loadUnits[1].status='POD vorhanden';
  const next=p.deriveMainShipmentStatus(sh);
  assert.equal(next.status,'POD vorhanden');
  assert.equal(next.processStatus,'POD vorhanden');
});

test('RC1017 Pickup: bestehende API-Pfade sind explizit an loadUnitId und splitVersion angebunden',()=>{
  const init=fs.readFileSync('api/pickup-init/index.js','utf8');
  const store=fs.readFileSync('api/shared/pickup-store.js','utf8');
  assert.match(init,/multi-truck-pickup/);
  assert.match(init,/loadUnitId/);
  assert.match(init,/splitVersion/);
  assert.match(init,/pickupSubjectId/);
  assert.match(store,/multi-truck-pickup/);
  assert.match(store,/applyPickupRecordToShipment/);
});
