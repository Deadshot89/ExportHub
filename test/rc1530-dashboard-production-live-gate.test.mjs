import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// RC1530 keeps the pre-release and production contracts in one verification surface; latest-main revalidation is intentional.
const workflowPath='.github/workflows/exporthub-production-release.yml';
const browserWorkflowPath='.github/workflows/rc1530-dashboard-browser.yml';
const specPath='e2e/specs/dashboard-personalization-production.spec.mjs';
const workflow=fs.readFileSync(workflowPath,'utf8');

test('RC1530 Production-Release enthält einen eigenen Dashboard-Personalisierungs-Live-Gate',()=>{
  assert.match(workflow,/RC1530 Dashboard-Personalisierung Production-Liveprüfung/);
  assert.match(workflow,/EXPORTHUB_E2E_LIVE:\s*['"]1['"]/);
  assert.match(workflow,/EXPORTHUB_E2E_PUBLIC_ENV:\s*production/);
  assert.match(workflow,/dashboard-personalization-production\.spec\.mjs/);
  assert.match(workflow,/--project=laptop/);
});

test('RC1530 Live-Spec prüft Runtime, Speicherung, Reihenfolge, Reload und Reset ausschließlich im Browserprofil',()=>{
  assert.equal(fs.existsSync(specPath),true,`${specPath} fehlt`);
  const spec=fs.readFileSync(specPath,'utf8');
  assert.match(spec,/EXPORTHUB_E2E_PUBLIC_ENV/);
  assert.match(spec,/production/);
  assert.match(spec,/ExportHUBDashboard1371/);
  assert.match(spec,/exporthub\.dashboard\.layout\.v1\./);
  assert.match(spec,/orderRestored/);
  assert.match(spec,/page\.reload\s*\(/);
  assert.match(spec,/restoreStandard\s*\(/);
  assert.match(spec,/localStorage/);
  assert.doesNotMatch(spec,/EXPORTHUB_E2E_MUTATION/);
});

test('RC1530 PR-Browser-Gate führt dieselbe Dashboard-Acceptance vor dem Merge aus',()=>{
  assert.equal(fs.existsSync(browserWorkflowPath),true,`${browserWorkflowPath} fehlt`);
  const browserWorkflow=fs.readFileSync(browserWorkflowPath,'utf8');
  assert.match(browserWorkflow,/pull_request:/);
  assert.match(browserWorkflow,/dashboard-personalization-production\.spec\.mjs/);
  assert.match(browserWorkflow,/node \.github\/rc1112\/build-three-env\.mjs/);
  assert.match(browserWorkflow,/@playwright\/test@1\.63\.0/);
  assert.match(browserWorkflow,/--project=laptop/);
});
