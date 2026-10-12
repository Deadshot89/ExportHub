import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync('api/diagnostic-autofix/index.js','utf8');
const finalizer=fs.existsSync('.github/workflows/rc1496-autofix-finalize.yml')
  ? fs.readFileSync('.github/workflows/rc1496-autofix-finalize.yml','utf8')
  : '';

test('RC1496: erfolgreicher RC1112-Live-Deploy finalisiert einen Autofix-PR fail-closed',()=>{
  assert.match(finalizer,/workflow_run:/);
  assert.match(finalizer,/ExportHUB RC1112 Drei-Umgebungen Deploy/);
  assert.match(finalizer,/github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(finalizer,/commits\/\$head_sha\/pulls/);
  assert.match(finalizer,/ExportHUB Diagnose-Autofix/);
  assert.match(finalizer,/action:\"finalize\"/);
  assert.match(finalizer,/audience=exporthub-diagnostic-autofix/);
});

test('RC1496: nur der vertrauenswürdige OIDC-Finalizer darf testing auf fixed abschließen',()=>{
  assert.match(api,/RC1496_AUTOFIX_FINALIZE_WORKFLOW/);
  assert.match(api,/rc1496-autofix-finalize\.yml/);
  assert.match(api,/action==='finalize'/);
  assert.match(api,/githubOidcAuthorized\(req,RC1496_AUTOFIX_FINALIZE_WORKFLOW,\['workflow_run'\]\)/);
  assert.doesNotMatch(api,/action==='finalize'[\s\S]{0,240}callbackAuthorized\(req,RC1496_AUTOFIX_FINALIZE_WORKFLOW/);
  assert.match(api,/async function finalizeAutofix\(/);
  assert.match(api,/!diagnosticId\|\|diagnosticId!==id/);
  assert.match(api,/!\/\^\[0-9a-f\]\{40\}\$\/i\.test\(autofixCommit\)/);
  assert.match(api,/!existingCommit\|\|autofixCommit!==existingCommit/);
  assert.match(api,/!currentCommit\|\|autofixCommit!==currentCommit/);
  assert.match(api,/existingStatus!=='testing'/);
  assert.match(api,/AUTOFIX_NOT_READY_FOR_FINALIZE/);
  assert.match(api,/existingPrUrl!==pullRequestUrl/);
  assert.match(api,/AUTOFIX_PR_MISMATCH/);
  assert.match(api,/status:'fixed'/);
  assert.match(api,/resolvedBy:'ChatGPT \/ Codex Autofix'/);
  assert.match(api,/deploymentRunUrl/);
  assert.match(api,/mergeCommit/);
});
