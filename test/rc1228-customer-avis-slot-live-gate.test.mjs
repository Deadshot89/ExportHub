import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('RC1228: Lieferavis-Slotlogik ist als Live-Release-Gate abgesichert', () => {
  const workflow = fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
  const avis = fs.readFileSync('customer-avis.html','utf8');
  const api = fs.readFileSync('api/customer-avis/index.js','utf8');
  const slots = fs.readFileSync('api/shared/customer-avis-slots.js','utf8');

  const liveStep = 'RC1228 Lieferavis-Slotlogik live prüfen';
  assert.ok(workflow.includes(liveStep), 'RC1228 Live-Gate fehlt.');
  assert.ok(workflow.indexOf(liveStep) > workflow.indexOf('Deploy ExportHUB production'), 'RC1228 Live-Gate muss nach dem Produktionsdeploy laufen.');
  assert.ok(workflow.indexOf(liveStep) < workflow.indexOf('Live RC1122 HTML-Integrität prüfen'), 'RC1228 Live-Gate muss vor den allgemeinen Live-Prüfungen laufen.');

  for (const marker of [
    'Buchbar sind ausschließlich 2-Stunden-Zeitfenster innerhalb von 08:30–16:00 Uhr.',
    "Noch '+esc(x.remaining)+' von 3 gleichzeitig frei",
    "action:'availability'",
    "err.code==='PICKUP_SLOT_FULL'"
  ]) {
    assert.ok(workflow.includes(marker), 'Live-Gate prüft Marker nicht: '+marker);
    assert.ok(avis.includes(marker), 'Avis-Seite enthält Marker nicht: '+marker);
  }

  assert.ok(api.includes("PICKUP_SLOT_INVALID"), 'API muss ungültige Slots ablehnen.');
  assert.ok(api.includes("PICKUP_SLOT_FULL"), 'API muss volle Slots ablehnen.');
  assert.ok(api.includes("avisSlots.slotState"), 'API muss Kapazität serverseitig prüfen.');

  assert.ok(slots.includes('const BUSINESS_START = 8 * 60 + 30;'), 'Startzeit 08:30 fehlt.');
  assert.ok(slots.includes('const BUSINESS_END = 16 * 60;'), 'Endzeit 16:00 fehlt.');
  assert.ok(slots.includes('const WINDOW_MINUTES = 120;'), '2-Stunden-Fenster fehlt.');
  assert.ok(slots.includes('const MAX_CONCURRENT = 3;'), '3er-Kapazität fehlt.');
});
