import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const deterministic=require('../api/shared/customs-ai-deterministic.js');

function analysis(){return{
  groups:[
    {commodityCode:'39269097',originCountry:'DE',value:100,currency:'EUR',status:'complete',positionRefs:['10']},
    {commodityCode:'39269097',originCountry:'CN',value:150,currency:'EUR',status:'review',positionRefs:['20'],warnings:['manual-review']},
    {commodityCode:'73181595',originCountry:'DE',value:200,currency:'EUR',status:'complete',positionRefs:['30']}
  ],
  unassigned:[{position:'40',originCountry:'CN',value:50,currency:'EUR',missing:['commodityCode']}],
  totals:{invoiceTotal:500,accountedTotal:500,difference:0,currency:'EUR'},
  review:{complete:false,unassignedCount:1,missingHsCount:1,missingOriginCount:0,missingValueCount:0}
}}

test('RC1532 Direktantwort: HS-Codes kommen aus den Analysegruppen',()=>{
  const result=deterministic.answerDeterministicCustomsQuestion({question:'Welche HS-Codes sind in der Rechnung?',analysis:analysis()});
  assert.equal(result.matched,true);assert.equal(result.kind,'commodity-codes');
  assert.deepEqual(result.facts.codes,['39269097','73181595']);
  assert.match(result.answer,/39269097/);assert.match(result.answer,/73181595/);
});

test('RC1532 Direktantwort: Warenwert nach HS-Code und Ursprung wird nicht vom Modell gerechnet',()=>{
  const result=deterministic.answerDeterministicCustomsQuestion({question:'Wie hoch ist der Warenwert für HS 39269097 aus CN?',analysis:analysis()});
  assert.equal(result.matched,true);assert.equal(result.kind,'group-value');
  assert.equal(result.facts.value,150);assert.equal(result.facts.currency,'EUR');
  assert.match(result.answer,/150,00/);
});

test('RC1532 Direktantwort: Warenwert eines Ursprungs summiert geprüfte Analysedaten',()=>{
  const result=deterministic.answerDeterministicCustomsQuestion({question:'Wie hoch ist der Warenwert mit Ursprung DE?',analysis:analysis()});
  assert.equal(result.matched,true);assert.equal(result.kind,'origin-value');
  assert.equal(result.facts.value,300);assert.equal(result.facts.currency,'EUR');
});

test('RC1532 Direktantwort: ungeklärte Positionen und Prüffälle bleiben sichtbar',()=>{
  const unresolved=deterministic.answerDeterministicCustomsQuestion({question:'Welche Positionen sind noch ungeklärt?',analysis:analysis()});
  assert.equal(unresolved.matched,true);assert.equal(unresolved.kind,'unassigned');
  assert.deepEqual(unresolved.facts.positions,['40']);
  const review=deterministic.answerDeterministicCustomsQuestion({question:'Welche HS/Ursprung-Gruppen müssen geprüft werden?',analysis:analysis()});
  assert.equal(review.matched,true);assert.equal(review.kind,'review-groups');
  assert.equal(review.facts.groups.length,1);assert.equal(review.facts.groups[0].commodityCode,'39269097');assert.equal(review.facts.groups[0].originCountry,'CN');
});

test('RC1532 Direktantwort: Kontrollsumme nutzt vorhandene totals und nennt unvollständigen Prüfstatus',()=>{
  const result=deterministic.answerDeterministicCustomsQuestion({question:'Stimmt die Kontrollsumme mit der Rechnungssumme?',analysis:analysis()});
  assert.equal(result.matched,true);assert.equal(result.kind,'reconciliation');
  assert.equal(result.facts.matches,true);assert.equal(result.facts.complete,false);
  assert.match(result.answer,/500,00/);assert.match(result.answer,/noch nicht vollständig/i);
});

test('RC1532 Direktantwort: unbekannte Fachfrage fällt kontrolliert an Quellen-KI zurück',()=>{
  const result=deterministic.answerDeterministicCustomsQuestion({question:'Welche Präferenzregel gilt für die Schweiz?',analysis:analysis()});
  assert.deepEqual(result,{matched:false});
});

test('RC1532 Direktantwort: Mischwährung liefert Warnung statt falscher Summe',()=>{
  const mixed=analysis();mixed.groups[2].currency='USD';
  const result=deterministic.answerDeterministicCustomsQuestion({question:'Wie hoch ist der Warenwert mit Ursprung DE?',analysis:mixed});
  assert.equal(result.matched,true);assert.equal(result.kind,'origin-value');
  assert.equal(result.uncertainty,true);assert.equal(Object.prototype.hasOwnProperty.call(result.facts,'value'),false);
  assert.match(result.answer,/Währungen/i);
});
