import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1011 ist der gemeinsame autoritative Versionsmarker',()=>{
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1011'/);
});

test('RC1011 Build erzeugt Produktion TESTSERVICE und Demo aus demselben Stand',()=>{
  assert.equal(fs.existsSync('.github/rc1011/build-three-env.mjs'),true,'RC1011 Drei-Umgebungen-Build fehlt');
  const build=read('.github/rc1011/build-three-env.mjs');
  for(const term of ["VERSION='RC1011'","environment=production-candidate","environment=testservice","environment=demo","dist-rc1011","rc1010-sop-release.js","abholkalender.js"]) {
    assert.match(build,new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`${term} fehlt im RC1011 Build`);
  }
});

test('Standard-Deploy veröffentlicht RC1011 gemeinsam und prüft alle drei Umgebungen live',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(flow,/ExportHUB RC1011 Drei-Umgebungen Deploy/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
  assert.match(flow,/Live RC1011 Produktion TESTSERVICE und Demo prüfen/);
  assert.match(flow,/node \.github\/rc1011\/build-three-env\.mjs/);
  assert.match(flow,/rc1011-abholkalender-completion\.test\.mjs/);
  assert.match(flow,/rc1010-sop-release\.js/,'bestehender freigegebener SOP-Layer muss erhalten bleiben');
});

test('TESTSERVICE Einzeldeploy bleibt auch unter RC1011 nur als genehmigte Ausnahme möglich',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/Produktion, TESTSERVICE und Demo müssen denselben Versionsstand haben/);
  assert.match(flow,/RC1011/);
  assert.match(flow,/\.github\/rc1011\/build-three-env\.mjs/);
});

test('Android-App folgt exakt dem gemeinsamen RC1011 Release',()=>{
  const gradle=read('android-app/app/build.gradle.kts');
  assert.match(gradle,/versionCode\s*=\s*1011/);
  assert.match(gradle,/versionName\s*=\s*"1\.0-rc1011"/);
  const info=JSON.parse(read('android-app/app-build-info.json'));
  assert.equal(info.appVersion,'1.0-rc1011');
  assert.equal(info.releaseCandidate,'RC1011');
  assert.match(read('android-app/APP_BUILD_INFO.txt'),/App-Version:\s*1\.0-rc1011/);
  const workflow=read('.github/workflows/exporthub-android-test-app.yml');
  assert.match(workflow,/Build ExportHUB Android RC1011 APK/);
  assert.match(workflow,/ExportHUB-RC1011-Android/);
});
