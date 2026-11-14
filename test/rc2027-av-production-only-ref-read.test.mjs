// RC2027: no TESTSERVICE REF Graph target by explicit operator decision.
// The productive REF read must remain mandatory in production; never mark an
// intentionally not-executed TESTSERVICE original-read as successful proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/av-check.yml'),'utf8');

test('RC2027: TESTSERVICE uploads remain checked but REF original-read is explicitly N/A',()=>{
  const uploads=workflow.match(/- name: ABD ohne AV-Upload als Aufgabe synchronisieren\n\s+if: ([^\n]+)/);
  assert.ok(uploads,'AV upload-task step must exist');
  assert.ok(uploads[1].includes("inputs.environment == matrix.target.env"),'Per-environment workflow_dispatch guard must remain');
  const notice=workflow.match(/- name: TESTSERVICE REF-Originalabgleich nicht vorgesehen \(kein isoliertes Ziel\)\n\s+if: ([^\n]+)/);
  assert.ok(notice,'Must have explicit TESTSERVICE notice');
  assert.ok(notice[1].includes("matrix.target.env == 'testservice'"),'Notice must apply only to TESTSERVICE');
  assert.ok(workflow.includes('NICHT DURCHGEFUEHRT'),'No false assertion of successful Graph proof');
  assert.ok(workflow.includes('Kein AV-Original-Nachweis'),'Never claim missing/present AV proof');
});

test('RC2027: production REF original-read still mandatory and fail-closed',()=>{
  const step=workflow.match(/- name: REF-Ordner auf Ausgangsvermerk prüfen\n\s+if: ([^\n]+)/);
  assert.ok(step,'Production REF original check must exist');
  assert.ok(step[1].includes("matrix.target.env == 'production'"),'Only production may execute REF original Graph reads');
  assert.ok(step[1].includes("inputs.environment == matrix.target.env"),'Manual per-environment routing must remain');
  const body=workflow.slice(workflow.indexOf('- name: REF-Ordner auf Ausgangsvermerk prüfen'));
  assert.match(body,/if\(status<200\|\|status>=300\|\|!v\.ok\)process\.exit\(3\)/,'503 and Graph failures must still fail the production job');
  assert.ok(!body.includes('continue-on-error: true'),'No softened Graph gate');
});

test('RC2027: TESTSERVICE production REF isolation stays fail-closed in API',()=>{
  const source=fs.readFileSync(path.join(root,'api/shared/reference-folder-upload.js'),'utf8');
  assert.match(source,/if\(text\(environment\)\.toLowerCase\(\)===\x27testservice\x27\)/);
  assert.match(source,/GRAPH_TEST_REFERENCE_TARGET_NOT_CONFIGURED/);
  assert.match(source,/GRAPH_TEST_REFERENCE_TARGET_NOT_ISOLATED/);
});
