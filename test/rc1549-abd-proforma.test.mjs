import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const parser=require('../api/shared/abd-analysis.js');
const model=require('../api/shared/abd-analysis-model.js');
const exporter=require('../api/shared/abd-analysis-export.js');
const {extractPdfText}=require('../api/shared/customer-avis-document-content.js');
const runtime=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');
const proformaUi=fs.readFileSync('assets/rc1549-abd-proforma.js','utf8');
const releaseBuilder=fs.readFileSync('.github/rc1521/build-three-env.mjs','utf8');

test('RC1549: Excel/manuelle Positionen erkennen Volumen und Einzelpreis',()=>{
 const matrix=parser.parseDelimited('Artikelnummer;Warenbeschreibung;Menge;Einzelpreis;Warenwert;Währung;Nettogewicht;Bruttogewicht;Volumen m3;HS Code;Herkunftsland\nA-10;Kunststoffteil;100;2,459;245,90;EUR;12,5;13,1;0,045;39269097;DE');
 const rows=parser.matrixToObjects(matrix,'proforma.csv');
 const out=parser.analyzeObjects(rows).positions[0];
 assert.equal(out.itemNumber,'A-10');
 assert.equal(out.unitPrice,2.459);
 assert.equal(out.value,245.9);
 assert.equal(out.netMassKg,12.5);
 assert.equal(out.grossMassKg,13.1);
 assert.equal(out.volumeM3,0.045);
 assert.equal(out.commodityCode,'39269097');
 assert.equal(out.originCountry,'DE');
});

test('RC1549: HS/Ursprung-Gruppen summieren Warenwert, Gewicht und Volumen',()=>{
 const positions=[
  parser.normalizePosition({position:'1',description:'Teil A',commodityCode:'39269097',originCountry:'DE',quantity:10,netMassKg:4,grossMassKg:5,volumeM3:0.02,value:100,currency:'EUR'},0),
  parser.normalizePosition({position:'2',description:'Teil B',commodityCode:'39269097',originCountry:'DE',quantity:5,netMassKg:6,grossMassKg:7,volumeM3:0.03,value:150,currency:'EUR'},1)
 ];
 const out=model.rebuildReviewedAnalysis({header:{invoiceTotal:250,currency:'EUR'},positions});
 assert.equal(out.groups.length,1);
 assert.equal(out.groups[0].value,250);
 assert.equal(out.groups[0].netMassKg,10);
 assert.equal(out.groups[0].grossMassKg,12);
 assert.equal(out.groups[0].volumeM3,0.05);
 assert.equal(out.totals.netMassKg,10);
 assert.equal(out.totals.grossMassKg,12);
 assert.equal(out.totals.volumeM3,0.05);
});

test('RC1549: Proforma-PDF enthält Essentra Branding, Positionen und Zollzusammenfassung',async()=>{
 const positions=[parser.normalizePosition({position:'1',itemNumber:'A-10',description:'Kunststoffteil',commodityCode:'39269097',originCountry:'DE',quantity:100,unitPrice:2.459,netMassKg:12.5,grossMassKg:13.1,volumeM3:0.045,value:245.9,currency:'EUR'},0)];
 const snapshot=model.rebuildReviewedAnalysis({header:{invoiceNumber:'PF-1001',invoiceDate:'16.10.2026',customer:'Essentra Components GmbH',recipient:'Example Customer GmbH, Musterstrasse 1, DE-12345 Berlin',destinationCountry:'DE',invoiceTotal:245.9,currency:'EUR'},positions});
 const bytes=await exporter.createProformaPdf(snapshot);
 assert.ok(Buffer.isBuffer(bytes));
 const text=(await extractPdfText(bytes)).replace(/\s+/g,' ');
 assert.match(text,/essentra/i);
 assert.match(text,/PROFORMA INVOICE/i);
 assert.match(text,/PF-1001/);
 assert.match(text,/Example Customer GmbH/);
 assert.match(text,/Kunststoffteil/);
 assert.match(text,/39269097/);
 assert.match(text,/0\.045/);
 assert.match(text,/245\.90/);
});

test('RC1549: ABD UI bietet Upload, manuelle Positionen und Proforma an',()=>{
 assert.match(runtime,/accept="[^"]*\.pdf[^"]*\.xlsx[^"]*\.csv/);
 assert.match(proformaUi,/data-rc1549-manual-add/);
 assert.match(proformaUi,/data-rc1549-manual-list/);
 assert.match(proformaUi,/data-rc1549-manual-create/);
 assert.match(proformaUi,/data-rc1549-proforma/);
 assert.match(proformaUi,/['"]proforma['"]/);
});

test('RC1549: produktiver Drei-Umgebungen-Build liefert die isolierte ABD-Proforma-Runtime aus',()=>{
 assert.match(releaseBuilder,/integrateAbdProforma.*rc1549\/integrate-abd-proforma\.mjs/s);
 assert.match(releaseBuilder,/integrateAbdProforma\(root,out\)/);
 assert.match(releaseBuilder,/ABD_PROFORMA_ASSETS/);
 assert.match(releaseBuilder,/ABD_PROFORMA_MARKERS/);
});
