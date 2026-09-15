import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const patch=fs.readFileSync('.github/rc1018/patch-calendar-shipment.mjs','utf8');
const history=fs.readFileSync('assets/rc1081-audit-history.js','utf8');
const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');

test('RC1119: Sendung erstellen setzt shipment vor dem Fresh-Draft-Start aktiv',()=>{
  assert.match(
    patch,
    /const freshRoute="function route\(view,source\)\{view=canonical\(view\);if\(view==='shipment'&&source==='menu'\)\{[\s\S]{0,300}setViewState\(view\);[\s\S]{0,300}shipmentApi\.startNewShipment\(\)/,
    'Fresh-Draft-Route muss den shipment-State vor startNewShipment setzen.'
  );
});

test('RC1119: Historie darf andere Fachansichten nicht überschreiben',()=>{
  assert.match(history,/function clearHistoryShell\(\)/);
  assert.match(history,/if\(!historyView\(\)\)\{if\(old\)old\.remove\(\);clearHistoryShell\(\);return false\}/);
  assert.match(history,/rendered&&rendered!=='history'/);
});

test('RC1119: neuer History-Cache-Key wird ausgeliefert',()=>{
  assert.match(build,/assets\/rc1081-audit-history\.js\?v=1119/);
});
