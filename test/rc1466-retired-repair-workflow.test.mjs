import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const retiredWorkflow = '.github/workflows/rc1465-pretest-idempotency-fix.yml';

test('RC1466: der einmalige RC1465-Reparaturworkflow ist nach grünem Main vollständig entfernt', () => {
  assert.equal(
    fs.existsSync(retiredWorkflow),
    false,
    'Der veraltete RC1465-Reparaturworkflow darf nicht mehr manuell startbar sein oder Schreibrechte auf main besitzen.'
  );
});
