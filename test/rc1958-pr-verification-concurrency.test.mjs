import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflows = [
  ['.github/workflows/rc1007-release-verify.yml', 'rc1007-historical-release'],
  ['.github/workflows/rc1012-abholkalender-verify.yml', 'rc1012-abholkalender'],
  ['.github/workflows/rc1257-avis-reminder-environment.yml', 'rc1257-avis-reminder-environment'],
  ['.github/workflows/rc1259-avis-proxy-host.yml', 'rc1259-avis-proxy-host'],
  ['.github/workflows/rc1546-performance-regression.yml', 'rc1546-performance-no-rerender']
];

for (const [path, group] of workflows) {
  test('RC1958 '+group+': reruns supersede only the same PR or source branch', () => {
    const body = fs.readFileSync(path, 'utf8');
    const groupLine = 'group: '+group+'-${{ github.event.pull_request.number || github.ref }}';
    assert.ok(body.includes(groupLine), 'Stable PR number or source branch required');
    assert.match(body, /\nconcurrency:\s*\n\s*group:/);
    assert.match(body, /\n\s*cancel-in-progress:\s*true\s*\n/);
    assert.match(body, /\n\s*jobs:\s*\n/);
    assert.match(body, /runs-on:\s*ubuntu-latest/);
    assert.match(body, /pull_request:/);
    assert.doesNotMatch(body, /group:.*github\.sha/, 'Every commit of a PR must share its concurrency key');
  });
}

test('RC1958: main validation and production approval remain independently guarded', () => {
  const main = fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml', 'utf8');
  const production = fs.readFileSync('.github/workflows/exporthub-production-release.yml', 'utf8');
  assert.match(main, /group:\s*exporthub-rc1112-three-env-/);
  assert.match(production, /confirm_production/);
  assert.match(production, /release_sha/);
  assert.match(production, /RC1381 PRODUCTION stale-deploy guard/);
});
