import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readMainFlow,readProductionFlow,readReleaseContract,readLiveContract} from './helpers/rc1505-release-contract.mjs';

const read=p=>fs.readFileSync(p,'utf8');
function currentRc(){
  const match=read('production-version.js').match(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC(\d+)'/);
  assert.ok(match,'Autoritativer Produktions-RC fehlt');
  return Number(match[1]);
}

test('RC1016 Bestandsschutz bleibt im gesplitteten Standardrelease für Production TESTSERVICE und Demo',()=>{
  const main=readMainFlow(),production=readProductionFlow(),rc=currentRc();
  assert.ok(rc>=1016,`Aktueller Release RC${rc} darf nicht hinter RC1016 zurückfallen`);
  assert.match(main,new RegExp(`name:\\s*ExportHUB RC${rc} Main Verification`));
  assert.match(main,new RegExp(`node \\.github\\/rc${rc}\\/build-three-env\\.mjs`));
  assert.match(main,new RegExp(`dist-rc${rc}\\/index\\.html`));
  assert.match(main,new RegExp(`dist-rc${rc}\\/TESTVERSION\\.html`));
  assert.match(main,new RegExp(`dist-rc${rc}\\/demo\\.html`));
  assert.match(main,/Deploy ExportHUB TESTSERVICE/);
  assert.doesNotMatch(main,/Deploy ExportHUB production/);
  assert.match(production,/name:\s*ExportHUB Production Release/);
  assert.match(production,/Deploy ExportHUB production/);
  assert.match(production,new RegExp(`node \\.github\\/rc${rc}\\/build-three-env\\.mjs`));
  assert.match(production,/node \.github\/rc1505\/verify-production-live\.mjs/);
  assert.doesNotMatch(main,/name:\s*ExportHUB RC1013 Drei-Umgebungen Deploy/);
});

test('RC1016 Bestandsschutz prüft die damaligen Funktionen und Sicherheitsregressionen weiterhin vor Veröffentlichung',()=>{
  const main=readMainFlow(),release=readReleaseContract();
  for(const required of [
    'test/rc1016-release-sync.test.mjs',
    'test/rc1016-sop-consolidation.test.mjs',
    'test/rc1014-task-lifecycle.test.mjs',
    'test/rc1014-demo-session-calendar.test.mjs',
    'test/rc1015-lieferavis-mail-flow.test.mjs',
    'test/rc1013-pickup-readonly-flow.test.mjs',
    '.github/rc998/partial-pickup-avis-contract.test.mjs',
    '.github/rc1000/rc1000-production-pickup.test.mjs'
  ])assert.ok(main.includes(required),`${required} fehlt in der Main Verification`);
  assert.match(release,/assets\/rc1016-mobile-navigation\.js\?v=1400/);
  assert.match(release,/assets\/rc1014-task-runtime\.js\?v=1359/,'Release-Vertrag muss den RC1359 Aufgaben-Runtime-Cache-Key verwenden');
  assert.match(release,/assets\/rc1014-shipment-overview\.js\?v=1370/,'Release-Vertrag muss den RC1370 Shipment-Overview-Cache-Key verwenden');
  assert.match(release,/assets\/rc1014-shipment-overview\.css\?v=1370/,'Release-Vertrag muss auch den RC1370 Overview-CSS-Cache-Key verwenden');
  assert.match(release,/assets\/rc1015-lieferavis-mail-flow\.js\?v=1383/);
});

test('RC1361: RC1048-Buildgenerator und RC1505 Release-Vertrag verwenden denselben Shipment-Overview-Cache-Key',()=>{
  const release=readReleaseContract(),build=read('.github/rc1048/build-three-env.mjs');
  for(const asset of [
    'assets/rc1014-shipment-overview.js?v=1370',
    'assets/rc1014-shipment-overview.css?v=1370'
  ]){
    assert.ok(release.includes(asset),asset+' fehlt im Release-Vertrag');
    assert.ok(build.includes(asset),asset+' fehlt im RC1048-Buildgenerator');
  }
  assert.doesNotMatch(build,/assets\/rc1014-shipment-overview\.(?:js|css)\?v=1127/,'RC1048-Buildgenerator darf keinen veralteten RC1127 Shipment-Overview-Cache-Key mehr ausgeben');
});

test('RC1016 Laufzeitressourcen bleiben in der getrennten Production-Liveprüfung geschützt',()=>{
  const live=readLiveContract(),release=readReleaseContract(),rc=currentRc();
  assert.match(live,/RELEASE_SHA/);
  assert.match(release,new RegExp(`ExportHUB RC${rc} environment=production-candidate`));
  assert.match(release,new RegExp(`ExportHUB RC${rc} environment=testservice`));
  assert.match(release,new RegExp(`ExportHUB RC${rc} environment=demo`));
  assert.match(release,/rc1016-mobile-navigation\.js/);
  assert.match(release,/rc1016-tasks\.png/);
  assert.match(release,/rc1016-pickupcalendar\.png/);
});
