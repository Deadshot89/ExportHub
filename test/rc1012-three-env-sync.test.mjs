import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1012 ist der gemeinsame autoritative Versionsmarker',()=>{
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1012'/);
});

test('RC1012 baut Produktion TESTSERVICE und Demo mit dem Kalender aus demselben Quellstand',()=>{
  const build=read('.github/rc1012/build-three-env.mjs');
  for(const term of ["VERSION='RC1012'","environment=production-candidate","environment=testservice","environment=demo","dist-rc1012","abholkalender.js","abholkalender.css","rc1012-abholkalender-runtime.js"]) {
    assert.match(build,new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
});

test('Standarddeploy veröffentlicht RC1012 gemeinsam und prüft alle drei Umgebungen live',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(flow,/ExportHUB RC1012 Drei-Umgebungen Deploy/);
  assert.match(flow,/node \.github\/rc1012\/build-three-env\.mjs/);
  assert.match(flow,/test\/rc1012-abholkalender-completion\.test\.mjs/);
  assert.match(flow,/test\/rc1012-abholkalender-runtime-integration\.test\.mjs/);
  assert.match(flow,/test\/rc1012-three-env-sync\.test\.mjs/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
  assert.match(flow,/Live RC1012 Produktion TESTSERVICE und Demo prüfen/);
  assert.match(flow,/dist-rc1012\/index\.html/);
  assert.match(flow,/dist-rc1012\/TESTVERSION\.html/);
  assert.match(flow,/dist-rc1012\/demo\.html/);
  assert.match(flow,/assets\/abholkalender\.js/);
  assert.match(flow,/assets\/rc1012-abholkalender-runtime\.js/);
});

test('Main-Contract prüft den RC1012-Stand',()=>{
  const flow=read('.github/workflows/rc1002-main-contract.yml');
  assert.match(flow,/RC1012 Main Contract/);
  assert.match(flow,/test\/rc1012-three-env-sync\.test\.mjs/);
  assert.match(flow,/node \.github\/rc1012\/build-three-env\.mjs/);
  assert.match(flow,/dist-rc1012\/index\.html/);
  assert.match(flow,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1012'/);
});

test('TESTSERVICE Einzeldeploy bleibt unter RC1012 ausschließlich genehmigte Ausnahme',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/Produktion, TESTSERVICE und Demo müssen denselben Versionsstand haben/);
  assert.match(flow,/RC1012/);
  assert.match(flow,/node \.github\/rc1012\/build-three-env\.mjs/);
});

test('Android-App bleibt auf demselben RC1012-Releasestand',()=>{
  const gradle=read('android-app/app/build.gradle.kts');
  const flow=read('.github/workflows/exporthub-android-test-app.yml');
  assert.match(gradle,/versionCode\s*=\s*1012/);
  assert.match(gradle,/versionName\s*=\s*"1\.0-rc1012"/);
  assert.match(flow,/Build ExportHUB Android RC1012 APK/);
  assert.match(flow,/ExportHUB-RC1012-Android/);
});
