import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('scripts/i18n-audit.mjs','utf8');
const start=source.indexOf('function literalTexts(line,');
const end=source.indexOf('function scanVisibleGerman(',start);
assert.ok(start>=0&&end>start,'i18n literal parser missing');
const sandbox={};
vm.runInNewContext(source.slice(start,end)+'globalThis.scanTest=literalTexts;',sandbox);
const texts=sandbox.scanTest;

test('i18n literal scan is bounded even for oversized generated HTML lines',()=>{
  const giant='A'.repeat(2_000_000);
  const tick=String.fromCharCode(96);
  const found=texts('innerHTML='+tick+giant+' Sendung speichern'+tick);
  assert.ok(found.length>1,'Long quoted literals must be inspected in chunks');
  assert.ok(found.some(s=>s.includes('Sendung speichern')),'End of long literal must be audited');
  assert.ok(found.every(s=>s.length<=384),'No multi-megabyte temporary literals');
});

test('i18n literal scan keeps ordinary quoted strings, escaped quotes and HTML text',()=>{
  const found=texts("innerHTML='<button>Sendung speichern</button>';const label=\"Empfänger\";alert('Zur\\'ück')");
  assert.ok(found.some(s=>s.includes('Sendung speichern')));
  assert.ok(found.some(s=>s.includes('Empfänger')));
  assert.ok(found.some(s=>s.includes('Zur')&&s.includes('ück')));
});

test('i18n audit excludes generated distribution folders',()=>{
  const walk=source.slice(source.indexOf('function walk('),source.indexOf('function compact('));
  assert.ok(walk.includes('/^dist'));
  assert.ok(walk.includes('playwright-report'));
});

test('i18n HTML text scan is linear for many malformed brackets',()=>{
  const input=('>A'.repeat(100_000))+'><button>Sendung speichern</button>';
  const values=texts(input);
  assert.ok(values.some(v=>v.includes('Sendung speichern')));
  assert.ok(values.every(v=>v.length<=384));
});
