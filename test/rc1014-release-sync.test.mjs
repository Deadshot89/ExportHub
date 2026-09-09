import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=rel=>fs.readFileSync(rel,'utf8');

test('RC1014 Produktionsmarker benennt gemeinsamen Aufgabenstand',()=>{
  const marker=read('production-version.js');
  assert.match(marker,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1014'/);
  assert.match(marker,/Produktion, TESTSERVICE und Demo/);
  assert.match(marker,/Aufgaben/i);
});

test('RC1014 gemeinsamer Build liefert Produktion TESTSERVICE Demo mit Aufgaben und Sendungsmetadaten',()=>{
  execFileSync(process.execPath,['.github/rc1014/build-three-env.mjs'],{stdio:'pipe'});
  for(const file of ['dist-rc1014/index.html','dist-rc1014/TESTVERSION.html','dist-rc1014/demo.html']){
    const html=read(file);
    assert.match(html,/ExportHUB RC1014 environment=/);
    assert.match(html,/version:'RC1014'/);
    assert.match(html,/assets\/rc1014-task-runtime\.js\?v=1014/);
    assert.match(html,/assets\/rc1014-shipment-overview\.js\?v=1014/);
  }
});

test('RC1014 Main Contract prüft aktuellen Release und echten Browser-Test',()=>{
  const flow=read('.github/workflows/rc1002-main-contract.yml');
  assert.match(flow,/name:\s*RC1014 Main Contract/);
  assert.match(flow,/test\/rc1014-release-sync\.test\.mjs/);
  assert.match(flow,/test\/rc1014-task-lifecycle\.test\.mjs/);
  assert.match(flow,/test\/rc1014-shipment-overview-meta\.test\.mjs/);
  assert.match(flow,/\.github\/rc1014\/build-three-env\.mjs/);
  assert.match(flow,/browser\/rc1014-visual-functional\.mjs/);
});

test('RC1014 Standarddeploy baut und prüft alle drei Umgebungen gemeinsam',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(flow,/name:\s*ExportHUB RC1014 Drei-Umgebungen Deploy/);
  assert.match(flow,/\.github\/rc1014\/build-three-env\.mjs/);
  assert.match(flow,/dist-rc1014\/index\.html/);
  assert.match(flow,/dist-rc1014\/TESTVERSION\.html/);
  assert.match(flow,/dist-rc1014\/demo\.html/);
  assert.match(flow,/Live RC1014 Produktion TESTSERVICE und Demo prüfen/);
  assert.match(flow,/assets\/rc1014-task-runtime\.js/);
  assert.match(flow,/assets\/rc1014-shipment-overview\.js/);
});

test('RC1014 TESTSERVICE Einzeldeploy bleibt mit exakter Freigabe gesperrt',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(flow,/Standard ist ab RC1014 der gemeinsame Drei-Umgebungen-Deploy/);
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/RC1014 TESTSERVICE-Ausnahmevertrag/);
  assert.match(flow,/\.github\/rc1014\/build-three-env\.mjs/);
  assert.match(flow,/dist-rc1014\/TESTVERSION\.html/);
});

test('RC1014 Android trägt dieselbe Releaseversion und baut eigenes Artefakt',()=>{
  const gradle=read('android-app/app/build.gradle.kts');
  const info=JSON.parse(read('android-app/app-build-info.json'));
  const flow=read('.github/workflows/exporthub-android-test-app.yml');
  assert.match(gradle,/versionCode\s*=\s*1014/);
  assert.match(gradle,/versionName\s*=\s*"1\.0-rc1014"/);
  assert.equal(info.appVersion,'1.0-rc1014');
  assert.equal(info.releaseCandidate,'RC1014');
  assert.match(flow,/Build ExportHUB Android RC1014 APK/);
  assert.match(flow,/ExportHUB-RC1014-Android/);
  assert.match(flow,/test\/rc1014-task-android\.test\.mjs/);
  assert.match(flow,/test\/rc1014-release-sync\.test\.mjs/);
});
