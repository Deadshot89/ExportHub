import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
function currentRc(){
  const match=read('production-version.js').match(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC(\d+)'/);
  assert.ok(match,'Autoritativer Produktions-RC fehlt');
  return Number(match[1]);
}

test('RC1011 bleibt als historische Drei-Umgebungen-Baseline reproduzierbar',()=>{
  const build=read('.github/rc1011/build-three-env.mjs');
  assert.match(build,/VERSION='RC1011'/);
  assert.match(build,/dist-rc1011/);
  assert.match(build,/environment=production-candidate/);
  assert.match(build,/environment=testservice/);
  assert.match(build,/environment=demo/);
});

test('aktueller gemeinsamer Versionsmarker darf nicht auf RC1011 zurückfallen',()=>{
  assert.ok(currentRc()>1011);
});

test('aktueller Standarddeploy darf RC1011 nicht mehr als Freigabestand festschreiben',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.doesNotMatch(flow,/ExportHUB RC1011 Drei-Umgebungen Deploy/);
  assert.doesNotMatch(flow,/node \.github\/rc1011\/build-three-env\.mjs/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
});

test('Main-Contract folgt dem aktuellen Release statt RC1011',()=>{
  const flow=read('.github/workflows/rc1002-main-contract.yml');
  assert.doesNotMatch(flow,/name: RC1011 Main Contract/);
  assert.doesNotMatch(flow,/node \.github\/rc1011\/build-three-env\.mjs/);
});

test('TESTSERVICE Einzeldeploy bleibt weiterhin nur als genehmigte Ausnahme möglich',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/Produktion, TESTSERVICE und Demo müssen denselben Versionsstand haben/);
});

test('Android-App folgt einem neueren gemeinsamen Release als RC1011',()=>{
  const rc=currentRc();
  const gradle=read('android-app/app/build.gradle.kts');
  assert.match(gradle,new RegExp(`versionCode\\s*=\\s*${rc}`));
  assert.match(gradle,new RegExp(`versionName\\s*=\\s*"1\\.0-rc${rc}"`));
});
