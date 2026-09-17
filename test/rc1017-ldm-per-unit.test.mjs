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
function plain(value){return JSON.parse(JSON.stringify(value));}

test('RC1149: Mehr-LKW verwendet tatsächliche Boden-LDM aus den Abmessungen',()=>{
  const m=loadModel();
  const fitRows=rows=>({fits:rows.reduce((sum,row)=>sum+Number(row.count||0),0)<=2});
  const result=m.planSubShipments({
    shipmentId:'LDM001',
    rows:[{id:'r1',type:'Europalette',count:3,weight:300,ldm:0.20,l:120,w:80,h:100}],
    fitRows
  });
  assert.equal(result.requiredTruckCount,2);
  assert.deepEqual(plain(result.subShipments.map(x=>x.totalColli)),[2,1]);
  assert.deepEqual(plain(result.subShipments.map(x=>Number(x.rows[0].ldm.toFixed(2)))),[0.40,0.40]);
  assert.deepEqual(plain(result.subShipments.map(x=>Number(x.totalLdm.toFixed(2)))),[0.80,0.40]);
  assert.equal(Number(result.subShipments.reduce((sum,x)=>sum+x.totalLdm,0).toFixed(2)),1.20);
});

test('RC1149: gestapelte Paletten zählen nur die tatsächlich belegten Bodenplätze',()=>{
  const m=loadModel();
  const fitRows=rows=>({fits:rows.reduce((sum,row)=>sum+Number(row.count||0),0)<=2});
  const result=m.planSubShipments({
    shipmentId:'LDM002',
    rows:[{id:'r1',type:'Gestapelte Euro Palette',count:3,weight:300,ldm:0.20,l:120,w:80,h:220}],
    fitRows
  });
  assert.equal(result.requiredTruckCount,2);
  assert.deepEqual(plain(result.subShipments.map(x=>x.totalColli)),[2,1]);
  assert.deepEqual(plain(result.subShipments.map(x=>Number(x.totalLdm.toFixed(2)))),[0.40,0.40]);
  assert.equal(Number(result.subShipments.reduce((sum,x)=>sum+x.totalLdm,0).toFixed(2)),0.80);
  assert.equal(Number(result.subShipments[0].rows[0].ldm.toFixed(2)),0.20);
  assert.equal(Number(result.subShipments[1].rows[0].ldm.toFixed(2)),0.40);
});

test('RC1149: mehrere Verpackungsarten summieren ihre echte Stellfläche statt Stammdaten-LDM',()=>{
  const m=loadModel();
  const fitRows=rows=>({fits:rows.reduce((sum,row)=>sum+Number(row.count||0),0)<=2});
  const rows=[
    {id:'a',type:'Europalette',count:3,weight:300,ldm:0.20,l:120,w:80,h:100},
    {id:'b',type:'Industrie Palette',count:2,weight:180,ldm:0.40,l:120,w:100,h:100}
  ];
  const result=m.planSubShipments({shipmentId:'LDM003',rows,fitRows});
  const actual=result.subShipments.reduce((sum,x)=>sum+x.totalLdm,0);
  assert.equal(Number(actual.toFixed(2)),2.20);
});
