import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('assets/rc1579-menu-redesign.js','utf8');
const css=fs.readFileSync('assets/rc1579-menu-redesign.css','utf8');
const i18n=fs.readFileSync('assets/i18n/rc1579-menu-redesign.js','utf8');

test('IT views are grouped behind one IT menu entry',()=>{
  assert.match(js,/IT_VIEWS=\['diagnostics','release','update'\]/);
  assert.match(js,/\{key:'admin',accent:'#64748b',views:\['rights','teamfile','packaging','settings','privacy'\]\}/);
  assert.match(js,/\{key:'it',flat:true,accent:'#64748b',views:\['it','diagnostics','release','update'\]\}/,'IT ist ein eigener Eintrag unter Administration');
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

test('IT entry is drawn like the Administration header, not as an indented sub-item (2026-10-24)',()=>{
  const fn=js.slice(js.indexOf('function ensureItProxy('),js.indexOf('function itTabs('));
  assert.match(fn,/proxy=d\.createElement\('div'\);proxy\.className='rc1579-it-entry'/);
  assert.match(fn,/<span class="rc1579-section-icon" aria-hidden="true"><\/span><span class="rc1579-section-label"><\/span><span class="rc1579-section-chevron" aria-hidden="true"><\/span>/);
  assert.doesNotMatch(fn,/copyLook\(/,'no inline styles: they beat the collapse rule and left IT dangling under a closed Administration');
  assert.match(fn,/e\.key==='Enter'\|\|e\.key===' '/);
  assert.match(css,/#nav#nav#nav>:is\(\.rc1579-section,\.rc1579-it-entry\)\{display:flex;/);
  assert.match(css,/#nav#nav#nav>:is\(\.rc1579-section,\.rc1579-it-entry\) \.rc1579-section-icon\{/);
  assert.match(css,/#nav#nav#nav>\.rc1579-it-entry\[data-rc1579-active\]\{/);
});
