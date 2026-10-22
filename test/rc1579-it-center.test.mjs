import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('assets/rc1579-menu-redesign.js','utf8');
const css=fs.readFileSync('assets/rc1579-menu-redesign.css','utf8');
const i18n=fs.readFileSync('assets/i18n/rc1579-menu-redesign.js','utf8');

test('IT views are grouped behind one IT menu entry',()=>{
  assert.match(js,/IT_VIEWS=\['diagnostics','release','update'\]/);
  assert.match(js,/'privacy','it','diagnostics','release','update'/);
  assert.match(js,/ICONS\.it=/);
  assert.match(js,/data-rc1579-proxy="it"/);
  assert.match(js,/IT_VIEWS\.indexOf\(v\)>=0\)out\.push\(R\+'>'\+item\+'\{display:none!important\}'\)/);
});

test('IT tabs are rendered inside the content without moving nav buttons',()=>{
  assert.match(js,/function itTabs\(/);
  assert.match(js,/content\.prepend\(/);
  assert.match(js,/data-rc1579-it-tab/);
  assert.match(js,/function openIt\(/);
  assert.match(css,/\.rc1579-it-tabs\{/);
});

test('IT labels exist in all six languages',()=>{
  const it=i18n.match(/\bit:'[^']+'/g)||[];
  const title=i18n.match(/\bitTitle:'[^']+'/g)||[];
  assert.equal(it.length,6);
  assert.equal(title.length,6);
});
