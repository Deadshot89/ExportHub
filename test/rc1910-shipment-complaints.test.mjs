import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const complaints=require('../api/shipment-evidence/complaints.js');
const make=()=>complaints.created({text:'Karton kam beschaedigt an',reportedDate:'2026-11-10',category:'schaden'},'Mitarbeiter');

test('Reklamation: eindeutige ID, Kategorie, Datum und Status',()=>{
 const a=make(),b=make();
 assert.notEqual(a.id,b.id);assert.equal(a.category,'schaden');assert.equal(a.state,'offen');
 assert.equal(a.effectivenessResult,'offen');
 assert.throws(()=>complaints.created({text:'Test',reportedDate:'2026-02-30'},'u'),e=>e.code==='BAD_DATE');
 assert.throws(()=>complaints.created({text:'Test',category:'invalid'},'u'),e=>e.code==='BAD_CATEGORY');
 assert.throws(()=>complaints.created({text:''},'u'),e=>e.code==='BAD_COMPLAINT');
});
test('Reklamation: Abschluss ohne Wirksamkeitsnachweis ist gesperrt',()=>{
 const c=make();
 assert.throws(()=>complaints.changeStatus(c,'abgeschlossen','A'),e=>e.code==='EFFECTIVENESS_REQUIRED');
 complaints.edit(c,{rootCause:'Scan ausgelassen',correctiveAction:'Scan verpflichtend'},'A');
 assert.throws(()=>complaints.changeStatus(c,'abgeschlossen','A'),e=>e.code==='EFFECTIVENESS_REQUIRED');
});
test('Reklamation: Maßnahmen und Wirksamkeit müssen getrennt bestätigt werden',()=>{
 const c=make();
 assert.throws(()=>complaints.edit(c,{rootCause:'Falsch geladen',effectivenessResult:'wirksam'},'A'),
  e=>e.code==='RECHECK_REQUIRED');
 complaints.edit(c,{rootCause:'Falsch geladen',correctiveAction:'Kontrollscan',checkDate:'2026-11-10',
  checkMethod:'10 aktuelle Sendungen kontrollieren',checkCriteria:'Keine Vertauschung',
  effectivenessEvidence:'10 Protokolle geprüft'},'A');
 complaints.edit(c,{effectivenessResult:'wirksam'},'B');
 assert.equal(c.effectivenessResult,'wirksam');assert.equal(c.verifiedBy,'B');
 complaints.changeStatus(c,'abgeschlossen','B');
 assert.equal(c.state,'abgeschlossen');
 assert.throws(()=>complaints.edit(c,{rootCause:'Andere Ursache'},'A'),e=>e.code==='COMPLAINT_CLOSED');
});
test('Reklamation: Unwirksam bedeutet erneute Prüfung, neue Ursache widerruft alte Prüfung',()=>{
 const c=make();
 complaints.edit(c,{rootCause:'A',correctiveAction:'B',checkMethod:'Kontrolle',checkCriteria:'0 Fehler',
  checkDate:'2026-11-10',effectivenessEvidence:'Nachweis'},'A');
 complaints.edit(c,{effectivenessResult:'wirksam'},'A');
 complaints.edit(c,{rootCause:'Neue Ursache'},'A');
 assert.equal(c.effectivenessResult,'offen');assert.equal(c.effectivenessEvidence,'');
 assert.equal(c.verifiedBy,'');
 complaints.edit(c,{effectivenessResult:'unwirksam'},'A');
 assert.equal(c.state,'in_pruefung');
 assert.throws(()=>complaints.changeStatus(c,'abgeschlossen','A'),e=>e.code==='EFFECTIVENESS_REQUIRED');
});
test('Reklamation: KI-freier Vorschlag erstellt keine Speditionsnachricht ohne Spedition',()=>{
 const c=make();
 const noCarrier=complaints.proposal(c,{customer:'Beispiel'});
 assert.equal(noCarrier.carrierDraft,'');
 assert.match(noCarrier.disclaimer,/ohne KI/);
 const withCarrier=complaints.proposal(c,{carrier:'Transport'});
 assert.match(withCarrier.carrierDraft,/Transportablauf/);
 assert.doesNotMatch(withCarrier.customerDraft,/Haftung|Schuld/i);
});


test('Reklamation: geändertes Prüfkriterium oder neue Belege widerrufen alte Freigabe',()=>{
 for(const patch of [
  {checkCriteria:'Neue Null-Fehler-Bedingung'},
  {checkMethod:'Andere Stichprobe'},
  {checkSample:'Prüfzeitraum jetzt 30 Tage'},
  {effectivenessEvidence:'Zusätzlicher anderer Nachweis'}
 ]){
  const c=make();
  complaints.edit(c,{rootCause:'Ursache',correctiveAction:'Abstellmaßnahme',checkDate:'2026-11-10',
   checkMethod:'10 Sendungen kontrolliert',checkSample:'10 Sendungen',checkCriteria:'Null Fehler',
   effectivenessEvidence:'10 geprüfte Vorgänge'},'A');
  complaints.edit(c,{effectivenessResult:'wirksam'},'B');
  complaints.edit(c,{...patch,effectivenessResult:'wirksam'},'C');
  assert.equal(c.effectivenessResult,'offen',JSON.stringify(patch));
  assert.equal(c.verifiedBy,'',JSON.stringify(patch));
  assert.throws(()=>complaints.changeStatus(c,'abgeschlossen','C'),e=>e.code==='EFFECTIVENESS_REQUIRED');
 }
});
test('Reklamation: Neu erfasster Nachweis darf bei erster Maßnahmenerfassung nicht verloren gehen',()=>{
 const c=make();
 complaints.edit(c,{rootCause:'Fehlkontrolle',correctiveAction:'Pflichtscan',
  effectivenessEvidence:'Zehn archivierte Kontrollen'},'A');
 assert.equal(c.effectivenessEvidence,'Zehn archivierte Kontrollen');
 assert.equal(c.effectivenessResult,'offen');
});
