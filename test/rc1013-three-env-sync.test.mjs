import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1013 ist der gemeinsame autoritative Versionsmarker',()=>{
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1013'/);
});

test('RC1013 baut Produktion TESTSERVICE und Demo aus demselben Restpunkte-Quellstand',()=>{
  const build=read('.github/rc1013/build-three-env.mjs');
  for(const term of ["VERSION='RC1013'","environment=production-candidate","environment=testservice","environment=demo","dist-rc1013","rc1013-diagnostics.js","rc1013-gate41-ui.js","serverToken","Deutschland"]) {
    assert.match(build,new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
});

test('Standarddeploy veröffentlicht RC1013 gemeinsam und prüft alle drei Umgebungen live',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(flow,/ExportHUB RC1013 Drei-Umgebungen Deploy/);
  assert.match(flow,/node \.github\/rc1013\/build-three-env\.mjs/);
  assert.match(flow,/test\/rc1013-restpunkte\.test\.mjs/);
  assert.match(flow,/test\/rc1013-three-env-sync\.test\.mjs/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
  assert.match(flow,/Live RC1013 Produktion TESTSERVICE und Demo prüfen/);
  assert.match(flow,/dist-rc1013\/index\.html/);
  assert.match(flow,/dist-rc1013\/TESTVERSION\.html/);
  assert.match(flow,/dist-rc1013\/demo\.html/);
  assert.match(flow,/assets\/rc1013-diagnostics\.js/);
  assert.match(flow,/assets\/rc1013-gate41-ui\.js/);
});

test('Main-Contract prüft den RC1013-Stand',()=>{
  const flow=read('.github/workflows/rc1002-main-contract.yml');
  assert.match(flow,/RC1013 Main Contract/);
  assert.match(flow,/test\/rc1013-restpunkte\.test\.mjs/);
  assert.match(flow,/test\/rc1013-three-env-sync\.test\.mjs/);
  assert.match(flow,/node \.github\/rc1013\/build-three-env\.mjs/);
  assert.match(flow,/dist-rc1013\/index\.html/);
  assert.match(flow,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1013'/);
});

test('TESTSERVICE Einzeldeploy bleibt unter RC1013 ausschließlich genehmigte Ausnahme',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/Produktion, TESTSERVICE und Demo müssen denselben Versionsstand haben/);
  assert.match(flow,/RC1013/);
  assert.match(flow,/node \.github\/rc1013\/build-three-env\.mjs/);
});

test('Android-App bleibt auf demselben RC1013-Releasestand',()=>{
  const gradle=read('android-app/app/build.gradle.kts');
  const flow=read('.github/workflows/exporthub-android-test-app.yml');
  const info=JSON.parse(read('android-app/app-build-info.json'));
  assert.match(gradle,/versionCode\s*=\s*1013/);
  assert.match(gradle,/versionName\s*=\s*"1\.0-rc1013"/);
  assert.match(flow,/Build ExportHUB Android RC1013 APK/);
  assert.match(flow,/ExportHUB-RC1013-Android/);
  assert.equal(info.appVersion,'1.0-rc1013');
  assert.equal(info.releaseCandidate,'RC1013');
});

test('Aktuelle RC1013-Freigaben erzwingen nicht mehr den historischen RC995-Einmal-Avis',()=>{
  for(const file of [
    '.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml',
    '.github/workflows/rc1002-main-contract.yml',
    '.github/workflows/exporthub-testservice.yml'
  ]){
    const flow=read(file);
    assert.doesNotMatch(flow,/\.github\/rc995\/rc995-flow\.test\.cjs/,`${file}: veralteter RC995-Einmal-Avis darf den aktuellen Release nicht sperren`);
    assert.match(flow,/test\/rc1011-core-open-issues\.test\.mjs/,`${file}: aktueller wiederverwendbarer Lieferavis-Vertrag muss geprüft werden`);
  }
});
