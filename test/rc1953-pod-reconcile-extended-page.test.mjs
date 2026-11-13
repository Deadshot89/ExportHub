import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');
const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');
const api=fs.readFileSync('api/pod-backup-reconcile/index.js','utf8');
const testservice=workflow.slice(workflow.indexOf('  testservice:'),workflow.indexOf('  production:'));
const production=workflow.slice(workflow.indexOf('  production:'),workflow.indexOf('  pod_integrity_audit:'));

test('RC1953/P0 #999: TESTSERVICE reads 100 metadata rows, PRODUCTION stays at 25, remote budget stays two',()=>{
  for(const [name,section,pageSize] of [['TESTSERVICE',testservice,100],['PRODUCTION',production,25]]){
    assert.match(section,new RegExp('scanPageSize:'+pageSize),name);
    assert.doesNotMatch(section,new RegExp('scanPageSize:'+(pageSize===100?25:100)),name);
    assert.match(section,/for batch in \$\(seq 1 200\); do/,name);
    assert.match(section,/remoteWorkBudget:v\.remoteWorkBudget/,name);
    assert.match(section,/const requiredDone=eligible===0&&selected===0&&skipped===0&&!v\.nextContinuationToken&&!v\.requiredWorkDeferred/,name);
    assert.match(section,/if \[ "\$optional_drive_pending_batches" -gt 0 \]; then[\s\S]*?exit 10/,name);
    assert.match(section,/SUPPRESS_DRIVE_BACKFILL="\$suppress_drive_backfill"/,name);
  }
  assert.match(archive,/const remoteWorkBudget = reference \? Math\.max\(2, limit\) : 2/);
  assert.match(testservice,/scanPageSize:100/);
  assert.match(production,/scanPageSize:25/);
  assert.match(api,/scanPageSize: Math\.min\(100, Math\.max\(10, Math\.round\(Number\(payload\.scanPageSize\) \|\| 40\)\)\)/);
});

test('RC1953/P0 #999: TESTSERVICE ambiguous relink skips are bounded by the 100-row page size',()=>{
  assert.match(testservice,/Math\.max\(0,Math\.min\(100,Math\.floor\(Number\(process\.env\.RELINK_SKIP_COUNT\)\|\|0\)\)\)/);
  assert.match(testservice,/Math\.max\(0,Math\.min\(100,Math\.floor\(Number\(v\.nextRelinkSkipCount\)\|\|0\)\)\)/);
  assert.match(testservice,/previous_relink_skip_count/);
  assert.match(testservice,/if \[ "\$continuation_token" != "\$previous_continuation_token" \]; then/);
  assert.match(testservice,/blocked_ambiguous_relink_batches/);
  assert.match(archive,/if \(environment === 'testservice' && code === 'TEAM_SHIPMENT_AMBIGUOUS'\)/);
  assert.match(archive,/const nextRelinkSkipCount = environment === 'testservice' && !reference/);
  assert.doesNotMatch(testservice,/teamPodLinkVersion.*TEAM_SHIPMENT_AMBIGUOUS/);
});

test('RC1953: neither Graph permission, archive original, nor production re-link security is modified',()=>{
  assert.match(production,/Number\(v\.errorCount\|\|0\)>0\|\|Number\(v\.pendingCount\|\|0\)>0\)process\.exit\(4\)/);
  assert.match(testservice,/Number\(v\.errorCount\|\|0\)>0\|\|Number\(v\.pendingCount\|\|0\)>0\)process\.exit\(3\)/);
  assert.match(workflow,/Continuation-Token bewegt sich ohne Fortschritt nicht weiter/);
  assert.match(workflow,/Graph.*Backfill/);
  assert.match(archive,/conditions:\s*\{ ifNoneMatch: '\*' \}/);
});
