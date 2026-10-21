import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const wrapper=fs.readFileSync('assets/document-print-name.js','utf8');
const css=wrapper.slice(wrapper.indexOf('function image4Css(){'),wrapper.indexOf('function ensureImage4Style('));

test('RC1561: untere Kacheln folgen dem Inhalt statt absolut am Seitenende zu kleben',()=>{
  assert.ok(css.length>0,'image4Css fehlt');
  assert.match(css,/\.rc390-page\.rc390-load\[data-rc1547-single-page\][^{]*\{display:flex!important;flex-direction:column!important;height:auto!important;max-height:none!important;min-height:297mm!important\}/);
  assert.match(css,/\.rc390-load\[data-rc1547-single-page\] \.rc390-bottom[^{}]*\{position:relative!important;left:auto!important;right:auto!important;bottom:auto!important/);
});

test('RC1561: PDF-Rahmen zeigt lange Lieferscheinlisten zweispaltig wie der Druck',()=>{
  assert.match(css,/\.index352-pdf-root \.rc390-load \[data-rc1504-document-columns="2"\][^{]*\{display:grid!important;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
});

test('RC1561: Browser-Regression läuft im POD-Workflow mit',()=>{
  const wf=fs.readFileSync('.github/workflows/rc1547-loading-list-single-page-verify.yml','utf8');
  assert.match(wf,/e2e\/specs\/rc1561-pod-bottom-tiles\.spec\.mjs/);
  assert.match(wf,/test\/rc1561-pod-bottom-tiles\.test\.mjs/);
});

// RC1595: old signed PODs may lack the RC1547 marker or contain inline !important layout.
// Only a live in-flow footer and hard inline overrides can reliably win over those legacy rules.
test('RC1595: signed POD tiles remain inside flow without RC1547 marker or with inline absolute footer',()=>{
  assert.match(css,/\.rc390-load\[data-rc1503-image4-pickup-layout="1"\] \.rc390-bottom/);
  assert.match(css,/\.rc352-load\[data-rc1503-image4-pickup-layout="1"\] \.rc352-bottom/);
  assert.match(wrapper,/footer\.style\.setProperty\('position','relative','important'\)/);
  assert.match(wrapper,/footer\.style\.setProperty\('bottom','auto','important'\)/);
  assert.match(wrapper,/root\.style\.setProperty\('height','auto','important'\)/);
  assert.match(wrapper,/footer\.setAttribute\('data-rc1595-footer-in-flow','1'\)/);
  assert.match(wrapper,/w\.EXPORTHUB_POD_RENDER_LAYOUT='RC1595'/);
});
