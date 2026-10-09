import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('api/shared/pod-archive.js','utf8');
const start=source.indexOf('async function createPodPdf(');
const end=source.indexOf('async function readAutomaticPodBuffer(',start);
assert.ok(start>=0&&end>start,'POD PDF function missing');
const block=source.slice(start,end);

test('P0 POD: structured single-page customer layout replaces sparse legacy footer',()=>{
  assert.match(block,/LADELISTE \/ ABLIEFERNACHWEIS/);
  assert.match(block,/Sendungsreferenz/);
  assert.match(block,/Absender/);
  assert.match(block,/Empfaenger \/ Kunde/);
  assert.match(block,/Transport \/ Anmeldung/);
  assert.match(block,/Lieferadresse/);
  assert.match(block,/Colli gesamt/);
  assert.match(block,/Colli abgeholt/);
  assert.match(block,/SENDUNG ABGEHOLT/);
});

test('P0 POD: table header has complete rectangle geometry',()=>{
  assert.match(block,/page\.drawRectangle\(\{x,y:y-25,width,height:25/);
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
  assert.match(source,/function existingCurrent\(file, opt\)[\s\S]*?isCurrentAutomaticPod\(file\)[\s\S]*?!opt\.force/,'Current-layout reuse helper must reject stale or forced files');
  assert.match(source,/if\s*\(existingCurrent\(file, opt\)\)/,'ensureAutomaticPod may only reuse files accepted by the current-layout predicate');
  assert.match(source,/if\s*\(file\s*&&\s*!isCurrentAutomaticPod\(file\)\s*&&\s*String\(file\.kind\s*\|\|\s*['"]['"]\)\.toLowerCase\(\)\s*===\s*['"]automatic-pod['"]\)/,'Download path must detect a stale automatic POD before serving it');
  assert.match(source,/ensureAutomaticPod\(accessKey, environment, \{ force: true \}\)/,'Stale automatic PODs must be force-regenerated');
});
