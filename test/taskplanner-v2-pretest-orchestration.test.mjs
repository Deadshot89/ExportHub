import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('RC1462 pretest wendet TaskPlanner-V2-Builder-Wiring vor der Verifikation an',()=>{
  const source=fs.readFileSync('scripts/rc1462-pretest.mjs','utf8');
  assert.match(source,/await import\('\.\/taskplanner-v2-pretest\.mjs'\)/);
  assert.match(source,/TaskPlanner V2 builder wiring incomplete/);
});
