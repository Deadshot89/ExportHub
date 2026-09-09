import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
function currentRc(){
  const match=read('production-version.js').match(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC(\d+)'/);
  assert.ok(match,'Autoritativer Produktionsmarker fehlt');
  return Number(match[1]);
}

test('RC1013 bleibt als historische Drei-Umgebungen-Baseline reproduzierbar',()=>{
  const build=read('.github/rc1013/build-three-env.mjs');
  for(const term of ["VERSION='RC1013'","environment=production-candidate","environment=testservice","environment=demo","dist-rc1013","rc1013-diagnostics.js","rc1013-gate41-ui.js","serverToken","Deutschland"]) {
    assert.match(build,new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
});

test('aktueller autoritativer Versionsmarker fällt nicht hinter RC1013 zurück',()=>{
  assert.ok(currentRc()>=1013,`Aktueller RC ${currentRc()} ist älter als RC1013`);
});

test('aktueller Standarddeploy veröffentlicht Produktion und TESTSERVICE gemeinsam und prüft alle drei Umgebungen live',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
  assert.match(flow,/Produktion TESTSERVICE und Demo prüfen|Produktion, TESTSERVICE und Demo|Live RC\d+ Produktion TESTSERVICE und Demo prüfen/);
  assert.match(flow,/node \.github\/rc\d+\/build-three-env\.mjs/);
});

test('Main-Contract bewahrt die RC1013-Regression und folgt einem aktuellen gemeinsamen Release',()=>{
  const flow=read('.github/workflows/rc1002-main-contract.yml');
  assert.match(flow,/test\/rc1013-restpunkte\.test\.mjs/);
  assert.match(flow,/test\/rc1013-three-env-sync\.test\.mjs/);
  assert.match(flow,/node \.github\/rc\d+\/build-three-env\.mjs/);
});

test('TESTSERVICE Einzeldeploy bleibt ausschließlich genehmigte Ausnahme',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/Produktion, TESTSERVICE und Demo müssen denselben Versionsstand haben/);
  assert.match(flow,/node \.github\/rc\d+\/build-three-env\.mjs/);
});

test('Android-App liegt mindestens auf RC1013 und bleibt separat versioniert prüfbar',()=>{
  const gradle=read('android-app/app/build.gradle.kts');
  const info=JSON.parse(read('android-app/app-build-info.json'));
  const code=Number((gradle.match(/versionCode\s*=\s*(\d+)/)||[])[1]||0);
  assert.ok(code>=1013,`Android versionCode ${code} ist älter als RC1013`);
  assert.equal(info.releaseCandidate,`RC${code}`);
  assert.equal(info.appVersion,`1.0-rc${code}`);
});

test('aktuelle Freigaben prüfen den Nur-Lesen-Pickup und behalten nur die gültige historische PIN-Sicherheit',()=>{
  for(const file of [
    '.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml',
    '.github/workflows/rc1002-main-contract.yml',
    '.github/workflows/exporthub-testservice.yml'
  ]){
    const flow=read(file);
    assert.doesNotMatch(flow,/node --test \.github\/rc995\/rc995-flow\.test\.cjs/,`${file}: kompletter historischer RC995-Flow darf den heutigen Nur-Lesen-Status nicht mehr als Fehler werten`);
    assert.match(flow,/node --test test\/rc1013-pickup-readonly-flow\.test\.mjs/,`${file}: Pickup-Nur-Lesen-Vertrag muss geprüft werden`);
    assert.match(flow,/--test-name-pattern='RC995 Pickup-PIN' \.github\/rc995\/rc995-flow\.test\.cjs/,`${file}: historische PIN-Sperrsicherheit muss weiter geprüft werden`);
    assert.doesNotMatch(flow,/RC995 Pickup-Bedienfluss\|RC995 Pickup-PIN/,`${file}: veralteter RC995-Abschlussstatus darf nicht Teil der aktuellen Freigabe sein`);
    assert.match(flow,/\.github\/rc998\/partial-pickup-avis-contract\.test\.mjs/,`${file}: Teilabholung und Lieferavis müssen weiter geprüft werden`);
    assert.match(flow,/\.github\/rc1000\/rc1000-production-pickup\.test\.mjs/,`${file}: Produktions-Pickup-Vertrag muss weiter geprüft werden`);
    assert.match(flow,/test\/rc1011-core-open-issues\.test\.mjs/,`${file}: wiederverwendbarer Lieferavis-Vertrag muss geprüft werden`);
  }
});
