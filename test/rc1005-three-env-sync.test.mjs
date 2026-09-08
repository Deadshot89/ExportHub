import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

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

test('RC1005+: Standard-Release behält Produktion und TESTSERVICE als gemeinsamen Deploy', () => {
  const workflow = read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(workflow, /Deploy ExportHUB production/);
  assert.match(workflow, /Deploy ExportHUB TESTSERVICE/);
  assert.match(workflow, /deployment_environment:\s*testservice/);
  assert.match(workflow, /demo\.html/);
});

test('RC1005+: TESTSERVICE-Sonderweg bleibt ausschließlich manuell', () => {
  const workflow = read('.github/workflows/exporthub-testservice.yml');
  assert.match(workflow, /workflow_dispatch/);
  assert.doesNotMatch(workflow,/\bpush\s*:/);
});
