import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser=fs.readFileSync('e2e/specs/public-smoke.spec.mjs','utf8');
const liveStyle=fs.readFileSync('index.html','utf8');

test('RC1589: die echte Druckvorschau blendet nicht ausgewählte Seiten ausdrücklich aus',()=>{
  assert.match(liveStyle,/#rc576DocumentStage \.rc390-bundle>:is\(\.rc390-page,\.rc390-cmr-wrap\)\{display:none!important;visibility:hidden!important\}/);
  assert.match(liveStyle,/#rc576DocumentStage\[data-doc="load1"\] \.rc390-bundle>\.rc576-load1/);
});

test('RC1589: POD-Druckbrowsertest wählt die reale Dokumentart Ladeliste 1',()=>{
  assert.match(browser,/rc390-page rc390-load rc576-load1/);
  assert.match(browser,/id="rc576DocumentStage" class="rc390-docview" data-doc="load1"/);
  assert.match(browser,/root\.getBoundingClientRect\(\)\.height/);
  assert.match(browser,/rootVisibility/);
  assert.match(browser,/signatureVisibility/);
  assert.match(browser,/rootHeight.*toBeGreaterThan\(0\)/);
  assert.match(browser,/signatureHeight\)\.toBeGreaterThan\(0\)/);
  assert.match(browser,/visibleLegacy\)\.toBe\(0\)/);
  assert.match(browser,/maxCardHeight\)\.toBeLessThanOrEqual\(120\)/);
});
