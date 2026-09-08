import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html','utf8');
const needle = "{name:'E3',ldm:0.06,l:43,w:31,h:31}";

test('Diagnose: aktive E3-Übernahmelogik lokalisieren', () => {
  const e3 = html.lastIndexOf(needle);
  assert.ok(e3 >= 0, 'Aktive E3-Definition wurde nicht gefunden');
  const start = Math.max(0, e3 - 1800);
  const end = Math.min(html.length, e3 + 30000);
  const block = html.slice(start, end);
  console.log(`ACTIVE_E3_INDEX=${e3}`);
  console.log('ACTIVE_E3_PREFIX=' + block.slice(0, 2600).replace(/\s+/g,' '));

  const functions = [...block.matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)\{/g)]
    .map(m => `${m[1]}(${m[2]})`);
  console.log('FUNCTIONS_AFTER_E3=' + functions.slice(0, 80).join(' | '));

  const terms = ['PACKS','pack','type','ldm','data-rc363-field','onchange'];
  for (const term of terms) {
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig');
    let count = 0;
    for (const m of block.matchAll(re)) {
      if (count++ >= 12) break;
      const a = Math.max(0,m.index-220), b = Math.min(block.length,m.index+650);
      console.log(`${term.toUpperCase()}_${count}: ` + block.slice(a,b).replace(/\s+/g,' '));
    }
  }
});
