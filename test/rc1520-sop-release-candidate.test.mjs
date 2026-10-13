import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowPath='.github/workflows/sopmaster-release-candidate.yml';
const read=()=>fs.readFileSync(workflowPath,'utf8');

test('RC1520 Release-Candidate-Gate läuft ausschließlich auf der isolierten Integrationsbranch',()=>{
  assert.ok(fs.existsSync(workflowPath),'RC1520 Release-Candidate-Workflow fehlt');
  const src=read();
  assert.match(src,/integration\/sopmaster-rc1519-validation/);
  assert.doesNotMatch(src,/branches:\s*\[?\s*main\s*\]?/);
});

test('RC1520 verlangt den aktuellen main-Stand als Vorfahr des Kandidaten',()=>{
  const src=read();
  assert.match(src,/fetch-depth:\s*0/);
  assert.match(src,/git fetch --no-tags origin main/);
  assert.match(src,/git merge-base --is-ancestor origin\/main HEAD/);
});

test('RC1520 prüft vollständige Regression und den integrierten RC1506-Build auf der RC1519-Basis',()=>{
  const src=read();
  assert.match(src,/npm test/);
  assert.match(src,/node \.github\/rc1506\/build-three-env\.mjs/);
  assert.match(src,/node \.github\/rc1505\/verify-build-contract\.mjs/);
  assert.match(src,/test\/rc1505-production-promotion\.test\.mjs/);
  assert.match(src,/test\/rc1506-sop-protected-core-gate\.test\.mjs/);
  assert.match(src,/test\/rc1507-sop-testservice-gate\.test\.mjs/);
});

test('RC1520 schützt Kernbrowser, SOPMaster und alle drei gebauten Umgebungen',()=>{
  const src=read();
  for(const spec of [
    'e2e/specs/navigation.spec.mjs',
    'e2e/specs/notifications.spec.mjs',
    'e2e/specs/print-documents.spec.mjs',
    'e2e/specs/sopmaster-target-picker.spec.mjs',
    'e2e/specs/sopmaster-tour.spec.mjs',
    'e2e/specs/sopmaster-visual-editor.spec.mjs',
    'e2e/specs/sopmaster-training-exam.spec.mjs',
    'e2e/specs/sopmaster-coverage-dashboard.spec.mjs',
    'e2e/specs/sopmaster-coverage-integration.spec.mjs',
    'e2e/specs/sopmaster-release-candidate.spec.mjs'
  ]) assert.ok(src.includes(spec),`RC1520 Browser-Schutz fehlt: ${spec}`);
  assert.match(src,/\/index\.html/);
  assert.match(src,/\/TESTVERSION\.html/);
  assert.match(src,/\/demo\.html/);
});

test('RC1520 ist strikt read-only und kann weder TESTSERVICE noch Production deployen',()=>{
  const src=read();
  assert.doesNotMatch(src,/Azure\/static-web-apps-deploy/i);
  assert.doesNotMatch(src,/EXPORTHUB_E2E_MUTATION:\s*['"]?1['"]?/);
  assert.doesNotMatch(src,/EXPORTHUB_E2E_LIVE:\s*['"]?1['"]?/);
  assert.doesNotMatch(src,/PRODUCTION FREIGEBEN/);
});
