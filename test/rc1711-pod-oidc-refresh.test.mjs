import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml', 'utf8');
const api = fs.readFileSync('api/pod-backup-reconcile/index.js', 'utf8');

test('RC1711: production and testservice renew short-lived GitHub OIDC during long POD scans', () => {
  const scans = workflow.split('for batch in $(seq 1 200); do').slice(1);
  assert.equal(scans.length, 2, 'both signed POD reconcile loops must refresh');
  for (const scan of scans) {
    const start = scan.slice(0, 850);
    assert.match(start, /\[ "\$batch" -gt 1 \] && \[ \$\(\( \(batch - 1\) % 10 \)\) -eq 0 \]/);
    assert.match(start, /ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
    assert.match(start, /ACTIONS_ID_TOKEN_REQUEST_URL/);
    assert.match(start, /audience=exporthub-pod-backup-reconcile/);
    assert.match(start, /oidc_token="\$\(/);
    assert.match(scan, /-H "x-exporthub-github-oidc: \$oidc_token"/);
  }
});

test('RC1711: signed workflow identity and production POD status safeguards remain enforced', () => {
  assert.match(api, /githubOidcAuthorized\(req\)/);
  assert.match(api, /claims\.repository !== REPO/);
  assert.match(api, /claims\.workflow_ref !== REPO/);
  assert.match(api, /claims\.exp\) <= at - 30/);
  assert.match(api, /POD_STATUS_AUDIT_SUSPENDED_RC1598/);
  assert.match(workflow, /# Workflow definitions are picked up from main without a production application deploy\./);
  assert.match(workflow, /# No automatic or manual bulk status changes until original POD evidence is reviewed case by case\./);
  assert.match(workflow, /if: \$\{\{ false \}\}/);
});
