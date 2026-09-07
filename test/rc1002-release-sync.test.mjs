import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

function buildVersion(file){
  const src=read(file);
  const m=src.match(/var BUILD=Object\.freeze\(\{version:'(RC\d+)'/);
  assert.ok(m,`${file}: kanonische BUILD-Version fehlt`);
  return m[1];
}

test('RC1002 Website, TESTSERVICE und Produktionsmarker sind auf derselben Version',()=>{
  assert.equal(buildVersion('index.html'),'RC1002');
  assert.equal(buildVersion('TESTVERSION.html'),'RC1002');
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__\s*=\s*['"]RC1002['"]/);
});

test('RC1002 Android-App trägt dieselbe Release-Version',()=>{
  const gradle=read('android-app/app/build.gradle.kts');
  assert.match(gradle,/versionCode\s*=\s*1002/);
  assert.match(gradle,/versionName\s*=\s*"1\.0-rc1002"/);
  const info=JSON.parse(read('android-app/app-build-info.json'));
  assert.equal(info.appVersion,'1.0-rc1002');
  assert.equal(info.releaseCandidate,'RC1002');
  assert.match(read('android-app/APP_BUILD_INFO.txt'),/App-Version:\s*1\.0-rc1002/);
  assert.match(read('android-app/APP_BUILD_INFO.txt'),/Release-Kandidat:\s*RC1002/);
});

test('RC1002 Produktionsworkflow baut und prüft RC1002',()=>{
  const src=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(src,/RC1002/);
  assert.match(src,/\.github\/rc1002\/build-three-env\.mjs/);
  assert.match(src,/\.rc1002_production_app/);
  assert.doesNotMatch(src,/ausschließlich für RC997 freigegeben/);
});

test('RC1002 Android-Workflow erzeugt RC1002 APK-Artefakt',()=>{
  const src=read('.github/workflows/exporthub-android-test-app.yml');
  assert.match(src,/Build ExportHUB Android RC1002 APK/);
  assert.match(src,/ExportHUB-RC1002-Android-debug\.apk/);
  assert.match(src,/name:\s*ExportHUB-RC1002-Android/);
});

test('RC1002 Buildskript erzeugt drei Umgebungen aus demselben Stand',()=>{
  const src=read('.github/rc1002/build-three-env.mjs');
  assert.match(src,/const VERSION='RC1002'/);
  assert.match(src,/production-candidate/);
  assert.match(src,/testservice/);
  assert.match(src,/demo/);
});

test('RC1002 besitzt nur noch die vier dauerhaft aktiven Workflows',()=>{
  const active=[
    '.github/workflows/rc1002-main-contract.yml',
    '.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml',
    '.github/workflows/exporthub-testservice.yml',
    '.github/workflows/exporthub-android-test-app.yml'
  ];
  for(const file of active) assert.equal(fs.existsSync(file),true,`aktiver RC1002 Workflow fehlt: ${file}`);

  const obsolete=[
    '.github/workflows/rc997-website-final.yml',
    '.github/workflows/rc1000-production-qr-fix.yml',
    '.github/workflows/rc1001-task-tiles-cleanup.yml',
    '.github/workflows/rc1002-release-sync.yml',
    '.github/workflows/rc1002-task-groups.yml',
    '.github/workflows/rc1002-testservice-live.yml'
  ];
  for(const file of obsolete) assert.equal(fs.existsSync(file),false,`veralteter Workflow ist wieder vorhanden: ${file}`);
  assert.equal(fs.existsSync('.github/rc997/rc997-workflow-contract.test.mjs'),false,'veralteter RC997 Workflow-Vertrag ist wieder vorhanden');
});
