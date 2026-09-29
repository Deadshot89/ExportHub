import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const runtime=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');

test('RC1341: Gesamtdruck enthält genau eine Ladeliste',()=>{
  assert.match(build,/html=html\.replace\("\+coverHtml\(sh\)\+loadHtml\(sh,true\)\+loadHtml\(sh,false\)\+cmrHtml\(sh\)\+","\+coverHtml\(sh\)\+loadHtml\(sh,true\)\+cmrHtml\(sh\)\+"\)/);
  assert.match(build,/return\[d\.cover,d\.load1\]\.concat\(d\.cmrs\.slice\(0,3\)\)\.filter\(Boolean\)/);
  assert.match(build,/if\(mode==='load2'\)return\[d\.load2\]\.filter\(Boolean\)/);
});

test('RC1341: Lieferscheine werden einzeln und umbruchfähig gerendert',()=>{
  assert.match(runtime,/enhanceDocuments\(root,sh\|\|\{\}\)/);
  assert.match(runtime,/rc1305-document-grid/);
  assert.match(runtime,/overflow-wrap:anywhere/);
  assert.match(runtime,/word-break:break-word/);
});

test('RC1341: Druck-QR sitzt kompakt oben rechts ohne Referenz zu überdecken',()=>{
  assert.match(runtime,/data-rc1341-print-qr-top-right/);
  assert.match(runtime,/padding-right','19mm'/);
  assert.match(runtime,/rc1315-print-qr-in-ref/);
});

test('RC1341: Deckblatt zeigt ein vorhandenes Abholdatum',()=>{
  assert.match(runtime,/function ensureCoverPickupDate\(/);
  assert.match(runtime,/Abholdatum:/);
  assert.match(runtime,/data-rc1341-pickup-date/);
});

test('RC1341: neue Druckruntime wird cache-sicher geladen',()=>{
  assert.match(build,/rc1305-loading-list-print\.js\?v=1341/);
  assert.match(runtime,/version:'RC1341'/);
});
