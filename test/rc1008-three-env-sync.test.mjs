import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('historischer RC1008 Drei-Umgebungen-Build bleibt als reproduzierbare Baseline erhalten',()=>{
  assert.ok(fs.existsSync('.github/rc1008/build-three-env.mjs'),'RC1008 Drei-Umgebungen-Build fehlt');
  const build=read('.github/rc1008/build-three-env.mjs');
  assert.match(build,/const VERSION='RC1008'/);
  assert.match(build,/environment=production-candidate/);
  assert.match(build,/environment=testservice/);
  assert.match(build,/environment=demo/);
});

test('aktueller Standard-Deploy darf RC1008 nicht mehr als Freigabestand festschreiben',()=>{
  const marker=read('production-version.js');
  assert.doesNotMatch(marker,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1008'/);
  const workflow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(workflow,/Deploy ExportHUB production/);
  assert.match(workflow,/Deploy ExportHUB TESTSERVICE/);
  assert.match(workflow,/demo\.html/);
});

test('Einzel-TESTSERVICE-Deploy bleibt weiterhin nur als explizite Ausnahme möglich',()=>{
  const workflow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(workflow,/confirm_divergence/);
  assert.match(workflow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(workflow,/Abweichender Einzel-Deploy ist gesperrt/);
});
