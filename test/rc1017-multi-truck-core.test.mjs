import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function engine(){
  const source=fs.readFileSync('assets/rc1017-multi-truck.js','utf8');
  const sandbox={window:{},console};
  vm.runInNewContext(source,sandbox,{filename:'assets/rc1017-multi-truck.js'});
  return sandbox.window.ExportHUBRC1017MultiTruck;
}

const profile={id:'standard-truck',name:'Standard-LKW',maxLdm:13.6,maxWeightKg:24000,active:true};

function totals(units){
  return units.reduce((out,u)=>({
    count:out.count+Number(u.totalCount||0),
    weight:out.weight+Number(u.totalWeightKg||0),
    ldm:out.ldm+Number(u.totalLdm||0)
  }),{count:0,weight:0,ldm:0});
}

test('RC1017: 30 physische Paletten werden verlustfrei und deterministisch verteilt',()=>{
  const api=engine();
  const shipment={id:'ship-1',ref:'ABC123',rows:[{id:'r1',type:'Euro Palette',count:30,weight:15000,ldm:15}]};
  const first=api.splitShipment(shipment,profile);
  const second=api.splitShipment(shipment,profile);
  assert.equal(first.ok,true);
  assert.equal(first.multiTruck.enabled,true);
  assert.equal(first.multiTruck.loadUnits.length,2);
  assert.deepEqual(JSON.parse(JSON.stringify(first.multiTruck.loadUnits)),JSON.parse(JSON.stringify(second.multiTruck.loadUnits)));
  assert.deepEqual(totals(first.multiTruck.loadUnits),{count:30,weight:15000,ldm:15});
  assert.equal(first.multiTruck.loadUnits[0].id,'ship-1:split:1:truck:1');
  assert.equal(first.multiTruck.loadUnits[1].id,'ship-1:split:1:truck:2');
});

test('RC1017: Gewicht allein kann einen zweiten LKW erzwingen',()=>{
  const api=engine();
  const result=api.splitShipment({id:'ship-2',ref:'DEF456',rows:[{id:'r1',type:'Palette',count:2,weight:30000,ldm:2}]},profile);
  assert.equal(result.ok,true);
  assert.equal(result.multiTruck.loadUnits.length,2);
  assert.ok(result.multiTruck.loadUnits.every(u=>u.totalWeightKg<=24000));
});

test('RC1017: eine Sendung innerhalb der Kapazität bleibt eine Ladeeinheit',()=>{
  const api=engine();
  const result=api.splitShipment({id:'ship-3',ref:'GHI789',rows:[{id:'r1',type:'Palette',count:4,weight:2000,ldm:0.8}]},profile);
  assert.equal(result.ok,true);
  assert.equal(result.multiTruck.enabled,false);
  assert.equal(result.multiTruck.loadUnits.length,1);
  assert.equal(result.multiTruck.loadUnits[0].displayLabel,'GHI789 · LKW 1 von 1');
});

test('RC1017: eine einzelne übergroße physische Einheit blockiert automatische Planung',()=>{
  const api=engine();
  const result=api.splitShipment({id:'ship-4',ref:'JKL012',rows:[{id:'r1',type:'Sonderladung',count:1,weight:25000,ldm:1}]},profile);
  assert.equal(result.ok,false);
  assert.equal(result.error.code,'MANUAL_LOAD_PLANNING_REQUIRED');
  assert.match(result.error.message,/25\.000|24000|Gewicht/i);
});

test('RC1017: Fortschritt der Hauptsendung wird aus allen Ladeeinheiten abgeleitet',()=>{
  const api=engine();
  const progress=api.deriveProgress([
    {id:'u1',status:'POD vorhanden'},
    {id:'u2',status:'Abgeholt'},
    {id:'u3',status:'Bereit zur Abholung'}
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(progress)),{pickedUp:2,pod:1,total:3,label:'2/3 abgeholt · 1/3 POD',status:'Bereit zur Abholung'});
});
