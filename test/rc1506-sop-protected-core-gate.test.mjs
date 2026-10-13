import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=()=>fs.readFileSync('.github/workflows/sopmaster-core-verify.yml','utf8');

test('geschützte Kernprozess-Regression baut den integrierten RC1506 Stand',()=>{
  const src=workflow();
  assert.match(src,/node \.github\/rc1506\/build-three-env\.mjs/);
  assert.doesNotMatch(src,/rc1501\/build-three-env\.mjs/);
});

test('Kernprozess-Gate schützt Navigation, Benachrichtigungen und Gesamtdruck',()=>{
  const src=workflow();
  assert.match(src,/e2e\/specs\/navigation\.spec\.mjs/);
  assert.match(src,/e2e\/specs\/notifications\.spec\.mjs/);
  assert.match(src,/e2e\/specs\/print-documents\.spec\.mjs/);
  assert.match(src,/--project=desktop/);
  assert.match(src,/--project=mobile-standard/);
  assert.match(src,/--project=laptop/);
});

test('Kernprozess-Gate bleibt isoliert und führt keine produktiven Mutationstests aus',()=>{
  const src=workflow();
  assert.match(src,/EXPORTHUB_E2E_STATIC:\s*['"]?1['"]?/);
  assert.match(src,/EXPORTHUB_E2E_ENTRY:\s*['"]?\/demo\.html['"]?/);
  assert.doesNotMatch(src,/EXPORTHUB_E2E_MUTATION:\s*['"]?1['"]?/);
  assert.doesNotMatch(src,/shipment-create\.spec\.mjs/);
  assert.doesNotMatch(src,/deploy/i);
});

test('Core Verify reagiert auf RC1505/RC1506 und die geschützten Browser-Specs',()=>{
  const src=workflow();
  assert.match(src,/assets\/sop\/rc1505-sop-/);
  assert.match(src,/assets\/sop\/rc1506-sop-/);
  assert.match(src,/\.github\/rc1506\/\*\*/);
  assert.match(src,/e2e\/specs\/navigation\.spec\.mjs/);
  assert.match(src,/e2e\/specs\/print-documents\.spec\.mjs/);
});
