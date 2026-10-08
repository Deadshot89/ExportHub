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
  assert.doesNotMatch(repair, /Bitte Verpackung, Anzahl und Gewicht in jeder Colli-Zeile vollständig erfassen/, 'startup repair must not emit the Colli validation alert');
});

test('RC1465: release transform preserves an already silent RC1464 startup repair', () => {
  const hotfix = fs.readFileSync('scripts/rc1452-mail-goods-print-hotfix.mjs', 'utf8');
  assert.match(hotfix, /const startupRepairBlock=source\.slice\(startupRepairStart,startupRepairEnd\)/,
    'RC1452 hotfix must inspect the existing startup repair before mutating it');
  assert.match(hotfix, /if\(\/ExportHUBRC565\|persistShipment\/\.test\(startupRepairBlock\)\)/,
    'strict persistence must be replaced only when it is still present');
  assert.match(hotfix, /else if\(!\/ExportHUBClean\[\\s\\S\]\*\?queueSave\/\.test\(startupRepairBlock\)\)/,
    'an already silent queueSave startup repair must be accepted instead of patched again');
});
