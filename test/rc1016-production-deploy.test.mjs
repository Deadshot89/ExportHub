import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const FLOW='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
function currentRc(){
  const match=read('production-version.js').match(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC(\d+)'/);
  assert.ok(match,'Autoritativer Produktions-RC fehlt');
  return Number(match[1]);
}

test('RC1016 Bestandsschutz bleibt im aktuellen gemeinsamen Standarddeploy für Produktion TESTSERVICE und Demo',()=>{
  const flow=read(FLOW),rc=currentRc();
  assert.ok(rc>=1016,`Aktueller Release RC${rc} darf nicht hinter RC1016 zurückfallen`);
  assert.match(flow,new RegExp(`name:\\s*ExportHUB RC${rc} Drei-Umgebungen Deploy`));
  assert.match(flow,new RegExp(`node \\.github\\/rc${rc}\\/build-three-env\\.mjs`));
  assert.match(flow,new RegExp(`dist-rc${rc}\\/index\\.html`));
  assert.match(flow,new RegExp(`dist-rc${rc}\\/TESTVERSION\\.html`));
  assert.match(flow,new RegExp(`dist-rc${rc}\\/demo\\.html`));
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
  assert.match(flow,new RegExp(`Live RC${rc} Produktion TESTSERVICE und Demo prüfen`));
  assert.doesNotMatch(flow,/name:\s*ExportHUB RC1013 Drei-Umgebungen Deploy/);
});

test('RC1016 Bestandsschutz prüft die damaligen Funktionen und Sicherheitsregressionen weiterhin vor Veröffentlichung',()=>{
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
  ])assert.ok(flow.includes(required),`${required} fehlt im aktuellen Standarddeploy`);
  assert.match(flow,/assets\/rc1016-mobile-navigation\.js\?v=1016/);
  assert.match(flow,/assets\/rc1014-task-runtime\.js\?v=1016/);
  assert.match(flow,/assets\/rc1014-shipment-overview\.js\?v=1016/);
  assert.match(flow,/assets\/rc1015-lieferavis-mail-flow\.js\?v=1021/);
});

test('RC1016 Laufzeitressourcen bleiben in der aktuellen Drei-Umgebungen-Liveprüfung geschützt',()=>{
  const flow=read(FLOW),rc=currentRc();
  assert.match(flow,new RegExp(`rc${rc}=\\$GITHUB_SHA-\\$attempt`));
  assert.match(flow,new RegExp(`ExportHUB RC${rc} environment=production-candidate`));
  assert.match(flow,new RegExp(`ExportHUB RC${rc} environment=testservice`));
  assert.match(flow,new RegExp(`ExportHUB RC${rc} environment=demo`));
  assert.match(flow,/rc1016-mobile-navigation\.js/);
  assert.match(flow,/rc1016-tasks\.png/);
  assert.match(flow,/rc1016-pickupcalendar\.png/);
});
