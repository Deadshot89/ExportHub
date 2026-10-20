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

test('RC1520 reproduziert den offiziellen Main-Vorlauf und baut anschließend RC1521',()=>{
  const src=read();
  assert.match(src,/node \.github\/rc1018\/apply-public-language\.mjs/);
  assert.match(src,/node \.github\/rc1018\/fix-mail-wording\.mjs/);
  assert.match(src,/node \.github\/rc1521\/build-three-env\.mjs/);
  assert.doesNotMatch(src,/node \.github\/rc1506\/build-three-env\.mjs/);
  assert.match(src,/node \.github\/rc1505\/verify-build-contract\.mjs/);
});

test('RC1520 prüft vollständige Regression und alle Releaseverträge auf der RC1519-Basis',()=>{
  const src=read();
  assert.match(src,/npm test/);
  assert.match(src,/test\/rc1521-sop-current-main-builder\.test\.mjs/);
  assert.match(src,/test\/rc1505-production-promotion\.test\.mjs/);
  assert.match(src,/test\/rc1506-sop-protected-core-gate\.test\.mjs/);
  assert.match(src,/test\/rc1507-sop-testservice-gate\.test\.mjs/);
});

test('RC1520 schützt Kernbrowser, neue Training-Center-Flows und drei Release-Umgebungen',()=>{
  const src=read();
  for(const spec of [
    'e2e/specs/navigation.spec.mjs',
    'e2e/specs/notifications.spec.mjs',
    'e2e/specs/print-documents.spec.mjs',
    'e2e/specs/training-center-shell.spec.mjs',
    'e2e/specs/training-center-isolation.spec.mjs',
    'e2e/specs/training-center-tour.spec.mjs',
    'e2e/specs/training-center-first-shipment.spec.mjs',
    'e2e/specs/training-center-coverage.spec.mjs',
    'e2e/specs/training-center-app-integration.spec.mjs',
    'e2e/specs/sopmaster-release-candidate.spec.mjs'
  ]) assert.ok(src.includes(spec),'RC1520 Browser-Schutz fehlt: '+spec);
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
