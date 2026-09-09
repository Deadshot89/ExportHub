import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadModel(){
  const code=fs.readFileSync('assets/rc1017-multi-truck.js','utf8');
  const sandbox={globalThis:{}};
  vm.runInNewContext(code,sandbox);
  return sandbox.globalThis.ExportHubMultiTruck;
}

function plain(value){ return JSON.parse(JSON.stringify(value)); }

test('RC1017: Ein-LKW-Sendung erzeugt keine operative Teilsendungsebene',()=>{
  const m=loadModel();
  const result=m.planSubShipments({shipmentId:'ABC123',rows:[{id:'r1',count:2,weight:200,ldm:.4}],fitRows:()=>({fits:true})});
  assert.equal(result.requiredTruckCount,1);
  assert.equal(result.subShipments.length,0);
});

test('RC1017: Überkapazität verteilt ganze physische Einheiten ohne Verlust',()=>{
  const m=loadModel();
  const fitRows=rows=>({fits:rows.reduce((n,r)=>n+Number(r.count||0),0)<=2});
  const result=m.planSubShipments({shipmentId:'ABC123',rows:[{id:'r1',count:3,weight:300,ldm:.6,type:'Palette'}],fitRows});
  assert.equal(result.requiredTruckCount,2);
  assert.deepEqual(plain(result.subShipments.map(x=>x.totalColli)),[2,1]);
  assert.equal(result.subShipments.flatMap(x=>x.rows).reduce((n,r)=>n+r.count,0),3);
  assert.equal(result.subShipments.reduce((n,x)=>n+x.totalWeight,0),300);
  assert.equal(Number(result.subShipments.reduce((n,x)=>n+x.totalLdm,0).toFixed(6)),.6);
});

test('RC1017: einzelne physische Einheit wird nie künstlich geteilt',()=>{
  const m=loadModel();
  let sawFraction=false;
  const fitRows=rows=>{
    if(rows.some(r=>!Number.isInteger(Number(r.count)))) sawFraction=true;
    return {fits:rows.reduce((n,r)=>n+Number(r.count||0),0)<=1};
  };
  const result=m.planSubShipments({shipmentId:'ONE001',rows:[{id:'single',count:1,weight:125,ldm:.2}],fitRows});
  assert.equal(result.requiredTruckCount,1);
  assert.equal(result.subShipments.length,0);
  assert.equal(sawFraction,false);
});

test('RC1017: gleiche Eingabe liefert deterministisch dieselbe Aufteilung',()=>{
  const m=loadModel();
  const fitRows=rows=>({fits:rows.reduce((n,r)=>n+Number(r.count||0),0)<=2});
  const input={shipmentId:'DET001',rows:[{id:'a',count:2,weight:200,ldm:.4},{id:'b',count:2,weight:100,ldm:.2}],fitRows};
  const a=m.planSubShipments(input);
  const b=m.planSubShipments(input);
  assert.deepEqual(plain(a.subShipments),plain(b.subShipments));
});

test('RC1017: gesperrte Aufteilung bleibt identisch',()=>{
  const m=loadModel();
  const previous=[{subShipmentId:'ABC123-TRUCK-1',sequence:1,total:2,rows:[{sourceRowId:'r1',count:2}],locked:true},{subShipmentId:'ABC123-TRUCK-2',sequence:2,total:2,rows:[{sourceRowId:'r1',count:1}],locked:false}];
  const result=m.planSubShipments({shipmentId:'ABC123',rows:[{id:'r1',count:4}],previousSubShipments:previous,locked:true,fitRows:()=>({fits:true})});
  assert.deepEqual(plain(result.subShipments),previous);
  assert.equal(result.changed,false);
  assert.equal(result.locked,true);
});

test('RC1017: validatePartition erkennt Mengenfehler',()=>{
  const m=loadModel();
  assert.throws(()=>m.validatePartition('S1',[{id:'r1',count:3}],[{subShipmentId:'S1-TRUCK-1',sequence:1,total:2,rows:[{sourceRowId:'r1',count:1}]},{subShipmentId:'S1-TRUCK-2',sequence:2,total:2,rows:[{sourceRowId:'r1',count:1}]}]),/PARTITION_COUNT_MISMATCH/);
});

test('RC1017: validatePartition erkennt doppelte physische Einheiten',()=>{
  const m=loadModel();
  assert.throws(()=>m.validatePartition('S1',[{id:'r1',count:2}],[{subShipmentId:'S1-TRUCK-1',sequence:1,total:2,rows:[{sourceRowId:'r1',count:2,unitIds:['r1#1','r1#2']}]},{subShipmentId:'S1-TRUCK-2',sequence:2,total:2,rows:[{sourceRowId:'r1',count:1,unitIds:['r1#2']}]}]),/DUPLICATE_PHYSICAL_UNIT|PARTITION_COUNT_MISMATCH/);
});

test('RC1017: validatePartition prüft stabile IDs und Sequenzen',()=>{
  const m=loadModel();
  assert.throws(()=>m.validatePartition('S1',[{id:'r1',count:2}],[{subShipmentId:'WRONG',sequence:1,total:2,rows:[{sourceRowId:'r1',count:1}]},{subShipmentId:'S1-TRUCK-2',sequence:2,total:2,rows:[{sourceRowId:'r1',count:1}]}]),/INVALID_SUBSHIPMENT_ID/);
  assert.throws(()=>m.validatePartition('S1',[{id:'r1',count:2}],[{subShipmentId:'S1-TRUCK-1',sequence:2,total:2,rows:[{sourceRowId:'r1',count:1}]},{subShipmentId:'S1-TRUCK-2',sequence:2,total:2,rows:[{sourceRowId:'r1',count:1}]}]),/INVALID_SUBSHIPMENT_SEQUENCE/);
});
