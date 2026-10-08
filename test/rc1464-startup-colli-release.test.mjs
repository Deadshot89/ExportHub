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

test('RC1464: explicit shipment actions still retain the strict persistence bridge', () => {
  const explicitFlow = fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js', 'utf8');
  assert.match(explicitFlow, /ExportHUBRC565/,
    'an explicit shipment action must still use the strict shipment controller');
  assert.match(explicitFlow, /persistShipment\s*\(/,
    'strict persistence must remain reachable outside startup repair');
});

test('RC1464: pretest accepts silent startup persistence without pinning an old repair label', () => {
  const pretest = fs.readFileSync('scripts/rc1462-pretest.mjs', 'utf8');
  assert.match(pretest, /ExportHUBClean\[\\s\\S\]\*\?queueSave/,
    'pretest must recognize the semantic silent queueSave contract');
  assert.doesNotMatch(pretest, /queueSave\(['"]RC1458 Warenbeschreibung Hintergrundreparatur/,
    'pretest must not require the obsolete RC1458 queueSave reason');
});
