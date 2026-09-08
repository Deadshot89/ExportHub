import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
await import('../assets/sop/rc1007-sop-catalog.js');
const catalog=globalThis.ExportHubIsoSopCatalog;

test('RC1008 enthält ausschließlich 75 ExportHUB-System-SOPs',()=>{
  assert.equal(catalog.version,'RC1008');
  assert.equal(catalog.systemOnly,true);
  assert.equal(catalog.documents.length,75);
  assert.equal(new Set(catalog.documents.map(d=>d.number)).size,75);
  for(const doc of catalog.documents){
    assert.match(doc.number,/^SOP-EH-\d{3}$/);
    assert.match(doc.sections.purpose,/ExportHUB/);
    assert.ok(doc.sections.steps.length>=4,`${doc.number}: Ablauf zu kurz`);
    assert.ok(doc.processFlow.length>=3,`${doc.number}: Prozessgrafik zu kurz`);
  }
  const text=JSON.stringify(catalog.documents);
  assert.doesNotMatch(text,/SOP-(QM|SYS|LOG|WH|ORG)-\d{3}/);
});

test('externe Programme sind nur als SOP-EXT-Verweise vorhanden',()=>{
  const refs=new Set(catalog.documents.flatMap(d=>d.references||[]));
  for(const ref of refs){
    assert.match(ref,/^SOP-(EH|EXT)-\d{3}$/);
    if(ref.startsWith('SOP-EXT-')) assert.ok(catalog.externalReferences[ref],`Beschreibung für ${ref} fehlt`);
  }
  assert.equal(catalog.documents.some(d=>d.number.startsWith('SOP-EXT-')),false);
  assert.match(JSON.stringify(catalog.documents),/Weitere Durchführung siehe SOP-EXT-/);
});

test('jede SOP besitzt ein selbst erzeugtes ExportHUB-Systembild statt Bildplatzhalter',()=>{
  for(const doc of catalog.documents){
    const visuals=doc.visuals||[];
    assert.ok(visuals.some(v=>v.type==='process'),`${doc.number}: Prozessgrafik fehlt`);
    const images=visuals.filter(v=>v.type==='screenshot');
    assert.ok(images.length>=1,`${doc.number}: Systembild fehlt`);
    for(const image of images){
      assert.match(String(image.src||''),/^data:image\/svg\+xml/);
      assert.match(String(image.caption||''),/ExportHUB-Systembild/);
      assert.doesNotMatch(String(image.src||''),/Fremdsoftware|example\.com/i);
    }
    assert.equal(visuals.some(v=>v.type==='placeholder'),false,`${doc.number}: Bildplatzhalter darf nicht mehr vorhanden sein`);
  }
});

test('Systembereiche decken die bekannten ExportHUB-Funktionscluster ab',()=>{
  const required=['System-Grundlagen','Benutzer, Firmen und Rechte','Kunden und Standorte','Sendungen','Versandkosten und Transport','Dokumente und Ausgabe','ABD und Mail','QR, POD und Kunden-Avis','Palettenkonto','Aufgaben, Planer und Abholkalender','SOP und Academy','Archiv, Diagnose, Release und App'];
  assert.deepEqual(catalog.areas,required);
});

test('RC1008 ist der aktuelle gemeinsame Versionsmarker',()=>{
  assert.match(fs.readFileSync('production-version.js','utf8'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1008'/);
  assert.ok(fs.existsSync('.github/rc1008/build-three-env.mjs'));
});
