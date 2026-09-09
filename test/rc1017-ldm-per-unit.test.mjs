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

test('RC1017: row.ldm bleibt LDM pro physischer Einheit beim Split',()=>{
  const m=loadModel();
  const fitRows=rows=>({fits:rows.reduce((sum,row)=>sum+Number(row.count||0),0)<=2});
  const result=m.planSubShipments({
    shipmentId:'LDM001',
    rows:[{id:'r1',type:'Europalette',count:3,weight:300,ldm:0.20}],
    fitRows
  });
  assert.equal(result.requiredTruckCount,2);
  assert.deepEqual(plain(result.subShipments.map(x=>x.totalColli)),[2,1]);
  assert.deepEqual(plain(result.subShipments.map(x=>x.rows[0].ldm)),[0.20,0.20]);
  assert.deepEqual(plain(result.subShipments.map(x=>Number(x.totalLdm.toFixed(2)))),[0.40,0.20]);
  assert.equal(Number(result.subShipments.reduce((sum,x)=>sum+x.totalLdm,0).toFixed(2)),0.60);
});

test('RC1017: LDM-Summe bleibt über mehrere Quellzeilen vollständig erhalten',()=>{
  const m=loadModel();
  const fitRows=rows=>({fits:rows.reduce((sum,row)=>sum+Number(row.count||0),0)<=2});
  const rows=[
    {id:'a',type:'Europalette',count:3,weight:300,ldm:0.20},
    {id:'b',type:'Industriepalette',count:2,weight:180,ldm:0.40}
  ];
  const result=m.planSubShipments({shipmentId:'LDM002',rows,fitRows});
  const expected=3*0.20+2*0.40;
  const actual=result.subShipments.reduce((sum,x)=>sum+x.totalLdm,0);
  assert.equal(Number(actual.toFixed(2)),Number(expected.toFixed(2)));
  for(const sub of result.subShipments){
    for(const row of sub.rows){
      const source=rows.find(x=>x.id===row.sourceRowId);
      assert.equal(row.ldm,source.ldm);
    }
  }
});
