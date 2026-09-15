import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
