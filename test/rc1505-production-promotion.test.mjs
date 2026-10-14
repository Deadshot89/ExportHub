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
  assert.match(workflow, /RC1124 Lokales Browser-Gate/);
  assert.match(workflow, /RC1124 TESTSERVICE Browser Gate/);
  assert.doesNotMatch(workflow, /Deploy ExportHUB production/);
  assert.doesNotMatch(workflow, new RegExp(PRODUCTION_SECRET));
});

// Regression: grep -q unter pipefail kann bei großem Live-HTML einen SIGPIPE-Fehlalarm auslösen.
test('RC1505: TESTSERVICE readiness avoids pipefail-sensitive grep pipelines', () => {
  const workflow = requireFile(MAIN_WORKFLOW);
  const start = workflow.indexOf('RC1505 TESTSERVICE Readiness prüfen');
  assert.ok(start >= 0, 'RC1505 TESTSERVICE Readiness fehlt');
  const block = workflow.slice(start);
  assert.doesNotMatch(block, /printf\s+'%s'\s+"\$(?:body|version)"\s*\|\s*grep\s+-q/);
  assert.match(block, /\[\[\s*"\$body"\s*==\s*\*ExportHUB\*\s*\]\]/);
  assert.match(block, /\[\[\s*"\$version"\s*==\s*\*"__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1112'"\*\s*\]\]/);
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

test('RC1505: production promotion requires successful Main Verification for the exact release SHA', () => {
  const workflow = requireFile(PRODUCTION_WORKFLOW);
  const guard = workflow.indexOf('RC1505 Erfolgreiche Main Verification für Release-SHA verlangen');
  const deploy = workflow.indexOf('Deploy ExportHUB production');
  assert.ok(guard >= 0 && deploy > guard, 'Main-Verification-Guard muss vor Production-Deploy liegen');
  const block = workflow.slice(guard, deploy);
  assert.match(block, /actions\/workflows\/azure-static-web-apps-wonderful-forest-0f315e310\.yml\/runs/);
  assert.match(block, /head_sha/);
  assert.match(block, /conclusion/);
  assert.match(block, /success/);
  assert.match(block, /RELEASE_SHA/);
  assert.match(block, /GITHUB_TOKEN/);
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

test('RC1505: browser safety is split without losing the production smoke', () => {
  const main = requireFile(MAIN_WORKFLOW);
  const production = requireFile(PRODUCTION_WORKFLOW);
  const local = main.indexOf('RC1124 Lokales Browser-Gate');
  const testDeploy = main.indexOf('Deploy ExportHUB TESTSERVICE');
  const testGate = main.indexOf('RC1124 TESTSERVICE Browser Gate');
  assert.ok(local >= 0 && testDeploy > local && testGate > testDeploy, 'Main muss lokal prüfen, TESTSERVICE deployen und danach live prüfen');
  assert.match(production, /RC1124 Produktion Read-only Browser Smoke/);
  assert.match(production, /public-smoke\.spec\.mjs/);
  assert.match(production, /version-display\.spec\.mjs/);
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

test('RC1528: production basis live gate uses the canonical production domain', () => {
  const workflow = requireFile(PRODUCTION_WORKFLOW);
  const start = workflow.indexOf('RC1505 Production Release Basis-Liveprüfung');
  const end = workflow.indexOf('RC1505 Historische Production-Live-Verträge prüfen', start);
  assert.ok(start >= 0 && end > start, 'RC1505 Production-Basisprüfung muss vor den historischen Live-Verträgen liegen');
  const block = workflow.slice(start, end);
  assert.match(block, /https:\/\/www\.exporthub360\.de\/production-version\.js/);
  assert.match(block, /https:\/\/www\.exporthub360\.de\/\?rc1505=/);
  assert.match(block, /https:\/\/www\.exporthub360\.de\/pack\/production-smoke/);
  assert.doesNotMatch(block, /https:\/\/exporthub360\.com/);
});

// Regression: Der Production-Basischeck darf unter `set -o pipefail` keine grep-q-Pipelines
// verwenden, weil grep bei frühem Treffer die Pipe schließt und printf mit SIGPIPE scheitern kann.
test('RC1531: production basis live gate avoids pipefail-sensitive grep pipelines', () => {
  const workflow = requireFile(PRODUCTION_WORKFLOW);
  const start = workflow.indexOf('RC1505 Production Release Basis-Liveprüfung');
  const end = workflow.indexOf('RC1505 Historische Production-Live-Verträge prüfen', start);
  assert.ok(start >= 0 && end > start, 'RC1505 Production-Basisprüfung fehlt');
  const block = workflow.slice(start, end);
  assert.doesNotMatch(block, /printf\s+'%s'\s+"\$(?:version|home|pack)"\s*\|\s*grep\s+-q/);
  assert.match(block, /\[\[\s*"\$version"\s*==\s*\*"__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1112'"\*\s*\]\]/);
  assert.match(block, /\[\[\s*"\$home"\s*==\s*\*ExportHUB\*\s*\]\]/);
  assert.match(block, /\[\[\s*"\$pack"\s*==\s*\*Packmeldung\*\s*\]\]/);
});
