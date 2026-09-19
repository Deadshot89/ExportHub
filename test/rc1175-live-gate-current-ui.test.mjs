import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const navigation=fs.readFileSync('e2e/specs/navigation.spec.mjs','utf8');
const shipment=fs.readFileSync('e2e/specs/shipment-create.spec.mjs','utf8');

test('RC1175: Nicht-Admin-Test erzwingt keine sichtbare Rechte-Navigation',()=>{
  const start=navigation.indexOf("test('RC1169 P0: Nicht-Admin");
  const end=navigation.indexOf("\n\ntest('RC1126 P0:",start);
  assert.ok(start>=0&&end>start);
  const block=navigation.slice(start,end);
  assert.doesNotMatch(block,/openExportHubView\(page,'rights'/);
  assert.match(block,/window\.setView\('rights'\)/);
  assert.match(block,/\[data-view="diagnostics"\]:visible/);
  assert.match(block,/mode=diagnostics-read/);
  assert.match(block,/expect\(denied\.status\)\.toBe\(403\)/);
});

test('RC1175: Sendungs-E2E folgt der produktiven automatischen Referenz',()=>{
  assert.match(shipment,/toHaveAttribute\('readonly',''\)/);
  assert.match(shipment,/Automatisch erzeugte Sendungsreferenz/);
  assert.match(shipment,/\^\[A-Z0-9\]\{6\}\$/);
  assert.doesNotMatch(shipment,/refInput\.fill\(/);
});

test('RC1175: geänderte E2E-Dateien sind syntaktisch gültig',()=>{
  for(const file of ['e2e/specs/navigation.spec.mjs','e2e/specs/shipment-create.spec.mjs','test/rc1171-shipment-create-ui-e2e.test.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
