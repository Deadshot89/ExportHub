import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const docs = require('../api/shared/customer-avis-reference-docs.js');

test('Avis zeigt Lieferschein, Rechnung und Packliste aus dem REF-Ordner', () => {
  const files = [
    { id: 'A1', name: 'Lieferschein_ABC123_20261105-101500_LS 4711.pdf', size: 10 },
    { id: 'A2', name: 'Rechnung_ABC123_20261105-101501_RE.pdf', size: 20 },
    { id: 'A3', name: 'Packliste_ABC123_20261105-101502_PL.png', size: 30 },
  ];
  const out = docs.toRecords(files, 'abc123');
  assert.deepEqual(out.map(d => d.category), ['Lieferschein', 'Rechnung', 'Packliste']);
  assert.equal(out[0].name, 'LS 4711.pdf');
  assert.equal(out[0].mime, 'application/pdf');
  assert.equal(out[0].refItemId, 'A1');
  assert.equal(out[0].id, 'ref-A1');
});

test('Interne Dateien und fremde Referenzen bleiben für Kunden unsichtbar', () => {
  const files = [
    { id: 'B1', name: 'Excel_ABC123_20261105-101500_kalk.xlsx' },
    { id: 'B2', name: 'Dokument_ABC123_20261105-101500_intern.pdf' },
    { id: 'B3', name: 'Rechnung_ZZZ999_20261105-101500_fremd.pdf' },
    { id: 'B4', name: 'AV_ABC123_1_x.pdf' },
    { id: 'B5', name: 'foto.jpg' },
    { id: '', name: 'Rechnung_ABC123_20261105-101500_ohneid.pdf' },
  ];
  assert.deepEqual(docs.toRecords(files, 'ABC123'), []);
  assert.deepEqual(docs.toRecords(files, 'ungültig'), []);
});

test('Lesefehler im REF-Ordner blockieren den Avis nicht', async () => {
  const logs = [];
  const out = await docs.load({ listFiles: async () => { const e = new Error('x'); e.code = 'GRAPH_DOWN'; throw e; } }, 'ABC123', 'production', (...a) => logs.push(a));
  assert.deepEqual(out, []);
  assert.equal(logs.length, 1);
});

test('customer-avis liefert REF-Dokumente nur über die Listen-ID aus', () => {
  const src = fs.readFileSync(new URL('../api/customer-avis/index.js', import.meta.url), 'utf8');
  assert.match(src, /refDocs\.load\(referenceFolder,sref\(sh\)/);
  assert.match(src, /doc\.refItemId\)\{const file=doc\.refSource==='azure'\?await refDocBlob\.read\(/);
  assert.match(src, /:await referenceFolder\.readFile\(doc\.refItemId,sessionInfo\.environment\)/);
});

test('Zoll-KI unterscheidet Konfigurations-, Kontingent- und Timeout-Fehler', async () => {
  const provider = require('../api/shared/customs-ai-provider.js');
  const base = { question: 'Frage', context: {}, sources: [], env: { EXPORTHUB_CUSTOMS_AI_API_KEY: 'x' } };
  const run = status => provider.askCustomsModel({ ...base, fetchImpl: async () => ({ ok: false, status }) });
  assert.equal((await run(401)).reason, 'config');
  assert.equal((await run(429)).reason, 'busy');
  assert.equal((await run(503)).reason, 'server');
  assert.equal((await provider.askCustomsModel({ ...base, env: {} })).reason, 'config');
  const i18n = JSON.parse(fs.readFileSync(new URL('../api/shared/i18n/customs-ai.json', import.meta.url), 'utf8'));
  for (const lang of ['de', 'en', 'pl', 'es', 'fr', 'it']) {
    for (const k of ['Config', 'Busy', 'Timeout']) assert.ok(i18n[lang]['api.customsAi.unavailable' + k], lang + k);
  }
});
