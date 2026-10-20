import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const smoke=fs.readFileSync('e2e/specs/public-smoke.spec.mjs','utf8');

test('RC1588: live POD-Signatur wird erst nach installiertem Druckwrapper vermessen',()=>{
  assert.match(smoke,/__pickupNestedCleanupRC1556===true/);
  assert.match(smoke,/page\.emulateMedia\(\{media:'print'\}\)/);
});
test('RC1588: Live-Smoke verwendet den produktiven rc390 Druckcontainer statt einer freien Body-Karte',()=>{
  assert.match(smoke,/class="rc390-docview"><div class="rc390-bundle"/);
  assert.match(smoke,/\.rc390-docview \.rc390-bundle > \.rc390-load/);
  assert.doesNotMatch(smoke,/document\.body\.innerHTML=api\.enhance\(raw,shipment,true\)/);
});
test('RC1588: leeres Drucklayout und fehlende Fahrerunterschrift bleiben ein Fehler',()=>{
  assert.match(smoke,/expect\(layout\.printRootHeight[^\n]*\)\.toBeGreaterThan\(0\)/);
  assert.match(smoke,/expect\(layout\.signatureHeight\)\.toBeGreaterThan\(0\)/);
  assert.match(smoke,/expect\(layout\.visibleLegacy\)\.toBe\(0\)/);
  assert.match(smoke,/expect\(layout\.fieldCount\)\.toBe\(6\)/);
});
