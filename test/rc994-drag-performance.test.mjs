import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html', 'utf8');

function between(start, end, max = 16000) {
  const i = html.indexOf(start);
  assert.ok(i >= 0, `Startmarker fehlt: ${start}`);
  const tail = html.slice(i, i + max);
  const j = end ? tail.indexOf(end) : -1;
  return j >= 0 ? tail.slice(0, j) : tail;
}

test('RC994: Planner-Reconcile nach Drag verschiebt lokal und löst keinen Vollrender aus', () => {
  const src = between('function plannerQueueReconcileRC907()', 'function moveTask(', 5000);
  assert.doesNotMatch(src, /\brender\s*\(/, 'Nach einer optimistischen Planner-Verschiebung darf kein kompletter Planner-Render folgen');
  assert.match(src, /plannerReconcileAfterMoveRC994\s*\(/, 'RC994 muss die lokalen Planner-Zähler/Signatur nachziehen');
});

test('RC994: Planner aktualisiert nach dem lokalen Move die Render-Signatur', () => {
  const src = between('function plannerReconcileAfterMoveRC994(', 'function plannerQueueReconcileRC907', 7000);
  assert.match(src, /lastSourceSignature\s*=\s*plannerSourceSignatureRC923\s*\(/, 'lokaler Move muss die aktuelle Planner-Signatur übernehmen');
  assert.match(src, /plannerUpdateOverviewRC994\s*\(/, 'Wochenübersicht muss lokal aktualisiert werden');
  assert.match(src, /plannerUpdateStatusRC994\s*\(/, 'Statusleiste muss lokal aktualisiert werden');
});

test('RC994: Warehouse-Pointermove scannt nicht bei jedem Event alle Drop-Zonen', () => {
  const src = between("root.addEventListener('pointermove'", "root.addEventListener('pointerup'", 9000);
  assert.doesNotMatch(src, /querySelectorAll\('\.rc513-drop-target'\)/, 'pointermove darf nicht alle Drop-Zonen pro Event scannen');
  assert.match(src, /warehouseSetDropTargetRC994\s*\(\s*root\s*,\s*zone\s*\)/, 'RC994 muss nur das tatsächlich geänderte Drop-Ziel umschalten');
});

test('RC994: Warehouse hält das aktive Drop-Ziel zustandsbasiert', () => {
  const src = between('function warehouseSetDropTargetRC994(', 'function bindWarehouseDnD', 7000);
  assert.match(src, /warehouseDropTargetRC994/, 'aktives Warehouse-Drop-Ziel muss zwischengespeichert werden');
  assert.match(src, /classList\.remove\('rc513-drop-target'\)/);
  assert.match(src, /classList\.add\('rc513-drop-target'\)/);
});
