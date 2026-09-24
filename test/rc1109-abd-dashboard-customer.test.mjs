import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1074-login-clean.js','utf8');
const config=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));

test('RC1109: ABD-Anfragen werden aus Request, Sendung oder Kundenstamm mit Kunde angereichert',()=>{
  assert.match(runtime,/customerName/);
  assert.match(runtime,/customerNumber/);
  assert.match(runtime,/customerId/);
  assert.match(runtime,/linkedShipmentId|linkedShipmentRef/);
  assert.match(runtime,/s&&s\.customers/);
});

test('RC1109: Dashboard-Karten zeigen den aufgelösten Kunden an',()=>{
  assert.match(runtime,/data-rc1109-abd-customer/);
  assert.match(runtime,/Kunde:/);
  assert.match(runtime,/MutationObserver/);
  assert.match(runtime,/exporthub:rendered/);
});

test('RC1269: ABD-Karten zeigen neben Kunde auch die physische Colli-Anzahl',()=>{
  assert.match(runtime,/data-rc1269-abd-colli/);
  assert.match(runtime,/Colli:/);
  assert.match(runtime,/resolveColli:rc1269ResolveColli/);
});

test('RC1269: Colli wird aus Request oder verknüpfter Sendung ermittelt ohne ABD-Altbestand zu migrieren',()=>{
  const document={readyState:'loading',addEventListener(){}};
  const window={document,addEventListener(){},setTimeout(){return 1},clearTimeout(){},console};
  vm.runInContext(runtime,vm.createContext({window,document,console,MutationObserver:function(){}}));
  const api=window.ExportHUBRC1109AbdDashboardCustomer;
  assert.equal(api.resolveColli({shipments:[]},{totalColli:7}),7);
  assert.equal(api.resolveColli({shipments:[{id:'S1',totalColli:5}]},{linkedShipmentId:'S1'}),5);
  assert.equal(api.resolveColli({shipments:[{ref:'ABC123',rows:[{count:2},{quantity:3}]}]},{ref:'ABC123'}),5);
  const oldRequest={id:'A1',ref:'ABC123'};
  const before=JSON.stringify(oldRequest);
  assert.equal(api.resolveColli({shipments:[{ref:'ABC123',colliCount:4}]},oldRequest),4);
  assert.equal(JSON.stringify(oldRequest),before,'bestehende ABD-Anfragen dürfen für die Colli-Anzeige nicht migriert werden');
});

test('RC1109: fehlende Kundendaten werden nur über den bestehenden Save-Pfad persistiert',()=>{
  assert.match(runtime,/queueSave/);
  assert.match(runtime,/flushSave/);
  assert.doesNotMatch(runtime,/fetch\s*\(\s*['\"]\/api\/exporthub-state/);
});

test('RC1109: bereits in allen drei Umgebungen geladene Runtime wird cachefrei ausgeliefert',()=>{
  const route=config.routes.find(r=>r.route==='/assets/rc1074-login-clean.js');
  assert.ok(route,'cachefreie RC1074/RC1109-Route fehlt');
  assert.match(String(route.headers&&route.headers['Cache-Control']||''),/no-store/i);
});

test('RC1109: QR-Bestandsschutz und kostenfreie Umsetzung bleiben unangetastet',()=>{
  const qr=fs.readFileSync('test/rc1045-qr-backward-compatibility.test.mjs','utf8');
  assert.match(qr,/historische QR-Linkformen bleiben auf pickup\.html lesbar/);
  assert.doesNotMatch(runtime,/api\.openai\.com|chatgpt\s*api/i);
});
