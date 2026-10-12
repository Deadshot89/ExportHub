import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const MAIN_WORKFLOW = '.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const PRODUCTION_WORKFLOW = '.github/workflows/exporthub-production-release.yml';
const PACK_PRODUCTION_WORKFLOW = '.github/workflows/packmeldungen-production.yml';
const OLD_RELEASE_NAME = 'ExportHUB RC1112 Drei-Umgebungen Deploy';
const MAIN_VERIFY_NAME = 'ExportHUB RC1112 Main Verification';
const PRODUCTION_RELEASE_NAME = 'ExportHUB Production Release';
const PRODUCTION_SECRET = 'AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_FOREST_0F315E310';

function requireFile(path) {
  assert.equal(fs.existsSync(path), true, `${path} fehlt`);
  return read(path);
}

test('RC1505: main verifies TESTSERVICE without a production deploy path', () => {
  const workflow = requireFile(MAIN_WORKFLOW);
  assert.match(workflow, new RegExp(`name:\\s*${MAIN_VERIFY_NAME}`));
  assert.match(workflow, /push:\s*[\s\S]*branches:\s*\[main\]/);
  assert.match(workflow, /Deploy ExportHUB TESTSERVICE/);
  assert.match(workflow, /deployment_environment:\s*testservice/);
  assert.doesNotMatch(workflow, /Deploy ExportHUB production/);
  assert.doesNotMatch(workflow, new RegExp(PRODUCTION_SECRET));
});

test('RC1505: production release is manual and requires exact confirmation', () => {
  const workflow = requireFile(PRODUCTION_WORKFLOW);
  assert.match(workflow, new RegExp(`name:\\s*${PRODUCTION_RELEASE_NAME}`));
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /release_sha:/);
  assert.match(workflow, /confirm_production:/);
  assert.match(workflow, /release_sha:[\s\S]*required:\s*true/);
  assert.match(workflow, /confirm_production:[\s\S]*required:\s*true/);
  assert.doesNotMatch(workflow, /^\s{2}push:/m);
  assert.match(workflow, /PRODUCTION FREIGEBEN/);
  assert.match(workflow, new RegExp(PRODUCTION_SECRET));
});

test('RC1505: production release is fixed to an explicit main-reachable SHA', () => {
  const workflow = requireFile(PRODUCTION_WORKFLOW);
  assert.match(workflow, /inputs\.release_sha|github\.event\.inputs\.release_sha/);
  assert.match(workflow, /git\s+merge-base\s+--is-ancestor/);
  assert.match(workflow, /origin\/main/);
  assert.match(workflow, /actions\/checkout@v5/);
  assert.match(workflow, /\.github\/rc1112\/build-three-env\.mjs/);
});

test('RC1505: Packmeldungen are built inside the SHA-pinned production release', () => {
  const production = requireFile(PRODUCTION_WORKFLOW);
  const pack = requireFile(PACK_PRODUCTION_WORKFLOW);
  assert.match(production, /\.github\/packmeldungen\/build-three-env\.mjs/);
  assert.match(production, /dist-rc1112\/pack\.html/);
  assert.match(pack, /workflow_dispatch:/);
  assert.doesNotMatch(pack, /workflow_run:/);
  assert.doesNotMatch(pack, new RegExp(OLD_RELEASE_NAME));
});

test('RC1505: production followers no longer treat normal main verification as production promotion', () => {
  const productionOnly = ['.github/workflows/rc1453-mail-cleanup.yml'];
  for (const path of productionOnly) {
    const workflow = requireFile(path);
    assert.match(workflow, new RegExp(PRODUCTION_RELEASE_NAME), `${path} muss auf den echten Production-Release hören`);
    assert.doesNotMatch(workflow, new RegExp(OLD_RELEASE_NAME), `${path} darf nicht mehr am alten Main-Deploy hängen`);
  }

  const splitFollowers = [
    '.github/workflows/rc1083-live-probe.yml',
    '.github/workflows/rc1137-state-compaction.yml',
    '.github/workflows/rc1267-state-backup.yml',
    '.github/workflows/rc1251-frame-protection.yml'
  ];
  for (const path of splitFollowers) {
    const workflow = requireFile(path);
    assert.doesNotMatch(workflow, new RegExp(OLD_RELEASE_NAME), `${path} darf den alten Drei-Umgebungen-Deploy nicht mehr als Release-Ereignis verwenden`);
  }
});
