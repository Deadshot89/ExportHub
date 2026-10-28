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
    // RC1689 may first report an ambiguous TESTSERVICE POD link before the optional Graph warning.
    const doneStart=section.indexOf('if [ "$verdict" = "done" ]; then');
    const graphWarning=section.indexOf('if [ "$optional_drive_pending_batches" -gt 0 ]; then',doneStart);
    const successExit=section.indexOf('exit 0',doneStart);
    assert.ok(doneStart>=0&&graphWarning>doneStart&&successExit>graphWarning,
      'Graph pending must be reported only after required Azure archive completion');
    assert.match(section,/::error title=POD Microsoft-365 archive incomplete/);
    assert.match(section,/>> "\$GITHUB_STEP_SUMMARY"/);
    assert.match(section,/Erforderlicher Azure-Archiv-Backlog: erfolgreich abgearbeitet/);
    assert.match(section,/exit 10/);
    assert.match(section,/exit 0/);
  });
}

test('RC1696: required Azure failures remain blocking and pending SharePoint copies fail the overall backup workflow',()=>{
  assert.match(testservice,/Number\(v\.errorCount\|\|0\)>0\|\|Number\(v\.pendingCount\|\|0\)>0\)process\.exit\(3\)/);
  assert.match(production,/Number\(v\.errorCount\|\|0\)>0\|\|Number\(v\.pendingCount\|\|0\)>0\)process\.exit\(4\)/);
  assert.equal((workflow.match(/const requiredDone=eligible===0&&selected===0&&skipped===0&&!v\.nextContinuationToken&&!v\.requiredWorkDeferred/g)||[]).length,2);
  assert.doesNotMatch(workflow,/requiredDone[^\n]*drivePendingCount/);
  assert.match(workflow,/pod_integrity_audit:[\s\S]*?if: \$\{\{ false \}\}/);
});

test('RC1696: SharePoint failure messages are aggregate and do not print references, response payloads or tokens',()=>{
  const blocks=[...workflow.matchAll(/if \[ "\$optional_drive_pending_batches" -gt 0 \]; then([\s\S]*?)\n\s+fi/g)].map(m=>m[1]);
  assert.equal(blocks.length,2);
  for(const block of blocks) {
    assert.match(block,/optional_drive_pending_batches/);
    assert.doesNotMatch(block,/\$result|\$oidc_token|v\.reference|v\.drivePending|v\.message|v\.target|\$TARGET_REFERENCE/);
  }
});

test('RC1696: independently required SharePoint copies block workflow success after a completed Azure drain',()=>{
  for (const [name,section] of [['TESTSERVICE',testservice],['PRODUCTION',production]]) {
    const done=section.indexOf('if [ "$verdict" = "done" ]; then');
    const pending=section.indexOf('if [ "$optional_drive_pending_batches" -gt 0 ]; then',done);
    const error=section.indexOf('::error title=POD Microsoft-365 archive incomplete',done);
    const failed=section.indexOf('exit 10',error);
    const success=section.indexOf('exit 0',done);
    assert.ok(done>=0&&pending>done&&error>pending&&failed>error&&success>failed,name+' must fail closed on Graph pending');
    assert.match(section,/Erforderlicher Azure-Archiv-Backlog: erfolgreich abgearbeitet/);
    assert.doesNotMatch(section,/::warning title=POD Microsoft-365 optional archive/);
  }
});
