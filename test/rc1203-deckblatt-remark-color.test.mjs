import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const runtime=fs.readFileSync('assets/rc1203-deckblatt-print.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const browser=fs.readFileSync('e2e/specs/print-documents.spec.mjs','utf8');
const demo=fs.readFileSync('assets/exporthub-demo-bootstrap.js','utf8');

test('RC1203: tatsächlicher rc390-Deckblattdruck wird farbig und drucksicher dekoriert',()=>{
  assert.match(runtime,/\.rc390-cover,\.rc352-cover/);
  assert.match(runtime,/border='12mm solid #0b1f44'/);
  assert.match(runtime,/borderTopWidth='20mm'/);
  assert.match(runtime,/outline='3mm solid #facc15'/);
  assert.match(runtime,/background='#dbeafe'/);
  assert.match(runtime,/webkitPrintColorAdjust='exact'/);
  assert.match(runtime,/printColorAdjust='exact'/);
  assert.match(runtime,/data-rc1203-cover-enhanced/);
});

test('RC1203: Bemerkung aus Sendungsdaten wird immer als eigener Deckblattblock ausgegeben',()=>{
  assert.match(runtime,/sh\.remark,sh\.remarks,sh\.bemerkung,sh\.comments/);
  assert.match(runtime,/data-rc1203-cover-remark/);
  assert.match(runtime,/title\.textContent='Bemerkung'/);
  assert.match(runtime,/body\.textContent=value/);
  assert.match(runtime,/data-rc896-field="remark"/);
  assert.match(runtime,/data-rc1203-remark-value/);
});

test('RC1203: Empfängeradresse und Referenz bleiben für Paletten deutlich hervorgehoben',()=>{
  assert.match(runtime,/data-rc1203-recipient-highlight/);
  assert.match(runtime,/fontSize='18pt'/);
  assert.match(runtime,/data-rc1203-reference-highlight/);
  assert.match(runtime,/background='#facc15'/);
  assert.match(runtime,/border='3mm solid #111827'/);
});

test('RC1203: Deckblatt- und CMR-Einzeldruck bleiben verfügbar',()=>{
  assert.match(runtime,/Nur Deckblatt drucken/);
  assert.match(runtime,/Nur CMR drucken/);
  assert.match(runtime,/pendingMode==='cover'/);
  assert.match(runtime,/pendingMode==='cmr'/);
  assert.match(runtime,/function documentsViewVisible\(\)/);
});

test('RC1203: Runtime wird in Produktion TESTSERVICE und Demo gebaut',()=>{
  assert.match(build,/assets\/rc1203-deckblatt-print\.js\?v=1203/);
  assert.match(build,/'assets\/rc1203-deckblatt-print\.js'/);
  assert.match(build,/deckblattHighVisibility:'RC1203 actual rc390 print cover/);
  assert.match(build,/coverRemark:'RC1203 shipment remark\/comments rendered on actual rc390 cover'/);
});

test('RC1203: Browser-Gate prüft echte Druckausgabe statt nur Quelltext',()=>{
  assert.match(browser,/data-rc1203-cover-enhanced/);
  assert.match(browser,/data-rc1203-cover-remark/);
  assert.match(browser,/RC1203 Demo-Bemerkung/);
  assert.match(demo,/comments:'RC1203 Demo-Bemerkung:/);
  assert.match(browser,/border:\\s\*12mm/);
});

test('RC1203: geänderte Runtime und Browserprüfung sind syntaktisch gültig',()=>{
  for(const file of ['assets/rc1203-deckblatt-print.js','e2e/specs/print-documents.spec.mjs','.github/rc1112/build-three-env.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
