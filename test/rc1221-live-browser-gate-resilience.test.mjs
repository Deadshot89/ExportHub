import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');
const notifications=fs.readFileSync('e2e/specs/notifications.spec.mjs','utf8');
const shipment=fs.readFileSync('e2e/specs/shipment-create.spec.mjs','utf8');

test('RC1221: Live-Gate verwendet längere Navigations- und Inhaltsfenster',()=>{
  assert.match(helper,/EXPORTHUB_E2E_LIVE==='1'\?25_000:10_000/);
  assert.match(helper,/EXPORTHUB_E2E_LIVE==='1'\?20_000:7000/);
  assert.match(helper,/EXPORTHUB_E2E_LIVE==='1'\?15_000:5000/);
  assert.match(helper,/const maxPasses=process\.env\.EXPORTHUB_E2E_LIVE==='1'\?5:3/);
  assert.match(helper,/await pause\(1200\)/);
});

test('RC1221: Benachrichtigungen dürfen den bereits vorhandenen sicheren Programmatic-Fallback nutzen',()=>{
  assert.match(notifications,/allowProgrammaticFallback:true/);
});

test('RC1221: Neue Sendung erhält nur im Live-Gate mehr Klickzeit',()=>{
  assert.match(shipment,/newShipment\.click\(\{timeout:process\.env\.EXPORTHUB_E2E_LIVE==='1'\?25_000:10_000\}\)/);
});
