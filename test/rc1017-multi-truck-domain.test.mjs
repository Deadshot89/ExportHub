import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { splitIntoLoadUnits, summarizeLoadUnits, deriveMultiTruckProgress } = require('../api/shared/multi-truck.js');

const profile={id:'standard-truck',name:'Standard-LKW',maxLdm:13.6,maxWeightKg:24000,active:true};

test('RC1017: 20 Paletten werden ohne Verlust deterministisch auf mehrere LKW verteilt',()=>{
  const rows=[{id:'r1',type:'Euro Palette',count:20,weight:16000,ldm:16}];
  const first=splitIntoLoadUnits(rows,profile,{shipmentId:'s1',ref:'ABC123',splitVersion:1});
  const second=splitIntoLoadUnits(rows,profile,{shipmentId:'s1',ref:'ABC123',splitVersion:1});
  assert.deepEqual(first,second);
  assert.equal(first.length,2);
  const sum=summarizeLoadUnits(first);
  assert.equal(sum.count,20);
  assert.equal(sum.weightKg,16000);
  assert.equal(sum.ldm,16);
});

test('RC1017: einzelne übergroße Einheit blockiert automatische Planung',()=>{
  assert.throws(()=>splitIntoLoadUnits([{id:'r1',type:'Maschine',count:1,weight:25000,ldm:5}],profile,{shipmentId:'s1',ref:'ABC123',splitVersion:1}),/Manuelle Ladeplanung erforderlich/);
});

test('RC1017: Fortschritt wird aus Teil-LKW abgeleitet',()=>{
  const progress=deriveMultiTruckProgress([{status:'Abgeholt'},{status:'Bereit zur Abholung'}]);
  assert.equal(progress.pickedUp,1);
  assert.equal(progress.total,2);
  assert.equal(progress.label,'1/2 abgeholt');
});
