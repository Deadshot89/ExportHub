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

test('RC1359: Lieferscheine bleiben vollständig und werden nach 15 Einträgen spaltenweise umgebrochen',()=>{
  assert.match(runtime,/enhanceDocuments\(root,sh\|\|\{\}\)/);
  assert.match(runtime,/perColumn=15/);
  assert.match(runtime,/files\.slice\(start,start\+perColumn\)/);
  assert.match(runtime,/data-rc1359-document-column/);
  assert.match(runtime,/Math\.min\(columnCount,4\)/);
  assert.match(runtime,/data-rc1293-packing-slip/);
  assert.match(runtime,/overflow-wrap:anywhere/);
  assert.match(runtime,/word-break:break-word/);
});

test('RC1359: Druck-QR sitzt ausschließlich oben rechts auf dem Deckblatt und bleibt kompakt',()=>{
  assert.match(runtime,/data-rc1359-print-qr-top-right/);
  assert.match(runtime,/rc1359-print-qr-top-right/);
  assert.match(runtime,/rc1359-cover-top-right/);
  assert.doesNotMatch(runtime,/data-rc1344-print-qr-bottom-row/);
  assert.doesNotMatch(runtime,/rc1327-print-qr-bottom/);
  assert.doesNotMatch(runtime,/rc1315-print-qr-in-ref/);
  assert.match(runtime,/width:12mm!important;height:12mm!important/);
  assert.match(runtime,/width:18mm!important;max-width:18mm!important/);
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

test('RC1359: neue Druckruntime wird cache-sicher geladen',()=>{
  assert.match(build,/rc1305-loading-list-print\.js\?v=1359/);
  assert.match(runtime,/version:'RC1359'/);
  assert.match(runtime,/@page\{size:A4 portrait;margin:0\}/);
  assert.match(runtime,/width:210mm!important/);
  assert.match(runtime,/min-height:297mm!important/);
});
