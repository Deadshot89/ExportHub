import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');

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
