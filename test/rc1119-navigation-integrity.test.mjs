import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const patch=fs.readFileSync('.github/rc1018/patch-calendar-shipment.mjs','utf8');
const history=fs.readFileSync('assets/rc1081-audit-history.js','utf8');
const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');

test('RC1119: Sendung erstellen setzt shipment vor dem Fresh-Draft-Start aktiv',()=>{
  const statePos=patch.indexOf('setViewState(view);var shipmentApi');
  const startPos=patch.indexOf('shipmentApi.startNewShipment()');
  assert.ok(statePos>=0,'shipment-State wird vor Fresh Draft nicht gesetzt');
  assert.ok(startPos>statePos,'Fresh Draft startet vor dem shipment-State');
});

test('RC1119: Historie darf andere Fachansichten nicht überschreiben',()=>{
  assert.match(history,/function clearHistoryShell\(\)/);
  assert.match(history,/if\(!historyView\(\)\)\{if\(old\)old\.remove\(\);clearHistoryShell\(\);return false\}/);
  assert.match(history,/rendered&&rendered!=='history'/);
});

test('RC1119: neuer History-Cache-Key wird ausgeliefert',()=>{
  assert.match(build,/assets\/rc1081-audit-history\.js\?v=1119/);
});
