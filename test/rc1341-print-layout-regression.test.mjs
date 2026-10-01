import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const runtime=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');

test('RC1345: Gesamtdruck enthält genau eine Ladeliste sowie drei CMR',()=>{
  assert.match(build,/html=html\.replace\("\+coverHtml\(sh\)\+loadHtml\(sh,true\)\+loadHtml\(sh,false\)\+cmrHtml\(sh\)\+","\+coverHtml\(sh\)\+loadHtml\(sh,true\)\+cmrHtml\(sh\)\+"\)/);
  assert.match(build,/return\[d\.cover,d\.load1\]\.concat\(d\.cmrs\.slice\(0,3\)\)\.filter\(Boolean\)/);
  assert.match(build,/if\(mode==='load2'\)return\[d\.load2\]\.filter\(Boolean\)/);
});

test('RC1342: Lieferscheine werden einzeln und umbruchfähig gerendert',()=>{
  assert.match(runtime,/enhanceDocuments\(root,sh\|\|\{\}\)/);
  assert.match(runtime,/rc1305-document-grid/);
  assert.match(runtime,/data-rc1293-packing-slip-grid/);
  assert.match(runtime,/data-rc1293-packing-slip/);
  assert.ok(runtime.includes("(emptyState?'rc1305-document-empty':'rc1305-document-item')+' rc1293-packing-slip'"));
  assert.match(runtime,/overflow-wrap:anywhere/);
  assert.match(runtime,/word-break:break-word/);
});

test('RC1361: Druck-QR sitzt klein oben rechts direkt auf dem Deckblatt',()=>{
  assert.match(runtime,/data-rc1361-print-qr-top-right/);
  assert.match(runtime,/rc1361-print-qr-top-right/);
  assert.match(runtime,/setAttribute\('data-rc1361-print-qr-top-right','1'\)/);
  assert.doesNotMatch(runtime,/setAttribute\('data-rc1361-print-qr-bottom'/);
  assert.doesNotMatch(runtime,/className=['"][^'"]*rc1315-print-qr-in-ref/);
  assert.ok(runtime.includes("important(section,'top','8mm')"));
  assert.ok(runtime.includes("important(section,'right','8mm')"));
  assert.ok(runtime.includes("important(section,'position','absolute')"));
  assert.ok(runtime.includes("important(code,'width','8mm')"));
});

test('RC1342: Deckblatt zeigt ein vorhandenes Abholdatum',()=>{
  assert.match(runtime,/function ensureCoverPickupDate\(/);
  assert.match(runtime,/tr\('pickup\.date'\)/);
  assert.match(runtime,/data-rc1341-pickup-date/);
});

test('RC1343: Deckblatt wird zwei Punkte und Ladeliste einen Punkt kompakter gedruckt',()=>{
  assert.match(runtime,/enhance\(html,sh,withQr\)[\s\S]*?shrinkInlineFonts\(root,1\)/);
  assert.match(runtime,/enhanceCover\(html,sh\)[\s\S]*?shrinkInlineFonts\(root,2\)/);
});

test('RC1364: neue Druckruntime bleibt cache-sicher geladen',()=>{
  assert.match(build,/rc1305-loading-list-print\.js\?v=1363/);
  assert.match(runtime,/version:'RC1364'/);
});


test('RC1362: PDF-Namen werden einzeln untereinander vollständig und ohne Spaltenwechsel gerendert',()=>{
  assert.ok(runtime.includes('function splitPdfNames('));
  assert.ok(runtime.includes('display:flex!important'));
  assert.ok(runtime.includes('flex-direction:column!important'));
  assert.doesNotMatch(runtime,/docColumns=Math\.max\(1,Math\.ceil\(docCount\/15\)\)/);
  assert.doesNotMatch(runtime,/grid-template-rows:repeat\(15,minmax\(0,auto\)\)/);
  assert.doesNotMatch(runtime,/grid-auto-flow:column/);
  assert.ok(runtime.includes('overflow:visible!important'));
  assert.ok(runtime.includes('font-size:5.2pt!important'));
});


test('RC1363: lange PDF-Listen bleiben einspaltig und werden nur bei Bedarf verdichtet',()=>{
  assert.match(runtime,/files\.length>24\?'ultra':\(files\.length>15\?'dense':'normal'\)/);
  assert.match(runtime,/data-rc1363-document-density/);
  assert.match(runtime,/density==='ultra'\?\{gap:'\.1mm',pad:'\.1mm \.3mm',font:'4\.2pt',line:'\.9',border:'\.2mm'\}/);
  assert.match(runtime,/density==='dense'\?\{gap:'\.18mm',pad:'\.15mm \.35mm',font:'4\.6pt',line:'\.95',border:'\.25mm'\}/);
  assert.match(runtime,/display:flex!important/);
  assert.match(runtime,/flex-direction:column!important/);
  assert.match(runtime,/overflow-wrap:anywhere/);
  assert.match(runtime,/word-break:break-word/);
  assert.doesNotMatch(runtime,/grid-auto-flow:column/);
});
