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

test('RC1366: Druck-QR sitzt oben rechts direkt auf dem Deckblatt und bleibt 12mm groß',()=>{
  assert.match(runtime,/data-rc1361-print-qr-top-right/);
  assert.match(runtime,/rc1361-print-qr-top-right/);
  assert.match(runtime,/setAttribute\('data-rc1361-print-qr-top-right','1'\)/);
  assert.doesNotMatch(runtime,/setAttribute\('data-rc1361-print-qr-bottom'/);
  assert.doesNotMatch(runtime,/className=['"][^'"]*rc1315-print-qr-in-ref/);
  assert.ok(runtime.includes("important(section,'top','8mm')"));
  assert.ok(runtime.includes("important(section,'right','8mm')"));
  assert.ok(runtime.includes("important(section,'position','absolute')"));
  assert.ok(runtime.includes("important(code,'width','12mm')"));
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

test('RC1435: aktualisierte ABD-Druckruntime bleibt über den produktiven Asset-Pfad geladen',()=>{
  assert.match(build,/rc1305-loading-list-print\.js\?v=1379/);
  assert.match(runtime,/version:'RC1379'/);
});


test('DNC-Druck: identische Nummer und PDF-Datei werden zusammengeführt',()=>{assert.match(runtime,/function canonicalDeliveryKey\(v\)/);assert.match(runtime,/seen\[key\]=1;out\.push\(name\.replace/);assert.match(runtime,/canonicalDeliveryKey\(x\)===canonicalDeliveryKey\(name\)/);});
test('DNC-Druck: ab sechs Dokumenten zwei Spalten',()=>{assert.match(runtime,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);assert.match(runtime,/files\.length<6/);assert.match(runtime,/grid-template-columns','minmax\(0,1fr\)'/);});
test('RC1372: DNC-Rahmen werden nicht mehr durch ein spaeteres stretch ueberschrieben',()=>{
  assert.ok(runtime.includes("align-items:flex-start!important;gap:"));
  assert.ok(!runtime.includes("gap:'+metrics.gap+'!important;align-items:stretch!important"));
  assert.ok(runtime.includes("font:'6.2pt'"));
});


test('RC1372: jedes DNC erzwingt Inhaltsbreite auch gegen fremde Layout-CSS',()=>{
  assert.ok(runtime.includes("width:fit-content!important"));
  assert.ok(runtime.includes("empf[aä]nger(?:\\s*\\/\\s*kunde)?"));
});


test('RC1376: Deckblatt und Ladeliste teilen Empfaenger- und Dokumentenhancer',()=>{
  assert.ok(runtime.includes("enhanceRecipient(root,sh||{});enhanceDocuments(root,sh||{})"));
});
