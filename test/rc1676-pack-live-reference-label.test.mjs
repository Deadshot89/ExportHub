import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helper=fs.readFileSync('e2e/helpers/pack-notification-live.mjs','utf8');
const shipment=fs.readFileSync('e2e/specs/shipment-create.spec.mjs','utf8');

test('RC1676: real QR pack handoff finds the actual labelled shipment reference field',()=>{
  // Keep the existing accessible locator contract shared with shipment-create E2E.
  assert.ok(shipment.includes('getByLabel(/Sendungsreferenz\\s*\\/\\s*Referenznummer/i)'),
    'Shipment create must use the accessible form label');
  assert.ok(helper.includes('getByLabel(/Sendungsreferenz\\s*\\/\\s*Referenznummer/i).first()'),
    'The pack live flow must select the real Sendungsdaten reference field');
  assert.ok(!helper.includes("page.locator('#rc363BlockCustomer input[maxlength="),
    'Do not scope shipment reference to the unrelated customer block');
  assert.ok(helper.includes('await expect(refField).toBeVisible();'),
    'The live test must still require a visible reference field');
  assert.ok(helper.includes('expect(shipmentRef).toMatch(/^[A-Z0-9]{6}$/);'),
    'The live test must still reject invalid references');
});

test('RC1676: original PDF survives unchanged mandatory save/reload/readback assertions',()=>{
  for(const evidence of [
    "expect(originalPdf.signature).toBe('%PDF-');",
    "expect(originalPdf.storage).toBe('blob');",
    "await page.locator('#rc363SaveShipment').click();",
    "await page.reload({waitUntil:'domcontentloaded'});",
    "fetch('/api/exporthub-state?mode=read&full=1'",
    "expect(persisted.found,'shipment must survive server-side read after page reload').toBe(true);",
    "expect(persisted.document,'real delivery note PDF must survive save and reload').toBe(true);",
    "expect(persisted.signature).toBe('%PDF-');",
    "expect(persisted.customerVisible).toBe(false);"
  ]) assert.ok(helper.includes(evidence),'Mandatory RC1670 assertion missing: '+evidence);
});
