import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

test('RC1005: Produktion TESTSERVICE und Demo werden aus demselben Release-Build erzeugt', () => {
  assert.equal(fs.existsSync('.github/rc1005/build-three-env.mjs'), true, 'RC1005 Drei-Umgebungen-Build fehlt');
  const build = read('.github/rc1005/build-three-env.mjs');
  assert.match(build, /const VERSION='RC1005'/);
  assert.match(build, /dist-rc1005/);
  assert.match(build, /write\('index\.html'/);
  assert.match(build, /write\('TESTVERSION\.html'/);
  assert.match(build, /write\('demo\.html'/);
});

test('RC1005: Produktionsfreigabe trägt RC1005', () => {
  assert.match(read('production-version.js'), /__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1005'/);
});

test('RC1005: Standard-Release veröffentlicht alle drei Websysteme gemeinsam', () => {
  const workflow = read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(workflow, /ExportHUB RC1005 Drei-Umgebungen Deploy/);
  assert.match(workflow, /\.github\/rc1005\/build-three-env\.mjs/);
  assert.match(workflow, /Deploy ExportHUB production/);
  assert.match(workflow, /Deploy ExportHUB TESTSERVICE/);
  assert.match(workflow, /deployment_environment:\s*testservice/);
  assert.match(workflow, /dist-rc1005\/demo\.html/);
  assert.match(workflow, /ExportHUB RC1005 environment=production-candidate/);
  assert.match(workflow, /ExportHUB RC1005 environment=testservice/);
  assert.match(workflow, /ExportHUB RC1005 environment=demo/);
});

test('RC1005: manueller TESTSERVICE-Deploy benutzt ebenfalls RC1005', () => {
  const workflow = read('.github/workflows/exporthub-testservice.yml');
  assert.match(workflow, /RC1005 TESTSERVICE-Vertrag/);
  assert.match(workflow, /\.github\/rc1005\/build-three-env\.mjs/);
  assert.match(workflow, /dist-rc1005\/TESTVERSION\.html/);
  assert.match(workflow, /dist-rc1005\/demo\.html/);
});
