import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('.github/rc1044/build-three-env.mjs','utf8');

test('RC1044 Dashboard zeigt als offen nur noch nicht abgeholte Sendungen',()=>{
  assert.match(src,/function shipmentDashboardOpenList\(\)/);
  assert.match(src,/workspaceShipmentPickedUp/);
  assert.match(src,/var list=shipmentDashboardOpenList\(\)/);
  assert.match(src,/var total=isTask\?taskOpenList\(\)\.length:shipmentDashboardOpenList\(\)\.length/);
  assert.match(src,/openShipments=shipmentDashboardOpenList\(\)/);
});

test('RC1044 Kern-Dashboard wertet Abholung als nicht mehr offen',()=>{
  assert.match(src,/function dashboardShipmentPickedUp\(s\)/);
  assert.match(src,/shipmentDone\(s\).*dashboardShipmentPickedUp\(s\)/);
  assert.match(src,/noch nicht abgeholt/);
});

test('RC1044 Teilabholungen bleiben im Dashboard offen',()=>{
  assert.match(src,/teilabhol\|partial/);
});

test('RC1044 Warncenter behält eigene offene Arbeitsmenge für fehlende PODs',()=>{
  assert.match(src,/function warningData\(\)[\s\S]*?var ss=shipmentOpenList\(\)/);
});

test('RC1044 Dashboard-Fix wird auf Produktion TESTSERVICE und Demo gebaut',()=>{
  assert.match(src,/html=patchDashboardOpenShipments\(html,file\)/);
  assert.match(src,/for\(const file of \['index\.html','TESTVERSION\.html','demo\.html'\]\)patchHtml\(file\)/);
});
