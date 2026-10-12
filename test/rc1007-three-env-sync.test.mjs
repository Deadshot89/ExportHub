import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');

test('historischer RC1007 Drei-Umgebungen-Build bleibt als reproduzierbare Baseline erhalten',()=>{
  assert.ok(fs.existsSync('.github/rc1007/build-three-env.mjs'),'RC1007 Drei-Umgebungen-Build fehlt');
  const build=read('.github/rc1007/build-three-env.mjs');
  assert.match(build,/const VERSION='RC1007'/);
  assert.match(build,/environment=production-candidate/);
  assert.match(build,/environment=testservice/);
  assert.match(build,/environment=demo/);
});

test('RC1505: aktueller Main-Release verifiziert gemeinsam, deployt aber nicht Production',()=>{
  const marker=read('production-version.js');
  assert.doesNotMatch(marker,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1007'/);
  const workflow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(workflow,/ExportHUB RC1112 Main Verification/);
  assert.match(workflow,/Deploy ExportHUB TESTSERVICE/);
  assert.match(workflow,/demo\.html/);
  assert.doesNotMatch(workflow,/Deploy ExportHUB production/);
});

test('Einzel-TESTSERVICE-Deploy bleibt als explizite Ausnahme geschützt',()=>{
  const workflow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(workflow,/confirm_divergence/);
  assert.match(workflow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(workflow,/Abweichender Einzel-Deploy ist gesperrt/);
});
