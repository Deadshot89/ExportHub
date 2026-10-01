import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');

test('RC1389: POD-Abholblock nutzt im A4-Druck vier Spalten und bleibt bei einer Fahrerunterschrift',()=>{
  assert.match(runtime,/@media print\{[\s\S]*?\.rc1305-pickup-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
  assert.match(runtime,/\.rc1305-pickup-signature\{grid-column:span 2!important/);
  assert.match(runtime,/version:'RC1379'/);
});
