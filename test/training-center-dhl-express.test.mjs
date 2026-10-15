import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const path='assets/training-center/catalog/dhl-express.js';

function load(){
  assert.ok(fs.existsSync(path),'DHL-Express-SOP fehlt');
  const context={};
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path,'utf8'),context,{filename:path});
  assert.ok(context.ExportHubDhlExpressSop,'ExportHubDhlExpressSop fehlt');
  return context.ExportHubDhlExpressSop;
}

test('DHL Express ist als erste reale SOP freigegeben',()=>{
  const sop=load();
  assert.equal(sop.id,'dhl-express-registration');
  assert.equal(sop.title,'DHL Express – Sendung anmelden');
  assert.equal(sop.categoryId,'shipping');
  assert.equal(sop.catalogOrder,1);
  assert.equal(sop.status,'released');
  assert.equal(sop.sourceDocument,'DHL Anmeldung.docx');
  assert.ok(sop.steps.length>=20,'DHL-SOP muss den vollständigen Ablauf enthalten');
});

test('DHL-Quellregeln aus der bereitgestellten SOP sind vollständig abgebildet',()=>{
  const sop=load();
  const all=JSON.stringify(sop);
  for(const required of [
    'Manifest','Lieferscheine','Rechnungen','Warenwert','ABD','1000','ExportHUB',
    'mydhl.express.dhl','Warensendung','Commercial','Herkunftsland','HS-Code',
    'Lieferscheinnummer','MRN','Zollrechnung','Rechnungsnummer','EX WORKS',
    'End of Day','Abholung','Serbien','Label'
  ]) assert.ok(all.toLowerCase().includes(required.toLowerCase()),`DHL-Regel fehlt: ${required}`);
});

test('Artikelzusammenfassung ist nur bei gleichem Herkunftsland und HS-Code erlaubt',()=>{
  const sop=load();
  const step=sop.steps.find(x=>x.stepId==='dhl-items');
  assert.ok(step,'Artikelschritt fehlt');
  assert.match(step.explanation,/Herkunftsland/);
  assert.match(step.explanation,/HS-Code/);
  assert.match(step.explanation,/nur|wenn/i);
});

test('ABD-Regel, MRN und Zollrechnung bleiben getrennte Prüfschritte',()=>{
  const sop=load();
  const ids=sop.steps.map(x=>x.stepId);
  assert.ok(ids.includes('dhl-abd-check'));
  assert.ok(ids.includes('dhl-mrn'));
  assert.ok(ids.includes('dhl-customs-invoice'));
  const abd=sop.steps.find(x=>x.stepId==='dhl-abd-check');
  assert.ok(JSON.stringify(abd).includes('1.000')||JSON.stringify(abd).includes('1000'));
});

test('DHL-Abschluss bildet digitale Dokumente, Serbien-Ausnahme und Label-only-Druck ab',()=>{
  const sop=load();
  const digital=sop.steps.find(x=>x.stepId==='dhl-send-documents');
  const print=sop.steps.find(x=>x.stepId==='dhl-print-label');
  assert.ok(digital && print);
  assert.match(JSON.stringify(digital),/Serbien/);
  assert.match(JSON.stringify(print),/nur.*Label|Label.*nur/i);
  assert.doesNotMatch(JSON.stringify(print),/Beleg.*drucken/i);
});

test('alle neun Dokumentseiten sind als Bild-/Quellreferenz abgedeckt',()=>{
  const sop=load();
  const pages=new Set(sop.steps.flatMap(step=>step.sourceEvidence?.pages||[]));
  assert.deepEqual([...pages].sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9]);
  for(const step of sop.steps){
    assert.ok(step.sourceEvidence?.document==='DHL Anmeldung.docx');
    assert.ok(step.sourceEvidence.pages.length>=1);
  }
});
