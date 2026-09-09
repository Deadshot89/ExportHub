import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const currentRc=()=>{
  const marker=read('production-version.js').match(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC(\d+)'/);
  return marker?Number(marker[1]):0;
};

test('RC1013 bleibt als historische Drei-Umgebungen-Baseline reproduzierbar',()=>{
  assert.ok(currentRc()>=1013,'aktueller Release darf nicht hinter RC1013 zurückfallen');
  const build=read('.github/rc1013/build-three-env.mjs');
  for(const term of ["VERSION='RC1013'","environment=production-candidate","environment=testservice","environment=demo","dist-rc1013","rc1013-diagnostics.js","rc1013-gate41-ui.js","serverToken","Deutschland"]) {
    assert.match(build,new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
});

test('Aktueller Standarddeploy bewahrt RC1013 Regressionen und veröffentlicht beide Live-Umgebungen gemeinsam',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(flow,/test\/rc1013-restpunkte\.test\.mjs/);
  assert.match(flow,/test\/rc1013-three-env-sync\.test\.mjs/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
  assert.match(flow,/Produktion TESTSERVICE und Demo/i);
});

test('Aktueller Main-Contract bewahrt den RC1013-Bestandsschutz',()=>{
  const flow=read('.github/workflows/rc1002-main-contract.yml');
  assert.match(flow,/test\/rc1013-restpunkte\.test\.mjs/);
  assert.match(flow,/test\/rc1013-three-env-sync\.test\.mjs/);
  assert.match(flow,/Gesamte Node-Regression|Gesamte Node-Regression|Gesamte Node/i);
});

test('TESTSERVICE Einzeldeploy bleibt ausschließlich genehmigte Ausnahme und prüft RC1013 weiter mit',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/Produktion, TESTSERVICE und Demo müssen denselben Versionsstand haben/);
  assert.match(flow,/test\/rc1013-restpunkte\.test\.mjs/);
  assert.match(flow,/test\/rc1013-three-env-sync\.test\.mjs/);
});

test('Android-App ist mindestens auf RC1013 und Metadaten Workflow und Gradle sind synchron',()=>{
  const gradle=read('android-app/app/build.gradle.kts');
  const flow=read('.github/workflows/exporthub-android-test-app.yml');
  const info=JSON.parse(read('android-app/app-build-info.json'));
  const code=Number((gradle.match(/versionCode\s*=\s*(\d+)/)||[])[1]||0);
  const name=(gradle.match(/versionName\s*=\s*"1\.0-rc(\d+)"/)||[])[1]||'';
  const infoRc=String(info.releaseCandidate||'').replace(/^RC/, '');
  assert.ok(code>=1013);
  assert.equal(String(code),name);
  assert.equal(String(code),infoRc);
  assert.equal(info.appVersion,`1.0-rc${code}`);
  assert.match(flow,new RegExp(`Build ExportHUB Android RC${code} APK`));
  assert.match(flow,new RegExp(`ExportHUB-RC${code}-Android`));
});

test('Aktuelle Freigaben prüfen aus RC995 nur noch gültige Pickup-Sicherheit und nicht den alten Einmal-Avis',()=>{
  for(const file of [
    '.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml',
    '.github/workflows/rc1002-main-contract.yml',
    '.github/workflows/exporthub-testservice.yml'
  ]){
    const flow=read(file);
    assert.doesNotMatch(flow,/node --test \.github\/rc995\/rc995-flow\.test\.cjs/,`${file}: kompletter historischer RC995-Flow darf den aktuellen wiederverwendbaren Avis nicht sperren`);
    assert.match(flow,/--test-name-pattern='RC995 Pickup-Bedienfluss\|RC995 Pickup-PIN' \.github\/rc995\/rc995-flow\.test\.cjs/,`${file}: gültige RC995 Pickup- und PIN-Sicherheit muss weiter geprüft werden`);
    assert.match(flow,/test\/rc1011-core-open-issues\.test\.mjs/,`${file}: aktueller wiederverwendbarer Lieferavis-Vertrag muss geprüft werden`);
  }
});
