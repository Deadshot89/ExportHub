import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shipment=fs.readFileSync('e2e/specs/shipment-create.spec.mjs','utf8');

test('RC1222: gespeicherte Sendung wird im Live-Gate mit belastbarem Klickfenster wieder geöffnet',()=>{
  assert.match(shipment,/openButton\.scrollIntoViewIfNeeded\(\)\.catch\(\(\)=>\{\}\)/);
  assert.match(shipment,/openButton\.click\(\{timeout:process\.env\.EXPORTHUB_E2E_LIVE==='1'\?25_000:10_000\}\)/);
  assert.match(shipment,/rc363BlockCustomer'\)\)\.toBeVisible\(\{timeout:process\.env\.EXPORTHUB_E2E_LIVE==='1'\?25_000:12_000\}\)/);
});

test('RC1222: fachliche Persistenzprüfungen bleiben vor dem Wiederöffnen bestehen',()=>{
  const serverRead=shipment.indexOf('expect(persisted.status).toBe(200)');
  const open=shipment.indexOf('await openButton.click');
  assert.ok(serverRead>=0&&open>serverRead);
  assert.match(shipment,/expect\(persisted\.found\?\.ref\)\.toBe\(ref\)/);
  assert.match(shipment,/expect\(persisted\.found\?\.rows\?\.length\)\.toBeGreaterThan\(0\)/);
});
