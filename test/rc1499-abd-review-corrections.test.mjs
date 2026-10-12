import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const model=require('../api/shared/abd-analysis-model.js');
const apiSource=fs.readFileSync('api/abd-analysis/index.js','utf8');
const uiSource=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');

function row(overrides={}){
  return Object.assign({
    position:'1',itemNumber:'A1',description:'Teil',commodityCode:'39269097',originCountry:'DE',
    quantity:1,netMassKg:1,grossMassKg:1.1,value:100,currency:'EUR',missing:[],warnings:[],source:'invoice.pdf',sourceRow:1
  },overrides);
}

test('RC1499: corrected HS origin and value are rebuilt by shared server model',()=>{
  assert.equal(typeof model.rebuildReviewedAnalysis,'function','serverseitige Re-Analyse fehlt');
  const before=model.rebuildReviewedAnalysis({
    header:{invoiceNumber:'INV-77',invoiceTotal:150,currency:'EUR'},
    positions:[row(),row({position:'2',commodityCode:'',originCountry:'',value:50,missing:['commodityCode','originCountry']})]
  });
  assert.equal(before.groups.length,1);
  assert.equal(before.unassigned.length,1);
  assert.equal(before.totals.accountedTotal,150);
  assert.equal(before.review.complete,false);

  const after=model.rebuildReviewedAnalysis({
    header:{invoiceNumber:'INV-77',invoiceTotal:150,currency:'EUR'},
    positions:[row(),row({position:'2',commodityCode:'83024900',originCountry:'PL',value:50,missing:[]})]
  });
  assert.equal(after.groups.length,2);
  assert.equal(after.unassigned.length,0);
  assert.equal(after.groups.find(g=>g.commodityCode==='83024900').originCountry,'PL');
  assert.equal(after.totals.groupedTotal,150);
  assert.equal(after.totals.difference,0);
  assert.equal(after.review.complete,true);
});

test('RC1499: OCR or suggested customs data stays review-required until explicit confirmation',()=>{
  assert.equal(typeof model.rebuildReviewedAnalysis,'function','serverseitige Re-Analyse fehlt');
  const suggested=row({confirmed:false,warnings:['ocr-review-required']});
  const pending=model.rebuildReviewedAnalysis({header:{invoiceTotal:100,currency:'EUR'},positions:[suggested]});
  assert.equal(pending.groups.length,0);
  assert.equal(pending.unassigned.length,1);
  assert.equal(pending.review.complete,false);

  const confirmed=model.rebuildReviewedAnalysis({header:{invoiceTotal:100,currency:'EUR'},positions:[Object.assign({},suggested,{confirmed:true})]});
  assert.equal(confirmed.groups.length,1);
  assert.equal(confirmed.unassigned.length,0);
  assert.equal(confirmed.totals.difference,0);
  assert.equal(confirmed.review.complete,true);
});

test('RC1499: reanalysis is an authenticated API action using the shared model',()=>{
  assert.match(apiSource,/action\s*===\s*['"]reanalyze['"]/,'API-Reanalyse-Aktion fehlt');
  assert.match(apiSource,/rebuildReviewedAnalysis/,'API muss die gemeinsame Rechenquelle verwenden');
  assert.doesNotMatch(apiSource,/groupPositionsByHsOrigin\s*\(/,'API-Handler darf keine zweite Gruppierungsimplementierung enthalten');
});

test('RC1499: review UI edits fields but delegates recalculation to API',()=>{
  assert.match(uiSource,/data-rc1499-edit-hs/,'HS-Korrekturfeld fehlt');
  assert.match(uiSource,/data-rc1499-edit-origin/,'Ursprungs-Korrekturfeld fehlt');
  assert.match(uiSource,/data-rc1499-edit-value/,'Warenwert-Korrekturfeld fehlt');
  assert.match(uiSource,/data-rc1499-confirm/,'explizite Bestätigung für Vorschlagsdaten fehlt');
  assert.match(uiSource,/action\s*:\s*['"]reanalyze['"]/,'UI muss Re-Analyse über die API auslösen');
  assert.doesNotMatch(uiSource,/groupPositionsByHsOrigin/,'Browser darf keine eigene Zoll-Gruppierungslogik enthalten');
});
