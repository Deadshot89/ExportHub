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

test('RC1465: RC1452 release transform accepts an already silent RC1464 startup repair', () => {
  const hotfix = fs.readFileSync('scripts/rc1452-mail-goods-print-hotfix.mjs', 'utf8');
  assert.match(hotfix, /function startupRepairUsesSilentPersistence\(source\)/,
    'RC1452 hotfix must detect an already repaired startup persistence block');
  assert.match(hotfix, /if\(!startupRepairUsesSilentPersistence\(source\)\)/,
    'RC1458 transform must only run when silent startup persistence is still missing');
  assert.match(hotfix, /ExportHUBClean\[\\s\\S\]\*\?queueSave/,
    'final RC1458/RC1464 verification must use the semantic queueSave contract');
});
