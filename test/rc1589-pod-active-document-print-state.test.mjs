import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const smoke=fs.readFileSync('e2e/specs/public-smoke.spec.mjs','utf8');
const ui=fs.readFileSync('index.html','utf8');
test('RC1589: die Druckvorlage blendet Dokumentseiten ohne aktiven data-doc-Zustand aus',()=>{
  assert.match(ui,/#rc576DocumentStage \.rc390-bundle>:is\(\.rc390-page,\.rc390-cmr-wrap\)\{display:none!important;visibility:hidden!important\}/);
  assert.match(ui,/#rc576DocumentStage\[data-doc="load1"\] \.rc390-bundle>\.rc576-load1/);
});
test('RC1589: RC1555 Live-Smoke aktiviert dieselbe Ladeliste wie die echte Dokumentansicht',()=>{
  assert.match(smoke,/id="rc576DocumentStage" class="rc390-docview" data-doc="load1"/);
  assert.match(smoke,/class="rc390-page rc390-load rc576-load1"/);
  assert.match(smoke,/expect\(layout\.printStage,[^\n]*\)\.toBe\('load1'\)/);
  assert.match(smoke,/expect\(layout\.printPageHeight,[^\n]*\)\.toBeGreaterThan\(0\)/);
});
test('RC1589: Signaturhöhe, Größenlimit und Ausblendung von alten Werten bleiben geschützt',()=>{
  assert.match(smoke,/expect\(layout\.signatureHeight\)\.toBeGreaterThan\(0\)/);
  assert.match(smoke,/expect\(layout\.signatureHeight\)\.toBeLessThanOrEqual\(62\)/);
  assert.match(smoke,/expect\(layout\.visibleLegacy\)\.toBe\(0\)/);
});
