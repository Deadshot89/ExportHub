import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

test('Reklamationen: alle aktiven Fälle zählen, erledigte und entfernte nicht',()=>{
 const a=make(),b=make(),done=make();
 complaints.edit(done,{rootCause:'Ursache',correctiveAction:'Pflichtkontrolle',
  checkMethod:'Kontrolle',checkDate:'2026-11-10',checkCriteria:'0 Fehler',
  effectivenessEvidence:'Nachgewiesen'},'A');
 complaints.edit(done,{effectivenessResult:'wirksam'},'B');
 complaints.changeStatus(done,'abgeschlossen','B');
 assert.equal(complaints.openCount([
  {complaints:[a,b,done]},
  {complaints:[{text:'Historisch',state:'in_pruefung'}]},
  {deletedAt:'2026-11-11',complaints:[make()]}
 ]),3);
 assert.equal(complaints.openCount([{complaints:[done]}]),0);
 assert.equal(complaints.openCount([]),0);
});

test('Alle Dokumentationen: REF, Kunde, Versanddatum, Colli, Gewicht und Reklamationsstatus stehen in dieser Folge',()=>{
 const ui=fs.readFileSync('assets/shipment-evidence.js','utf8');
 const start=ui.indexOf('matches.forEach(r=>'),end=ui.indexOf("search.addEventListener('input'",start);
 assert.ok(start>=0&&end>start);
 const list=ui.slice(start,end);
 const markers=["t(fields.exporthubRef?'refShort':'documentationRefShort')",
  "t('customer')","t('dispatchDate')","t('colli')","t('weightKg')","t('complaintStatus')"];
 let before=-1;
 for(const marker of markers){
  const at=list.indexOf(marker);
  assert.ok(at>before,`Listing order missing or changed: ${marker}`);
  before=at;
 }
 assert.match(list,/'complaintCompleted'/);
 assert.match(list,/counts\[c\.state==='abgeschlossen'/);
 assert.match(list,/fields\.exporthubRef\|\|r\.id/);
});
test('Als erledigt nur nach bestätigter Wirksamkeitsprüfung und ohne ungespeicherte Änderungen',()=>{
 const ui=fs.readFileSync('assets/shipment-evidence.js','utf8');
 assert.match(ui,/markComplaintDone/);
 assert.match(ui,/c\.effectivenessResult!=='wirksam'\|\|!c\.verifiedBy\|\|!c\.verifiedOn/);
 assert.match(ui,/const dirty=fields\.some/);
 assert.match(ui,/state:'abgeschlossen'/);
 assert.match(ui,/c\.state==='abgeschlossen'\?\['abgeschlossen','in_pruefung'\]:\['offen','in_pruefung'\]/);
});

test('Altfall: Wirksamkeit ohne dokumentierten Prüfer verhindert Erledigt',()=>{
 const c=make();
 Object.assign(c,{
  rootCause:'Ursache belegt',correctiveAction:'Kontrollschritt',
  checkDate:'2026-11-10',checkMethod:'Stichprobe',checkCriteria:'Null Fehler',
  effectivenessEvidence:'10 unterschriebene Kontrollen',
  effectivenessResult:'wirksam',verifiedOn:'2026-11-10',verifiedBy:''
 });
 assert.throws(()=>complaints.changeStatus(c,'abgeschlossen','Mitarbeiter'),
  e=>e.code==='EFFECTIVENESS_REQUIRED');
 assert.equal(c.state,'offen','Unbestätigte Prüfung darf Reklamation nicht schließen');
 c.verifiedBy='QM-Prüfer';
 complaints.changeStatus(c,'abgeschlossen','Mitarbeiter');
 assert.equal(c.state,'abgeschlossen');
});
