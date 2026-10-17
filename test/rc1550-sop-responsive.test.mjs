import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('assets/sop/rc1550-sop.css','utf8');

test('RC1550: Styles bleiben vollständig auf den neuen SOP-Bereich begrenzt',()=>{
  assert.match(css,/\.rc1550-sop-/);
  assert.doesNotMatch(css,/(^|\n)\s*(body|html|button|input|select)\s*\{/m);
  assert.match(css,/:focus-visible/);
});

test('RC1550: Workspace reagiert auf Desktop, Tablet und Smartphone',()=>{
  assert.match(css,/grid-template-columns\s*:\s*minmax\([^;]+\)\s+minmax\(/i);
  assert.match(css,/@media\s*\(max-width:\s*980px\)/i);
  assert.match(css,/@media\s*\(max-width:\s*760px\)/i);
  assert.match(css,/grid-template-columns\s*:\s*1fr/i);
});

test('RC1550: Karten, leere Bereiche und Status besitzen klar erkennbare Zustände',()=>{
  for(const selector of ['.rc1550-sop-card','.rc1550-sop-empty-group','.rc1550-sop-unavailable','.rc1550-sop-nav-item.active']) assert.match(css,new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
