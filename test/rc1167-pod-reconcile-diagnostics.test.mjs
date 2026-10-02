import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');
const podArchive=fs.readFileSync('api/shared/pod-archive.js','utf8');

test('RC1167: POD-Reconcile protokolliert HTTP-Fehlerdiagnose ohne Secret-Werte',()=>{
  assert.match(workflow,/response_file="\$\(mktemp\)"/);
  assert.match(workflow,/http_code="\$\(/);
  assert.match(workflow,/httpStatus:status/);
  assert.match(workflow,/missing:Array\.isArray\(v\.missing\)\?v\.missing:\[\]/);
  assert.match(workflow,/targetFolder:v\.targetFolder/);
  assert.doesNotMatch(workflow,/targetUser:v\.targetUser/);
  assert.doesNotMatch(workflow,/clientSecret:v\.clientSecret/);
});

test('RC1167: TESTSERVICE und Produktion prüfen POD-Backup unabhängig',()=>{
  const production=workflow.slice(workflow.indexOf('  production:'));
  assert.match(production,/github\.event_name != 'workflow_run'.*github\.event\.workflow_run\.head_branch == 'main'/);
  assert.doesNotMatch(production,/workflow_run\.conclusion == 'success'/);
  assert.doesNotMatch(production,/needs:\s*\n\s*- testservice/);
  assert.match(workflow,/TESTSERVICE POD reconcile/);
  assert.match(workflow,/PRODUCTION POD reconcile/);
});

test('RC1167: HTTP 503 bleibt ein harter Fehler statt falschem Grün',()=>{
  assert.match(workflow,/status<200\|\|status>=300\|\|!v\.ok/);
  assert.match(workflow,/process\.exit\(3\)/);
  assert.match(workflow,/process\.exit\(4\)/);
});

test('RC1199: Pending-Diagnose gibt nur deduplizierte Fehlercodes aus',()=>{
  assert.match(workflow,/const pendingCodes=Array\.from\(new Set\(/);
  assert.match(workflow,/split\(':',1\)\[0\]\.trim\(\)/);
  assert.match(workflow,/const drivePendingCodes=Array\.from\(new Set\(/);
  assert.match(workflow,/pendingCodes,drivePendingCodes,driveProviderCodes,errorCodes,target:/);
  assert.doesNotMatch(workflow,/pending:v\.pending/);
  assert.doesNotMatch(workflow,/lastError/);
});


test('RC1347: Reconcile-Diagnose nennt deduplizierte Fehlercodes ohne sensible Fehlertexte',()=>{
  assert.match(workflow,/const errorCodes=Array\.from\(new Set\(/);
  assert.match(workflow,/Array\.isArray\(v\.errors\)\?v\.errors:\[\]/);
  assert.match(workflow,/x&&x\.code/);
  assert.match(workflow,/pendingCodes,drivePendingCodes,driveProviderCodes,errorCodes,target:/);
  assert.doesNotMatch(workflow,/errors:v\.errors/);
});


test('RC1423: M365-POD-Diagnose transportiert ausschließlich bereinigte Graph-Provider-Codes',()=>{
  assert.match(podArchive,/function safeCode\(value\)/);
  assert.match(podArchive,/driveProviderCode: safeCode\(error && error\.graphCode\)/);
  assert.match(podArchive,/providerCode: safeCode\(backup\.driveProviderCode \|\| \(driveError && driveError\.graphCode\)\)/);
  assert.match(workflow,/const driveProviderCodes=Array\.from\(new Set\(/);
  assert.match(workflow,/replace\(\/\[\^A-Za-z0-9_\.\-\]\/g,''\)\.slice\(0,80\)/);
  assert.match(workflow,/pendingCodes,drivePendingCodes,driveProviderCodes,errorCodes,target:/);
  assert.doesNotMatch(workflow,/drivePending:v\.drivePending/);
  assert.doesNotMatch(workflow,/graphCode:v\./);
});
