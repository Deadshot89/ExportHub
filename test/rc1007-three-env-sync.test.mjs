import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');

test('RC1007 ist der gemeinsame Freigabestand für Produktion TESTSERVICE und Demo',()=>{
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1007'/);
  assert.ok(fs.existsSync('.github/rc1007/build-three-env.mjs'),'RC1007 Drei-Umgebungen-Build fehlt');
  const build=read('.github/rc1007/build-three-env.mjs');
  assert.match(build,/const VERSION='RC1007'/);
  assert.match(build,/environment=production-candidate/);
  assert.match(build,/environment=testservice/);
  assert.match(build,/environment=demo/);
});

test('Standard-Deploy veröffentlicht RC1007 immer gemeinsam in allen drei Systemen',()=>{
  const workflow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(workflow,/ExportHUB RC1007 Drei-Umgebungen Deploy/);
  assert.match(workflow,/\.github\/rc1007\/build-three-env\.mjs/);
  assert.match(workflow,/Deploy ExportHUB production/);
  assert.match(workflow,/Deploy ExportHUB TESTSERVICE/);
  assert.match(workflow,/demo\.html/);
  assert.match(workflow,/Live RC1007 Produktion TESTSERVICE und Demo prüfen/);
});

test('Einzel-TESTSERVICE-Deploy kann die Synchronregel nicht unbeabsichtigt verletzen',()=>{
  const workflow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(workflow,/confirm_divergence/);
  assert.match(workflow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(workflow,/Abweichender Einzel-Deploy ist gesperrt/);
});
