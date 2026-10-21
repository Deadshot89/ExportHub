import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pickup=fs.readFileSync('assets/rc1546-pickup-control.js','utf8');
const smoke=fs.readFileSync('e2e/specs/public-smoke.spec.mjs','utf8');

test('RC1591: Abholkontrolle blendet andere Druckseiten nur bei vorhandenem Overlay aus',()=>{
  assert.match(pickup,/@media print\{body:has\(> \.rc1546-overlay\)>\*:not\(\.rc1546-overlay\)\{display:none!important\}/,
    'Globale Druck-Sperre muss an aktives Abholkontroll-Overlay gebunden sein');
  assert.doesNotMatch(pickup,/@media print\{body>\*:not\(\.rc1546-overlay\)\{display:none!important\}/,
    'Unbedingte Druck-Sperre würde auch echte Ladelisten verstecken');
});

test('RC1591: der Browser-Smoke prüft beide Druckmodi und die Signaturgeometrie',()=>{
  assert.match(smoke,/expect\(layout\.printPageHeight,[^\n]*\)\.toBeGreaterThan\(0\)/);
  assert.match(smoke,/expect\(layout\.signatureHeight\)\.toBeGreaterThan\(0\)/);
  assert.match(smoke,/expect\(overlayPrint\.stageDisplay,[^\n]*\)\.toBe\('none'\)/);
  assert.match(smoke,/expect\(overlayPrint\.overlayDisplay,[^\n]*\)\.not\.toBe\('none'\)/);
});

test('RC1591: der sichere Abholkontroll-Druckmodus bleibt möglich',()=>{
  assert.match(pickup,/function printCurrentList\(\)\{[^}]*window\.print\(\)/);
  assert.match(pickup,/overlay\.className='rc1546-overlay'/);
  assert.match(pickup,/d\.body\.appendChild\(overlay\)/);
  assert.match(pickup,/\.rc1546-overlay\{position:static!important;display:block!important/);
});
