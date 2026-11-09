import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const workflow=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');
const testservice=workflow.slice(workflow.indexOf('  testservice:'),workflow.indexOf('  production:'));
const production=workflow.slice(workflow.indexOf('  production:'),workflow.indexOf('  pod_integrity_audit:'));

for (const [name,section] of [['TESTSERVICE',testservice],['PRODUCTION',production]]) {
  test('RC1658: '+name+' reports optional Microsoft Graph failure without masking required Azure failure',()=>{
    assert.match(section,/optional_drive_pending_batches=0/);
    assert.match(section,/drive_pending_count="\$\(printf '%s\\n' "\$result" \| node -e "/);
    assert.match(section,/Number\(v\.drivePendingCount\|\|0\)/);
    assert.match(section,/Number\(v\.driveBackfillEligible\|\|0\)/);
    assert.match(section,/Number\(v\.driveSavedCount\|\|0\)/);
    assert.match(section,/v\.optionalDriveWorkDeferred===true/);
    assert.match(section,/v\.graphConfigured===false/);
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
  const blocks=[testservice,production].map(section=>{
    const found=section.match(/if \[ "\$optional_drive_pending_batches" -gt 0 \]; then([\s\S]*?)\n\s+fi/);
    assert.ok(found,'environment must log independent Graph backup failures');
    return found[1];
  });
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


test('RC1870: both environments bound generic Graph request failures without masking Azure or SharePoint errors',()=>{
  for(const [name,section] of [['TESTSERVICE',testservice],['PRODUCTION',production]]){
    assert.match(section,/codes\.some\(code=>code==='GRAPH_DIRECT_PATH_TARGET_FAILED'\|\|code==='GRAPH_REQUEST_FAILED'\)/,
      name+' must recognize both persistent Graph failure codes');
    assert.match(section,/if \[ "\$graph_target_failure_streak" -ge 2 \] && \[ "\$suppress_drive_backfill" != '1' \] && \[ -z "\$TARGET_REFERENCE" \]; then/,
      name+' must pause only bulk backfill after two consecutive failures');
    assert.match(section,/suppress_drive_backfill=1/);
    assert.match(section,/SUPPRESS_DRIVE_BACKFILL="\$suppress_drive_backfill"/);
    assert.match(section,/Optionaler Graph-Backfill für diesen Scan pausiert/);
    assert.match(section,/if \[ "\$optional_drive_pending_batches" -gt 0 \]; then[\s\S]*?exit 10/,
      name+' must still fail closed when the independent SharePoint copy is absent');
  }
});

test('RC1940: empty scan pages do not reset the streak of failed Graph attempts',()=>{
  // Interpret the exact embedded node -e classifier from each environment
  // rather than duplicating its logic in the test.
  function classify(section,payload){
    const line=section.split('\n').find(x=>x.includes('graph_target_attempt_result="$(printf'));
    assert.ok(line,'Graph attempt classifier is missing');
    const match=line.match(/node -e "([^"]+)"\)"$/);
    assert.ok(match,'classifier must remain a single, auditable shell-safe Node expression');
    const listeners={},output=[];
    const process={stdin:{on(type,callback){listeners[type]=callback;return this;}},stdout:{write(value){output.push(String(value));}}};
    vm.runInNewContext(match[1],{process});
    listeners.data(JSON.stringify(payload));listeners.end();
    return output.join('');
  }
  for(const [name,section] of [['TESTSERVICE',testservice],['PRODUCTION',production]]){
    const failed={drivePending:[{error:'GRAPH_REQUEST_FAILED: HTTP400'}],driveSavedCount:0};
    const empty={drivePending:[],driveBackfillSelected:0,driveSavedCount:0};
    const saved={drivePending:[],drivePendingCount:0,driveSavedCount:1};
    assert.deepEqual([classify(section,failed),classify(section,empty),classify(section,failed),classify(section,saved)],['failed','none','failed','saved'],name);
    assert.match(section,/if \[ "\$graph_target_attempt_result" = 'failed' \]; then/);
    assert.match(section,/elif \[ "\$graph_target_attempt_result" = 'saved' \]; then/);
    assert.doesNotMatch(section,/elif \[ "\$suppress_drive_backfill" != '1' \]; then\s+graph_target_failure_streak=0/);
    assert.match(section,/if \[ "\$graph_target_failure_streak" -ge 2 \] && \[ "\$suppress_drive_backfill" != '1' \] && \[ -z "\$TARGET_REFERENCE" \]; then/);
  }
});
