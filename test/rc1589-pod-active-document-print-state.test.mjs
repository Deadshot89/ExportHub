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
  assert.match(smoke,/id="rc576DocumentHub"><div id="rc576DocumentStage" data-doc="load1"/);
  assert.match(smoke,/id="rc576DocumentStage" data-doc="load1"/);
  assert.match(smoke,/class="rc390-docview" data-rc601-doc="load1"/);
  assert.match(smoke,/class="rc390-bundle"/);
  assert.doesNotMatch(smoke,/id="rc576DocumentStage" class="rc390-docview"/);
  assert.match(smoke,/class="rc390-page rc390-load rc576-load1"/);
  assert.match(smoke,/expect\(layout\.printStage,[^\n]*\)\.toBe\('load1'\)/);
  assert.match(smoke,/expect\(layout\.printPageHeight,[^\n]*\)\.toBeGreaterThan\(0\)/);
});
test('RC1589: Signaturhöhe, Größenlimit und Ausblendung von alten Werten bleiben geschützt',()=>{
  assert.match(smoke,/expect\(layout\.signatureHeight\)\.toBeGreaterThan\(0\)/);
  assert.match(smoke,/expect\(layout\.signatureHeight\)\.toBeLessThanOrEqual\(62\)/);
  assert.match(smoke,/expect\(layout\.visibleLegacy\)\.toBe\(0\)/);
});

test('RC1591: POD Browser-Smoke misst Geometrie erst nach vollständigem Layout und meldet die unsichtbare Ahnenkette',()=>{
  assert.match(smoke,/await page\.goto\('\/',\{waitUntil:'load'\}\)/);
  assert.match(smoke,/await document\.fonts\.ready/);
  assert.match(smoke,/requestAnimationFrame\(\(\)=>requestAnimationFrame\(resolve\)\)/);
  assert.match(smoke,/printAncestorDiagnostics/);
  assert.match(smoke,/expect\(layout\.printPageHeight,[^\n]*\)\.toBeGreaterThan\(0\)/);
});

test('RC1592: Release-Smoke validates both stage and nested document view without bypassing print CSS',()=>{
  assert.match(smoke,/expect\(layout\.printStageDisplay,[^\n]*\)\.not\.toBe\('none'\)/);
  assert.match(smoke,/expect\(layout\.printViewDisplay,[^\n]*\)\.not\.toBe\('none'\)/);
  assert.match(smoke,/expect\(layout\.printPageHeight,[^\n]*\)\.toBeGreaterThan\(0\)/);
  assert.doesNotMatch(smoke,/#rc576DocumentStage[^\n]*\.style\.display\s*=/);
});
