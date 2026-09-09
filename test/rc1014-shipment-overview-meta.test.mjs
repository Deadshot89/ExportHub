import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

function build(){
  execFileSync(process.execPath,['.github/rc1014/build-three-env.mjs'],{stdio:'pipe'});
}

function loadOverview(){
  const context={};
  context.globalThis=context;
  const source=fs.readFileSync('assets/rc1014-shipment-overview.js','utf8');
  vm.runInNewContext(source,context,{filename:'rc1014-shipment-overview.js'});
  return context.ExportHUBRC1014ShipmentOverview;
}

test('RC1014 formatiert Erfassungsdatum aus vorhandenem Sendungszeitstempel deutsch',()=>{
  const api=loadOverview();
  assert.equal(api.shipmentCreatedDate({createdAt:'2026-09-09T06:15:00Z'}),'09.09.2026');
  assert.equal(api.shipmentCreatedDate({created:'2026-09-08T11:30:00+02:00'}),'08.09.2026');
  assert.equal(api.shipmentCreatedDate({savedAt:'2026-09-07T08:00:00Z'}),'07.09.2026');
  assert.equal(api.shipmentCreatedDate({}),'—');
});

test('RC1014 Colli-Anzahl bevorzugt totalColli und colliCount',()=>{
  const api=loadOverview();
  assert.equal(api.shipmentColliCount({totalColli:7,colliCount:3}),7);
  assert.equal(api.shipmentColliCount({colliCount:4}),4);
});

test('RC1014 Colli-Anzahl fällt auf physische Colli-Zeilen zurück',()=>{
  const api=loadOverview();
  assert.equal(api.shipmentColliCount({colli:[{quantity:2},{count:3},{type:'Paket'}]}),6);
  assert.equal(api.shipmentColliCount({collis:[1,2,3]}),6);
  assert.equal(api.shipmentColliCount({packagingRows:[{qty:2},{amount:1}]}),3);
  assert.equal(api.shipmentColliCount({}),0);
});

test('RC1014 Metadaten zeigen Erfasst und Colli pro Sendung',()=>{
  const api=loadOverview();
  const meta=api.shipmentMeta({createdAt:'2026-09-09T06:15:00Z',totalColli:5});
  assert.equal(meta.createdLabel,'Erfasst: 09.09.2026');
  assert.equal(meta.colliLabel,'Colli: 5');
});

test('RC1014 Sendungsübersicht bindet Metadatenadapter und CSS in alle drei Umgebungen ein',()=>{
  build();
  for(const file of ['dist-rc1014/index.html','dist-rc1014/TESTVERSION.html','dist-rc1014/demo.html']){
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/assets\/rc1014-shipment-overview\.js\?v=1014/);
    assert.match(html,/assets\/rc1014-shipment-overview\.css\?v=1014/);
    assert.match(html,/ExportHUBRC1014ShipmentOverview\.remember\(state\.shipments\|\|\[\]\)/);
  }
});

test('RC1014 Übersichtsadapter ergänzt nur zuordenbare Sendungskarten und verändert keine Filterung',()=>{
  const source=fs.readFileSync('assets/rc1014-shipment-overview.js','utf8');
  assert.match(source,/function\s+enhanceShipmentOverview\s*\(/);
  assert.match(source,/data-exporthub-view[^\n]{0,120}shipmentoverview|shipmentoverview[^\n]{0,120}data-exporthub-view/i);
  assert.match(source,/Erfasst:/);
  assert.match(source,/Colli:/);
  assert.doesNotMatch(source,/state\.shipments\s*=|filter\s*\([^)]*state\.shipments/i);
});
