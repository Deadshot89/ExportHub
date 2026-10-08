import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../api/shared/pod-archive.js',import.meta.url),'utf8');
const start=source.indexOf('async function createPodPdf(');
const end=source.indexOf('async function readAutomaticPodBuffer(',start);
const block=source.slice(start,end);

test('P0 POD: structured loading-list layout is used in downloaded archive PDF',()=>{
  assert.ok(start>=0&&end>start,'POD PDF renderer missing');
  for(const label of ['LADELISTE / ABLIEFERNACHWEIS','Sendungsreferenz','Absender','Empfaenger / Kunde','Transport / Anmeldung','Packstueck','SENDUNG ABGEHOLT','Fahrer','Kennzeichen','Verlader','Spedition','Fahrerunterschrift','Europaletten']){
    assert.ok(block.includes(label),'Missing POD field: '+label);
  }
  assert.match(block,/pdf\.addPage\(\[595\.28, 841\.89\]\)/,'POD must use A4');
  assert.match(block,/Math\.min\(maxW\/dims\.width,maxH\/dims\.height\)/,'Signature must fit within its cell');
  assert.match(block,/page\.drawImage\(image,/,'Signature must be rendered inside POD');
  assert.doesNotMatch(block,/function newPage\(/,'POD should not silently paginate its signature section');
});

test('P0 POD: signature and customer fields are drawn as separate bordered cells',()=>{
  assert.match(block,/function card\(label, content, cx, top, w, h=57\)/);
  assert.match(block,/card\('Fahrerunterschrift','',x\+cellW\+6,y,cellW,76\)/);
  assert.match(block,/card\('Europaletten'/);
  assert.match(block,/card\('Kennzeichen'/);
  assert.match(block,/card\('Verlader'/);
});
