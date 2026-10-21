import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('assets/document-print-name.js','utf8');
const start=src.indexOf('function rc1607SignedPodCss(){');
const end=src.indexOf('function ensureImage4Style(){',start);
const css=src.slice(start,end);

test('RC1607: signed POD must place its six pickup tiles in an in-flow three-column A4 grid',()=>{
  assert.ok(start>0&&end>start,'The frame and preview signed-POD stylesheet must exist');
  assert.match(css,/\.rc390-page\.rc390-load\.index352-pod-signed/);
  assert.match(css,/\.rc390-bottom\{position:relative!important/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(css,/grid-auto-rows:25mm!important/);
  assert.match(css,/\.rc390-bottom \.rc390-qrslot\{display:none!important/);
  assert.match(css,/\.rc390-bottom \.rc390-sign\{position:relative!important/);
  assert.match(css,/height:25mm!important;max-height:25mm!important/);
  assert.match(css,/\.rc390-copy\{position:relative!important/);
});

test('RC1607: original driver image cannot overflow signature tile or repeat legacy pickup fields',()=>{
  assert.match(css,/img\.index352-proof-signature/);
  assert.match(css,/img\.rc1305-signature-image/);
  assert.match(css,/max-height:12mm!important/);
  assert.match(css,/\.rc390-sign\[data-rc1503-pickup-field\] \.rc390-line\{display:none!important/);
  assert.match(css,/\.rc390-bottom \.rc390-hint\{display:none!important/);
});

test('RC1607: actual index352 iframe must receive layout rules, not only the preview DOM',()=>{
  assert.match(css,/getElementById\('exporthub-rc352-document-style'\)/);
  assert.match(css,/iframe\.index352-pdf-frame,iframe\.index352-print-frame/);
  assert.match(css,/MutationObserver/);
  assert.match(src,/installPalletSnapshotCapture\(\);\s*installRc1607SignedPodCss\(\)/);
  const wf=fs.readFileSync('.github/workflows/rc1547-loading-list-single-page-verify.yml','utf8');
  assert.match(wf,/test\/rc1607-pod-screenshot-layout\.test\.mjs/);
  assert.match(wf,/e2e\/specs\/rc1607-pod-screenshot-layout\.spec\.mjs/);
});
