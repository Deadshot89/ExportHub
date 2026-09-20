import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const spec='e2e/specs/print-documents.spec.mjs';
const workflow='.github/workflows/rc1190-print-browser-proof.yml';

test('RC1190: Gesamtdruck besitzt einen echten PR-Browser-Abnahmenachweis',()=>{
  assert.ok(fs.existsSync(spec),'RC1190 Browser-Spec für Gesamtdruck fehlt');
  assert.ok(fs.existsSync(workflow),'RC1190 PR-Browser-Workflow fehlt');
  const source=fs.readFileSync(spec,'utf8');
  const flow=fs.readFileSync(workflow,'utf8');
  assert.match(source,/data-index352-action=["']print-all["']/);
  assert.match(source,/DEMO03/);
  assert.match(source,/CMR/);
  assert.match(source,/Deckblatt|rc352-cover/);
  assert.match(source,/Ladeliste|loadListDoc/);
  assert.match(source,/assertRuntimeClean/);
  assert.match(flow,/pull_request:/);
  assert.match(flow,/node \.github\/rc1112\/build-three-env\.mjs/);
  assert.match(flow,/@playwright\/test@1\.55\.0/);
  assert.match(flow,/npx playwright test e2e\/specs\/print-documents\.spec\.mjs/);
  assert.doesNotMatch(flow,/Azure\/static-web-apps-deploy|deployment_token|Deploy ExportHUB/i);
});
