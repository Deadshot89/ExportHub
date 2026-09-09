import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const FLOW='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';

test('RC1016 ist der aktuelle gemeinsame Standarddeploy für Produktion TESTSERVICE und Demo',()=>{
  const flow=read(FLOW);
  assert.match(flow,/name:\s*ExportHUB RC1016 Drei-Umgebungen Deploy/);
  assert.match(flow,/node \.github\/rc1016\/build-three-env\.mjs/);
  assert.match(flow,/dist-rc1016\/index\.html/);
  assert.match(flow,/dist-rc1016\/TESTVERSION\.html/);
  assert.match(flow,/dist-rc1016\/demo\.html/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
  assert.match(flow,/Live RC1016 Produktion TESTSERVICE und Demo prüfen/);
  assert.doesNotMatch(flow,/name:\s*ExportHUB RC1013 Drei-Umgebungen Deploy/);
});

test('RC1016 Standarddeploy prüft die neuen Funktionen und erhaltenen Sicherheitsregressionen vor Veröffentlichung',()=>{
  const flow=read(FLOW);
  for(const required of [
    'test/rc1016-release-sync.test.mjs',
    'test/rc1016-sop-consolidation.test.mjs',
    'test/rc1014-task-lifecycle.test.mjs',
    'test/rc1014-demo-session-calendar.test.mjs',
    'test/rc1015-lieferavis-mail-flow.test.mjs',
    'test/rc1013-pickup-readonly-flow.test.mjs',
    '.github/rc998/partial-pickup-avis-contract.test.mjs',
    '.github/rc1000/rc1000-production-pickup.test.mjs'
  ])assert.ok(flow.includes(required),`${required} fehlt im RC1016 Standarddeploy`);
  assert.match(flow,/assets\/rc1016-mobile-navigation\.js\?v=1016/);
  assert.match(flow,/assets\/rc1014-task-runtime\.js\?v=1016/);
  assert.match(flow,/assets\/rc1014-shipment-overview\.js\?v=1016/);
  assert.match(flow,/assets\/rc1015-lieferavis-mail-flow\.js\?v=1015/);
});

test('RC1016 Liveprüfung bestätigt alle drei Oberflächen und neue statische Laufzeitressourcen',()=>{
  const flow=read(FLOW);
  assert.match(flow,/rc1016=\$GITHUB_SHA-\$attempt/);
  assert.match(flow,/ExportHUB RC1016 environment=production-candidate/);
  assert.match(flow,/ExportHUB RC1016 environment=testservice/);
  assert.match(flow,/ExportHUB RC1016 environment=demo/);
  assert.match(flow,/rc1016-mobile-navigation\.js/);
  assert.match(flow,/rc1016-tasks\.png/);
  assert.match(flow,/rc1016-pickupcalendar\.png/);
});
