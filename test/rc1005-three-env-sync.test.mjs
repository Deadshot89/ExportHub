import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const MAIN_WORKFLOW = '.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const PRODUCTION_WORKFLOW = '.github/workflows/exporthub-production-release.yml';

test('RC1005: historische Drei-Umgebungen-Baseline bleibt nachvollziehbar', () => {
  assert.equal(fs.existsSync('.github/rc1005/build-three-env.mjs'), true, 'historischer RC1005 Drei-Umgebungen-Build fehlt');
  const build = read('.github/rc1005/build-three-env.mjs');
  assert.match(build, /const VERSION='RC1005'/);
  assert.match(build, /dist-rc1005/);
  assert.match(build, /write\('index\.html'/);
  assert.match(build, /write\('TESTVERSION\.html'/);
  assert.match(build, /write\('demo\.html'/);
});

test('RC1005+: autoritativer Produktionsstand darf nicht hinter RC1005 zurückfallen', () => {
  const marker=read('production-version.js').match(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC(\d+)'/);
  assert.ok(marker,'Produktionsmarker fehlt');
  assert.ok(Number(marker[1])>=1005,`Produktionsstand RC${marker[1]} liegt vor RC1005`);
});

test('RC1505: Standard-Release baut gemeinsam, deployt über main aber nur TESTSERVICE', () => {
  const workflow = read(MAIN_WORKFLOW);
  assert.match(workflow, /name:\s*ExportHUB RC1112 Main Verification/);
  assert.match(workflow, /node \.github\/rc1112\/build-three-env\.mjs/);
  assert.match(workflow, /Deploy ExportHUB TESTSERVICE/);
  assert.match(workflow, /deployment_environment:\s*testservice/);
  assert.match(workflow, /demo\.html/);
  assert.doesNotMatch(workflow, /Deploy ExportHUB production/);
  assert.doesNotMatch(workflow, /AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_FOREST_0F315E310/);
});

test('RC1505: Production hat einen eigenen manuellen Releasepfad', () => {
  assert.equal(fs.existsSync(PRODUCTION_WORKFLOW), true, 'manueller Production-Workflow fehlt');
  const workflow = read(PRODUCTION_WORKFLOW);
  assert.match(workflow, /name:\s*ExportHUB Production Release/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s{2}push:/m);
  assert.match(workflow, /Deploy ExportHUB production/);
});

test('RC1005+: TESTSERVICE-Sonderweg bleibt ausschließlich manuell', () => {
  const workflow = read('.github/workflows/exporthub-testservice.yml');
  assert.match(workflow, /workflow_dispatch/);
  assert.doesNotMatch(workflow,/\bpush\s*:/);
});
