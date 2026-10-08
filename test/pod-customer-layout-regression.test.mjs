import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../api/shared/pod-archive.js',import.meta.url),'utf8');
const start=source.indexOf('async function createPodPdf(');
const end=source.indexOf('async function readAutomaticPodBuffer(',start);
const block=source.slice(start,end);

test('P0 POD: structured loading-list layout is used in downloaded archive PDF',()=>{
  assert.ok(start>=0&&end>start,'POD PDF renderer missing');
  for(const label of ['LADELISTE / ABLIEFERNACHWEIS','Sendungsreferenz','Absender','Empfaenger / Kunde','Transport / Anmeldung','VERPACKUNG','SENDUNG ABGEHOLT','Fahrer','Kennzeichen','Verlader','Spedition','Fahrerunterschrift','Europaletten']){
    assert.ok(block.includes(label),'Missing POD field: '+label);
  }
  assert.match(block,/pdf\.addPage\(\[595\.28, 841\.89\]\)/,'POD must use A4');
  assert.match(block,/Math\.min\(maxW\/dims\.width,maxH\/dims\.height\)/,'Signature must fit within its cell');
  assert.match(block,/page\.drawImage\(image,/,'Signature must be rendered inside POD');
  assert.doesNotMatch(block,/function newPage\(/,'POD should not silently paginate its signature section');
});

test('P0 POD: table header has complete rectangle geometry',()=>{
  assert.match(block,/page\.drawRectangle\(\{x,y:y-25,width,height:25,color:pale,borderColor:border,borderWidth:\.7\}\)/,'Table header must define its height or pdf-lib rendering can fail');
});

test('P0 POD: signature and customer fields are drawn as separate bordered cells',()=>{
  assert.match(block,/function card\(label, content, cx, top, w, h=57\)/);
  assert.match(block,/card\('Fahrerunterschrift','',x\+cellW\+6,y,cellW,76\)/);
  assert.match(block,/card\('Europaletten'/);
  assert.match(block,/card\('Kennzeichen'/);
  assert.match(block,/card\('Verlader'/);
});

test('P0 POD: stale automatic PODs are versioned and regenerated before reuse or download',()=>{
  assert.match(source,/const POD_PDF_LAYOUT_VERSION\s*=\s*['"][^'"]+['"]/,'Automatic PODs need an immutable layout version');
  assert.match(source,/function isCurrentAutomaticPod\(file\)/,'A current-layout predicate is required');
  assert.match(source,/layoutVersion:\s*POD_PDF_LAYOUT_VERSION/,'Saved POD descriptor must persist layoutVersion');
  assert.match(source,/layoutversion:\s*POD_PDF_LAYOUT_VERSION/,'Azure blob metadata must persist the layout version');
  assert.match(source,/existing\s*&&\s*isCurrentAutomaticPod\(existing\)\s*&&\s*!opt\.force/,'ensureAutomaticPod may only reuse current-layout files');
  assert.match(source,/if\s*\(file\s*&&\s*!isCurrentAutomaticPod\(file\)\s*&&\s*String\(file\.kind\s*\|\|\s*['"]['"]\)\.toLowerCase\(\)\s*===\s*['"]automatic-pod['"]\)/,'Download path must detect a stale automatic POD before serving it');
  assert.match(source,/ensureAutomaticPod\(accessKey, environment, \{ force: true \}\)/,'Stale automatic PODs must be force-regenerated');
});
