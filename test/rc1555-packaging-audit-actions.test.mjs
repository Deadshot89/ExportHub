import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const API='api/packaging-admin/index.js';

test('RC1555 audit distinguishes explicit packaging activation from deactivation',()=>{
  const source=fs.readFileSync(API,'utf8');
  assert.match(source,/PACKAGING_ACTIVATED/,'reactivation must have its own audit action');
  assert.match(source,/PACKAGING_DEACTIVATED/,'deactivation must have its own audit action');
  assert.doesNotMatch(source,/audit\(team,['\"]PACKAGING_STATUS_CHANGED['\"]/, 'generic status audit is not sufficient for the acceptance contract');
});
