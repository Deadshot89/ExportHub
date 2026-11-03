import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const api=fs.readFileSync('api/pod-backup-reconcile/index.js','utf8');
const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');
const workflow=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');

test('P1 #999: optional Graph cooldown requires signed drain; reference proofs cannot suppress',()=>{
  assert.ok(api.indexOf('githubOidcAuthorized(req)')<api.indexOf('suppressDriveBackfill: drainAll && payload.suppressDriveBackfill === true'));
  assert.match(api,/suppressDriveBackfill: drainAll && payload\.suppressDriveBackfill === true/);
  const m=archive.match(/const suppressDriveBackfill = ([^;]+);/);
  assert.ok(m);
  const policy=new Function('options','reference','return '+m[1]+';');
  assert.equal(policy({suppressDriveBackfill:true},''),true);
  assert.equal(policy({suppressDriveBackfill:true},'REF123'),false);
  assert.equal(policy({suppressDriveBackfill:false},''),false);
});

test('P1 #999: required Azure candidates keep their budget regardless of Graph circuit',()=>{
  assert.match(archive,/const requiredCandidates = candidates\.filter\(candidate => !candidate\.driveOnly\)/);
  assert.match(archive,/const selectedRequiredCandidates = requiredCandidates\.slice\(0, requiredBackupBudget\)/);
  const m=archive.match(/const driveBackfillBudget = ([^;]+);/);
  assert.ok(m);
  const budget=new Function('suppressDriveBackfill','reference','limit','remainingRemoteBudget','return '+m[1]+';');
  assert.equal(budget(true,'',25,2),0);
  assert.equal(budget(false,'',25,2),1);
  assert.equal(budget(false,'ABC123',25,2),2);
  assert.match(archive,/driveBackfillSuppressed: suppressDriveBackfill/);
  assert.match(archive,/optionalDriveWorkDeferred = true/);
});

test('P1 #999: both workflows pause after repeat Graph failure but keep hard SharePoint failure',()=>{
  const specs=[
    [/suppress_drive_backfill=0/g,2],
    [/SUPPRESS_DRIVE_BACKFILL="\$suppress_drive_backfill"/g,2],
    [/suppressDriveBackfill:!reference&&process\.env\.SUPPRESS_DRIVE_BACKFILL==='1'/g,2],
    [/codes\.includes\('GRAPH_DIRECT_PATH_TARGET_FAILED'\)/g,2],
    [/graph_target_failure_streak -ge 2/g,2],
    [/suppress_drive_backfill=1/g,2],
    [/exit 10/g,2],
    [/if \[ "\$verdict" = "done" \]; then/g,2]
  ];
  for(const [pattern,min] of specs){
    const count=(workflow.match(pattern)||[]).length;
    assert.ok(count>=min,String(pattern)+' occurred '+count+' times, expected '+min);
  }
  assert.match(workflow,/if \[ "\$optional_drive_pending_batches" -gt 0 \]; then\s+exit 10/);
  assert.match(workflow,/Azure-POD-Archiv wird weiter geprüft/);
});

test('P1 #999: API and archive JavaScript remain syntactically valid',()=>{
  for(const file of ['api/pod-backup-reconcile/index.js','api/shared/pod-archive.js'])
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
});
