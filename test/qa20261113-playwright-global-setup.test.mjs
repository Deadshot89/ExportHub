import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

// QA-Bericht 13.11.2026 F02: globalSetup war doppelt deklariert. In einem
// Objektliteral gewinnt nur der letzte Schlüssel, der RC1514-Guard lief nie.
const config=fs.readFileSync('playwright.config.mjs','utf8');
const code=config.split('\n').filter(line=>!line.trim().startsWith('//')).join('\n');

test('QA F02: playwright.config.mjs deklariert globalSetup genau einmal',()=>{
  const keys=code.match(/^\s*globalSetup\s*:/gm)||[];
  assert.equal(keys.length,1,'globalSetup darf nur einmal vorkommen, sonst wird ein Guard stillschweigend überschrieben');
});

test('QA F02: beide Live-Readiness-Guards laufen, RC1514 vor RC1506/RC1541',()=>{
  const match=code.match(/globalSetup\s*:\s*\[([^\]]*)\]/);
  assert.ok(match,'globalSetup muss als Liste beide Setup-Dateien enthalten');
  const entries=[...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(m=>m[1]);
  assert.deepEqual(entries,['./e2e/global-setup.mjs','./e2e/helpers/testservice-readiness.mjs']);
  for(const entry of entries)assert.ok(fs.existsSync(entry),entry+' fehlt');
});

test('QA F02: keine weiteren doppelten Top-Level-Schlüssel in der Playwright-Konfiguration',()=>{
  const body=code.slice(code.indexOf('defineConfig({')+'defineConfig({'.length);
  let depth=0;const keys=[];
  for(const line of body.split('\n')){
    if(depth===0){const m=line.match(/^\s*([A-Za-z_$][\w$]*)\s*:/);if(m)keys.push(m[1]);}
    for(const ch of line){if('{['.includes(ch))depth++;else if('}]'.includes(ch))depth--;}
    if(depth<0)break;
  }
  const dupes=keys.filter((k,i)=>keys.indexOf(k)!==i);
  assert.deepEqual(dupes,[],'doppelte Schlüssel: '+dupes.join(', '));
  assert.ok(keys.includes('projects')&&keys.includes('webServer'),'Parser hat die Konfiguration nicht vollständig gelesen');
});
