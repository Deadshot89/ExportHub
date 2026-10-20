import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const loadingList=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');
const finalLayer=fs.readFileSync('assets/document-print-name.js','utf8');
const index=fs.readFileSync('index.html','utf8');

test('RC1559: die echte Ladelisten-Vorlage legt Altwerte in .rc390-line und .rc390-hint ab',()=>{
  assert.match(index,/<div class="rc390-sign rc929-proof-detail"><div class="rc390-label">Fahrername<\/div><div class="rc390-line">'\+esc\(driver\)\+'<\/div><div class="rc390-hint">/);
});

test('RC1559: beide Druckschichten blenden .rc390-line und .rc390-hint in bestätigten Abholfeldern aus',()=>{
  assert.match(finalLayer,/function suppressLegacyPickupContent\(card\)\{[^}]*querySelectorAll\('\.rc390-txt,\.rc352-txt,\.rc390-line,\.rc390-hint'\)/);
  assert.match(loadingList,/\[data-rc1503-pickup-field\] \.rc390-line,\[data-rc1503-pickup-field\] \.rc390-hint\{display:none!important\}/);
});

test('RC1559: Regel schlägt RC352 ".rc390-sign.rc929-proof-detail .rc390-line{display:flex!important}" (Palettenkarte)',()=>{
  // (0,4,0) > (0,3,0)
  assert.match(loadingList,/\.rc390-load \.rc390-sign\[data-rc1503-pickup-field\] \.rc390-line,\.rc390-load \.rc390-sign\[data-rc1503-pickup-field\] \.rc390-hint,/);
  assert.match(index,/\.rc390-sign\.rc929-proof-detail \.rc390-line\{[^}]*display:flex!important/);
});

test('RC1559: Browser-Regression läuft im POD-Workflow mit',()=>{
  const wf=fs.readFileSync('.github/workflows/rc1547-loading-list-single-page-verify.yml','utf8');
  assert.match(wf,/e2e\/specs\/rc1559-pod-real-template\.spec\.mjs/);
  assert.match(wf,/test\/rc1559-pod-real-template\.test\.mjs/);
});
