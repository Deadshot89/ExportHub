import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const build=fs.readFileSync('.github/rc1013/build-three-env.mjs','utf8');

test('RC1017: Multi-Truck-Asset wird in allen gebauten Umgebungen ausgeliefert',()=>{
  assert.match(build,/rc1017-multi-truck\.js/);
  assert.match(html,/renderRc1017SubShipments/);
});

test('RC1017: Adapter verwendet ausschließlich den bestehenden Stauplan als Fit-Quelle',()=>{
  assert.match(html,/function\s+rc1017FitRows\s*\(/);
  assert.match(html,/buildStowPlan\s*\(\s*[^,]+\s*,\s*currentStowVehicle\s*\(\s*\)\s*\)/);
  assert.match(html,/overflowCm\s*\)\s*<=\s*0|overflowCm\s*<=\s*0/);
});

test('RC1017: Teilsendungen werden in der Hauptsendung persistiert und vor Nutzung validiert',()=>{
  assert.match(html,/function\s+rc1017SyncSubShipments\s*\(/);
  assert.match(html,/validatePartition\s*\(/);
  assert.match(html,/subShipments/);
  assert.match(html,/multiTruckLocked/);
  assert.match(html,/requiredTruckCount/);
});

test('RC1017: operative Nutzung sperrt spätere automatische Neuaufteilung',()=>{
  assert.match(html,/pickupHistory/);
  assert.match(html,/podFiles/);
  assert.match(html,/partial/);
  assert.match(html,/confirmed/);
  assert.match(html,/Die LKW-Aufteilung ist bereits in Verwendung/);
});
