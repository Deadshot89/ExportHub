import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const runtime=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');

test('RC1342: Gesamtdruck enthält genau L1 und L2 sowie drei CMR',()=>{
  assert.match(build,/html=html\.replace\("\+coverHtml\(sh\)\+loadHtml\(sh,true\)\+cmrHtml\(sh\)\+","\+coverHtml\(sh\)\+loadHtml\(sh,true\)\+loadHtml\(sh,false\)\+cmrHtml\(sh\)\+"\)/);
  assert.match(build,/return\[d\.cover,d\.load1,d\.load2\]\.concat\(d\.cmrs\.slice\(0,3\)\)\.filter\(Boolean\)/);
  assert.match(build,/if\(mode==='load2'\)return\[d\.load2\]\.filter\(Boolean\)/);
});

test('RC1342: Lieferscheine werden einzeln und umbruchfähig gerendert',()=>{
  assert.match(runtime,/enhanceDocuments\(root,sh\|\|\{\}\)/);
  assert.match(runtime,/rc1305-document-grid/);
  assert.match(runtime,/data-rc1293-packing-slip-grid/);
  assert.match(runtime,/data-rc1293-packing-slip/);
  assert.match(runtime,/rc1305-document-item rc1293-packing-slip/);
  assert.match(runtime,/overflow-wrap:anywhere/);
  assert.match(runtime,/word-break:break-word/);
});

test('RC1344: Druck-QR sitzt ausschließlich unten bei den anderen QR-Codes auf dem Deckblatt',()=>{
  assert.match(runtime,/data-rc1344-print-qr-bottom-row/);
  assert.match(runtime,/rc1327-print-qr-bottom/);
  assert.match(runtime,/rc1327-cover-qr-row/);
  assert.doesNotMatch(runtime,/data-rc1341-print-qr-top-right/);
  assert.doesNotMatch(runtime,/padding-right','19mm'/);
  assert.doesNotMatch(runtime,/rc1315-print-qr-in-ref/);
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

test('RC1344: neue Druckruntime wird cache-sicher geladen',()=>{
  assert.match(build,/rc1305-loading-list-print\.js\?v=1344/);
  assert.match(runtime,/version:'RC1344'/);
});
