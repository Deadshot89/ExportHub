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
