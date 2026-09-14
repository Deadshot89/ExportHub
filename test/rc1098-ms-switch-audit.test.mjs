import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');
function compact(s){return String(s||'').replace(/\s+/g,' ').trim()}
function around(needle,span=5000){
  const i=html.indexOf(needle);
  return i<0?'':compact(html.slice(Math.max(0,i-span),Math.min(html.length,i+span)));
}

test('RC1098 Audit: Microsoft-Konto-wechseln Pfad lokalisieren',()=>{
  assert.match(html,/Microsoft-Konto wechseln/);
  const marker='data-exporthub-ms-switch';
  assert.match(html,new RegExp(marker));
  console.log('RC1098_MS_SWITCH_CONTEXT='+around(marker,7000));
  const names=[];
  for(const m of html.matchAll(/function\s+([A-Za-z0-9_$]*(?:microsoft|account|switch|logout)[A-Za-z0-9_$]*)\s*\(/gi)){
    if(!names.includes(m[1]))names.push(m[1]);
  }
  console.log('RC1098_MS_FUNCTIONS='+names.slice(0,100).join(','));
});
