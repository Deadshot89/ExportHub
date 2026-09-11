import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rc1044=fs.readFileSync('.github/rc1044/build-three-env.mjs','utf8');
const rc1045=fs.readFileSync('.github/rc1045/build-three-env.mjs','utf8');

test('RC1045 übernimmt den Dashboard-Filter aus RC1044',()=>{
  assert.match(rc1044,/function patchDashboardOpenShipments/);
  assert.match(rc1044,/shipmentDashboardOpenList/);
  assert.match(rc1044,/dashboardShipmentPickedUp/);
  assert.match(rc1044,/noch nicht abgeholt/);
  assert.match(rc1045,/\.github\/rc1044\/build-three-env\.mjs/);
});

test('RC1045 verweigert einen Build ohne korrekten Dashboard-Filter',()=>{
  assert.match(rc1045,/Dashboard-Filter für nicht abgeholte Sendungen fehlt/);
  assert.match(rc1045,/Kern-Dashboard erkennt Abholung nicht/);
  assert.match(rc1045,/Dashboard-Kachel ist fachlich nicht auf Abholung begrenzt/);
});
