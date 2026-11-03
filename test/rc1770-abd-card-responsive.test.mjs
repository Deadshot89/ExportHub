import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('assets/rc1770-abd-history-responsive.css','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const source=fs.readFileSync('index.html','utf8');

test('RC1770: saved ABD request status stays inside the responsive card without clipping',()=>{
  assert.match(source,/rc626Abd/);
  assert.match(source,/rc626-item-head/);
  assert.match(css,/#rc626Abd \.rc626-grid2 > section\s*\{\s*min-width:\s*0/);
  assert.match(css,/#rc626Abd \.rc626-item-head\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*flex-wrap:\s*wrap/);
  assert.match(css,/#rc626Abd \.rc626-item-head > div\s*\{[^}]*flex:\s*1 1 0;[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere/);
  assert.match(css,/#rc626Abd \.rc626-item-head > \.pill\s*\{[^}]*flex:\s*0 0 auto/);
  assert.doesNotMatch(css,/overflow-x:\s*hidden|text-overflow:\s*ellipsis|display:\s*none/);
});

test('RC1770: all three release artifacts load exactly the same scoped ABD CSS',()=>{
  assert.match(builder,/const abdCss='assets\/rc1770-abd-history-responsive\.css'/);
  assert.match(builder,/const abdCssText=fs\.readFileSync\(abdCssFile,'utf8'\)/);
  assert.match(builder,/rc1770-abd-history-style/);
  assert.doesNotMatch(builder,/data-rc1770-abd-history-css|<link rel="stylesheet" href="\/assets\/rc1770/);
  assert.match(builder,/html\.slice\(0,endHead\.index\)\+tag/);
  assert.match(builder,/for\(const file of \['index\.html','TESTVERSION\.html','demo\.html'\]\)patchHtml\(file\)/);
});
