import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync('assets/rc1560-full-width.css','utf8');
const page=readFileSync('index.html','utf8');

test('RC1764: ABD Colli layout reserves exactly four tracks at laptop widths',()=>{
  assert.match(page,/function abdRowsHtml\(d\)[\s\S]*?<label class="field">Art der Colli[\s\S]*?<label class="field">Anzahl[\s\S]*?<label class="field">Gesamtgewicht der Zeile \(kg\)[\s\S]*?class="danger rc626-remove"/);
  assert.match(css,/@media screen and \(min-width:1191px\)\s*\{\s*#content #rc626Abd \.rc626-colli-grid\s*\{\s*grid-template-columns:minmax\(0,2fr\) minmax\(0,\.85fr\) minmax\(0,1\.35fr\) auto;/);
  assert.match(css,/#content #rc626Abd \.rc626-colli-grid > \.field \{min-width:0\}/);
  assert.doesNotMatch(css,/#content #rc626Abd\s*\{[^}]*overflow-x:\s*(?:hidden|clip)/);
});

test('RC1764: browser gate still checks genuine page width and reports overflow nodes',()=>{
  const helper=readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');
  assert.match(helper,/if\(dims\.scrollWidth>dims\.clientWidth\+tolerance\)/);
  assert.match(helper,/document\.querySelectorAll\('body \*'\)/);
  assert.match(helper,/tag:el\.tagName\.toLowerCase\(\)/);
  assert.match(helper,/expect\(dims\.scrollWidth,[\s\S]*?toBeLessThanOrEqual\(dims\.clientWidth\+tolerance\)/);
});
