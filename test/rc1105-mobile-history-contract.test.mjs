import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');

test('RC1105: Sendungshistorie bleibt auf Smartphone ohne interne Scroll-Höhenbegrenzung lesbar',()=>{
  assert.match(source,/@media\(max-width:720px\)\{\.rc1071-history-list\{max-height:none\}/);
});
