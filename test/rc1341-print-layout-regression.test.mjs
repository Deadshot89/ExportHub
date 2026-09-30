import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const runtime=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');

test('RC1355: Gesamtdruck enthält genau eine Ladeliste sowie drei CMR',()=>{
  assert.ok(build.includes('html=html.replace("+coverHtml(sh)+loadHtml(sh,true)+loadHtml(sh,false)+cmrHtml(sh)+","+coverHtml(sh)+loadHtml(sh,true)+cmrHtml(sh)+")'));
  assert.ok(build.includes("return[d.cover,d.load1].concat(d.cmrs.slice(0,3)).filter(Boolean)"));
  assert.ok(build.includes("if(mode==='load2')return[d.load2].filter(Boolean)"));
  assert.equal(build.includes("return[d.cover,d.load1,d.load2].concat(d.cmrs.slice(0,3)).filter(Boolean)"),false);
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

test('RC1355: Druck-QR sitzt klein ausschließlich unten bei den anderen QR-Codes auf dem Deckblatt',()=>{
  assert.match(runtime,/data-rc1355-print-qr-bottom-center/);
  assert.match(runtime,/rc1355-print-qr-center/);
  assert.match(runtime,/rc1355-print-qr-center/);
  assert.doesNotMatch(runtime,/data-rc1341-print-qr-top-right/);
  assert.doesNotMatch(runtime,/padding-right','19mm'/);
  assert.doesNotMatch(runtime,/rc1315-print-qr-in-ref/);
  assert.ok(runtime.includes("important(section,'left','50%')"));
  assert.ok(runtime.includes("important(section,'bottom','14mm')"));
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

test('RC1355: neue Druckruntime wird cache-sicher geladen',()=>{
  assert.ok(build.includes('assets/rc1305-loading-list-print.js?v=1355'));
  assert.match(runtime,/version:'RC1355'/);
});


test('RC1355: zusammengeklebte PDF-Namen werden vor dem Druck getrennt und kompakt dargestellt',()=>{
  assert.ok(runtime.includes('function splitPdfNames('));
  assert.ok(runtime.includes('grid.style.cssText'));
  assert.ok(runtime.includes('font-size:5.2pt!important'));
  assert.ok(runtime.includes('gap:.45mm!important'));
});
