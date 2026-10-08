import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync('assets/rc1267-i18n.js', 'utf8');

function startupRepairBlock() {
  const start = runtime.indexOf('function repairContaminatedGoodsDescription()');
  const end = runtime.indexOf('function snapshotShipmentDraft()', start);
  assert.ok(start >= 0 && end > start, 'startup goods-description repair block must exist');
  return runtime.slice(start, end);
}

test('RC1464: startup repair never enters strict Colli shipment validation', () => {
  const repair = startupRepairBlock();
  assert.match(repair, /ExportHUBClean[\s\S]*?queueSave/, 'startup repair must use silent queueSave persistence');
  assert.doesNotMatch(repair, /ExportHUBRC565|persistShipment/, 'startup repair must not call strict shipment persistence');
});

test('RC1464: explicit Colli validation remains available outside startup repair', () => {
  const colli = fs.readFileSync('assets/rc565-colli.js', 'utf8');
  assert.match(colli, /Bitte Verpackung, Anzahl und Gewicht in jeder Colli-Zeile vollständig erfassen\./,
    'explicit shipment validation message must remain available for intended save/finalize actions');
});
