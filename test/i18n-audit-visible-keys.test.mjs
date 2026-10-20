import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('scripts/i18n-audit.mjs','utf8');
function between(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,'missing audit scanner section: '+start);
  return source.slice(a,b);
}
const lines=source.split('\n');
const keyPattern=lines.find(x=>x.startsWith('const KEY_LITERAL='));
const contextPattern=lines.find(x=>x.startsWith('const UI_CONTEXT='));
assert.ok(keyPattern&&contextPattern);
const code=[
  keyPattern,contextPattern,
  between('function compact(', '// Bounded linear scan'),
  between('function literalTexts(', 'function scanVisibleGerman('),
  between('function scanVisibleKeys(', 'function loadPacks('),
  'globalThis.scanVisibleKeysForTest=scanVisibleKeys;'
].join('\n');
const sandbox={};
vm.runInNewContext(code,sandbox);
const scan=(text)=>sandbox.scanVisibleKeysForTest({rel:'fixture.html'},text);

test('literal translation key in visible textContent is flagged',()=>{
  const rows=scan("button.textContent='common.save';");
  assert.equal(rows.length,1);
  assert.equal(rows[0].literal,'common.save');
});

test('translation key in HTML button body is flagged',()=>{
  assert.equal(scan("root.innerHTML='<button>shipment.confirm</button>';").length,1);
});

test('raw translation key in accessibility attribute is flagged',()=>{
  assert.equal(scan("node.setAttribute('aria-label','common.save');").length,1);
});

test('i18n data attribute used by translator is not flagged as raw rendering',()=>{
  assert.equal(scan("root.innerHTML='<button data-i18n=\"common.save\"></button>';").length,0);
});

test('unrelated translation keys on minified lines do not become visible-key hits',()=>{
  assert.equal(scan("const k='common.save';title=document.querySelector('title');").length,0);
  assert.equal(scan("nav.textContent=nav.textContent.replace(/\\s*settings.reset/g,'');").length,0);
  assert.equal(scan("const key='common.save'; panel.textContent='Finished';").length,0);
});
