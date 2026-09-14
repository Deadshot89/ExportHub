import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync('api/customer-avis/index.js','utf8');
const page=fs.readFileSync('customer-avis.html','utf8');
const fixer=fs.readFileSync('.github/rc1018/fix-mail-wording.mjs','utf8');

test('RC1089: Lieferavis bleibt bis einschließlich drei Kalendertage nach Abholung erreichbar',()=>{
  assert.match(api,/function avisExpiresOn\(sh\)[^{]*\{[^}]*addCalendarDays\(picked,3\)/);
  assert.match(api,/function avisExpired\(sh\)[^{]*\{[^}]*today>until/);
  assert.match(api,/function assertAvisWindow\(sh\)/);
  assert.match(api,/action==='authorize'[\s\S]{0,1200}assertAvisWindow\(sh\)/);
  assert.match(api,/resolveSession\(session,'avis'\)[\s\S]{0,900}assertAvisWindow\(sh\)/);
  assert.match(fixer,/addCalendarDays\(picked,3\)/);
  assert.match(fixer,/berlinDateKey\(new Date\(\)\)>until/);
  assert.match(fixer,/drei Kalendertage nach der tatsächlichen Abholung/);
});

test('RC1089: Sendungsdokumente bleiben nach Abholung im schreibgeschützten Avis downloadbar',()=>{
  for(const marker of ["['deliveryFiles','Lieferschein']","['abdFiles','ABD']","['podFiles','POD']","['generatedDocuments','Dokument']"]){
    assert.ok(api.includes(marker),'Dokumentquelle fehlt: '+marker);
  }
  assert.match(api,/function blobNameOf\(/);
  assert.match(api,/async function readDocumentBlob\(/);
  assert.match(api,/if\(doc\.blobName\)\{const stored=await readDocumentBlob\(doc\.blobName,sessionInfo\.environment\)/);
  const actual=api.match(/if\(actual\)return\{([^;]+)\};/);
  assert.ok(actual,'Abgeholt-Payload fehlt');
  assert.match(actual[1],/documents:docs/);
  assert.match(actual[1],/pod:\{[^}]*documents:podDocs/);
});

test('RC1089: öffentliche Avis-Seite erklärt Downloads und Abliefernachweis eindeutig',()=>{
  assert.match(page,/Bleibt 3 Tage nach Abholung verfügbar/);
  assert.match(page,/Abliefernachweis herunterladen/);
  assert.match(page,/auch nach der Abholung weiterhin heruntergeladen werden/);
  assert.match(page,/Verfügbar bis einschließlich:/);
  assert.doesNotMatch(page,/3 Arbeitstage|Wochenende wird nicht mitgerechnet|POD herunterladen/);
});
