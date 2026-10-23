import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');
const testservice=workflow.slice(workflow.indexOf('  testservice:'),workflow.indexOf('  production:'));
const production=workflow.slice(workflow.indexOf('  production:'),workflow.indexOf('  pod_integrity_audit:'));

for (const [name,section] of [['TESTSERVICE',testservice],['PRODUCTION',production]]) {
  test('RC1658: '+name+' reports optional Microsoft Graph failure without masking required Azure failure',()=>{
    assert.match(section,/optional_drive_pending_batches=0/);
    assert.match(section,/drive_pending_count="\$\(printf '%s\\n' "\$result" \| node -e "/);
    assert.match(section,/Number\(v\.drivePendingCount\|\|0\)/);
    assert.match(section,/optional_drive_pending_batches=\$\(\(optional_drive_pending_batches \+ 1\)\)/);
    assert.match(section,/if \[ "\$verdict" = "done" \]; then\s+if \[ "\$optional_drive_pending_batches" -gt 0 \]; then/);
    assert.match(section,/::warning title=POD Microsoft-365 optional archive/);
    assert.match(section,/>> "\$GITHUB_STEP_SUMMARY"/);
    assert.match(section,/Erforderlicher Azure-Archiv-Backlog: erfolgreich abgearbeitet/);
    assert.match(section,/exit 0/);
  });
}

test('RC1658: mandatory failures remain blocking, optional copies only produce a warning',()=>{
  assert.match(testservice,/Number\(v\.errorCount\|\|0\)>0\|\|Number\(v\.pendingCount\|\|0\)>0\)process\.exit\(3\)/);
  assert.match(production,/Number\(v\.errorCount\|\|0\)>0\|\|Number\(v\.pendingCount\|\|0\)>0\)process\.exit\(4\)/);
  assert.equal((workflow.match(/const requiredDone=eligible===0&&selected===0&&skipped===0&&!v\.nextContinuationToken&&!v\.requiredWorkDeferred/g)||[]).length,2);
  assert.doesNotMatch(workflow,/requiredDone[^\n]*drivePendingCount/);
  assert.match(workflow,/pod_integrity_audit:[\s\S]*?if: \$\{\{ false \}\}/);
});

test('RC1658: warnings are aggregate and do not print references, response payloads or tokens',()=>{
  const blocks=[...workflow.matchAll(/if \[ "\$optional_drive_pending_batches" -gt 0 \]; then([\s\S]*?)\n\s+fi/g)].map(m=>m[1]);
  assert.equal(blocks.length,2);
  for(const block of blocks) {
    assert.match(block,/optional_drive_pending_batches/);
    assert.doesNotMatch(block,/\$result|\$oidc_token|v\.reference|v\.drivePending|v\.message|v\.target|\$TARGET_REFERENCE/);
  }
});
