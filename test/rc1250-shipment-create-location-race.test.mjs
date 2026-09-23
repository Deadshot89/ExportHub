import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const spec=fs.readFileSync('e2e/specs/shipment-create.spec.mjs','utf8');

test('RC1250: Sendung-erstellen E2E wartet auf den Zielstandort statt die Optionsanzahl zu raten',()=>{
  assert.match(spec,/option\.value===id/);
  assert.match(spec,/E2E-Standort muss vor der Auswahl vollständig gerendert sein/);
  assert.match(spec,/selectOption\(\{value:customer\.locationId\}\)/);
  assert.doesNotMatch(spec,/if\(await location\.locator\('option'\)\.count\(\)>1\)/);
});
