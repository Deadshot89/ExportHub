import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
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

test('Historische REF-Dokumentationen erscheinen ohne Dateikopie in Alle Dokumentationen',()=>{
 const ui=fs.readFileSync('assets/shipment-evidence.js','utf8');
 const legacy=fs.readFileSync('api/shipment-documentation/index.js','utf8');
 assert.match(ui,/legacyRequest\(\{action:'list'/);
 assert.match(ui,/\.\.\.state\.records,\.\.\.state\.legacyRecords/);
 assert.match(ui,/r\.source==='ref'/);
 assert.match(ui,/ExportHUBShipmentView\.open\(r\.reference,'documentation'\)/);
 assert.match(ui,/legacyUnavailable/);
 assert.match(ui,/legacyRequestToken/);
 assert.match(legacy,/async function listForEnvironment\(env,allowedRefs,query\)/);
 assert.match(legacy,/knownRefs\(team\)/);
 const start=legacy.indexOf('async function listForEnvironment(');
 const end=legacy.indexOf('async function handle(req)',start);
 assert.ok(start>=0&&end>start);
 const exposed=legacy.slice(start,end);
 assert.doesNotMatch(exposed,/text:c\.text|description:|evidence:|id:c\.id/);
});

test('Defekter Reklamationsbestand wird nicht als null offene Fälle ausgegeben',()=>{
 assert.throws(()=>complaints.openCount([{id:'DOK-broken',revision:1}]),
  e=>e.code==='CORRUPT_COMPLAINTS'&&e.status===503);
 assert.throws(()=>complaints.openCount([{complaints:null}]),
  e=>e.code==='CORRUPT_COMPLAINTS');
 assert.equal(complaints.openCount([{complaints:[]},{deletedAt:'2026-11-11',complaints:null}]),0);
});

test('DOK- und REF-Seiten laden parallel ohne gegenseitige Ungültigmachung',async()=>{
 const ui=fs.readFileSync('assets/shipment-evidence.js','utf8');
 const begin=ui.indexOf('async function loadList(reset){');
 const end=ui.indexOf('async function scanAll(){',begin);
 assert.ok(begin>=0&&end>begin);
 let finishDok,finishRef;
 const state={view:'list',serial:7,records:[],continuation:'DOK-next',
  loading:false,listToken:0,legacyRecords:[],legacyContinuation:'REF-next',
  legacyLoading:false,legacyError:'',legacyRequestToken:0};
 let redraws=0;
 const ctx={
  state,request:()=>new Promise(resolve=>{finishDok=resolve}),
  legacyRequest:()=>new Promise(resolve=>{finishRef=resolve}),
  active:()=>true,showList:(keep)=>{assert.equal(keep,true);redraws++},
  status:()=>{},t:key=>key,Promise,Map,String
 };
 vm.createContext(ctx);
 vm.runInContext(ui.slice(begin,end),ctx);
 // The historical REF call begins first. Starting the DOK call must not
 // advance the shared view epoch and silently invalidate the REF response.
 const legacy=ctx.loadLegacyList(false);
 const dok=ctx.loadList(false);
 assert.equal(state.serial,7,'pagination cannot change the current view epoch');
 finishDok({records:[{id:'DOK-1',updatedAt:'2026-11-11'}],continuation:null});
 finishRef({records:[{id:'REF-ABC123',reference:'ABC123',updatedAt:'2026-11-10'}],continuation:null});
 const outcomes=await Promise.all([legacy,dok]);
 assert.deepEqual(outcomes,[true,true]);
 assert.equal(state.records.length,1,'DOK record retained');
 assert.equal(state.legacyRecords.length,1,'REF record retained');
 assert.equal(state.legacyError,'');
 assert.equal(redraws,2);
});

test('Fehlgeschlagene DOK-Abfrage bleibt sichtbar, auch wenn REF erfolgreich geladen wird',async()=>{
 const ui=fs.readFileSync('assets/shipment-evidence.js','utf8');
 assert.match(ui,/dokError\.textContent=state\.dokError/);
 assert.match(ui,/retryDok=button\(t\('retry'\),\(\)=>loadList\(false\)\)/);
 const begin=ui.indexOf('async function loadList(reset){'),end=ui.indexOf('async function scanAll(){',begin);
 assert.ok(begin>=0&&end>begin);
 const state={view:'list',serial:4,records:[],continuation:null,loading:false,listToken:0,
  dokError:'',legacyRecords:[],legacyContinuation:null,legacyLoading:false,legacyError:'',legacyRequestToken:0};
 let redrawn=0;
 const ctx={
  state,request:async()=>{throw Error('DOK-Archiv nicht erreichbar')},
  legacyRequest:async()=>({records:[{id:'REF-ABC123',reference:'ABC123'}],continuation:null}),
  active:()=>true,showList:()=>{redrawn++},status:()=>{},t:key=>key,Promise,Map,String
 };
 vm.createContext(ctx);vm.runInContext(ui.slice(begin,end),ctx);
 const [ref,dok]=await Promise.all([ctx.loadLegacyList(false),ctx.loadList(false)]);
 assert.equal(ref,true);
 assert.equal(dok,false);
 assert.equal(state.dokError,'DOK-Archiv nicht erreichbar');
 assert.equal(state.legacyRecords.length,1);
 assert.equal(redrawn,2,'both success and failure repaint the same persistent warning area');
});

test('Altfall: manipulierte oder zukünftige Prüfdaten verhindern einen unbestätigten Abschluss',()=>{
 const base={rootCause:'Nachgewiesene Ursache',correctiveAction:'Korrigierter Prüfschritt',
  checkMethod:'Stichprobe',checkCriteria:'Keine Fehler',effectivenessEvidence:'Protokoll geprüft',
  effectivenessResult:'wirksam',verifiedBy:'QM',checkDate:'2025-01-01',verifiedOn:'2025-01-03'};
 for(const [key,value] of [
  ['checkDate','2025-02-30'],['verifiedOn','2025-02-30'],
  ['verifiedOn','2099-01-01'],['checkDate','2099-01-01'],
  ['verifiedOn','2024-12-31'],['verifiedOn','keine Freigabe']
 ]){
  const c=make();Object.assign(c,base,{[key]:value});
  assert.throws(()=>complaints.changeStatus(c,'abgeschlossen','Bearbeiter'),
   e=>e.code==='EFFECTIVENESS_REQUIRED',key+' '+value);
  assert.equal(c.state,'offen','Ungültige Prüfung darf Bestandsstatus nicht verändern');
 }
 const legitimate=make();Object.assign(legitimate,base);
 complaints.changeStatus(legitimate,'abgeschlossen','QM');
 assert.equal(legitimate.state,'abgeschlossen');
});

test('DOK-Listen enthalten keine Beschwerdetexte, internen Maßnahmen oder Dateinamen',()=>{
 const source=fs.readFileSync('api/shipment-evidence/index.js','utf8');
 const from=source.indexOf('function listSummary(record){');
 const to=source.indexOf('async function list(ctx,query){',from);
 assert.ok(from>=0&&to>from,'List-specific privacy projection is required');
 const fail=(code,message,status)=>{const e=new Error(message);e.code=code;e.status=status;throw e};
 const project=new Function('fail',source.slice(from,to)+'return listSummary')(fail);
 const record={id:'DOK-20261111-11111111',updatedAt:'2026-11-11',revision:4,
  fields:{customer:'Beispielkunde',shipmentNumber:'SHP-25',dispatchDate:'2026-11-10',
   colli:'2',weightKg:'35',exporthubRef:'ABC123',remarks:'interne vertrauliche Bemerkung'},
  complaints:[{id:'secret-id',text:'Vertraulicher Beschwerdetext',state:'in_pruefung',
   effectivenessEvidence:'QM-Pruefprotokoll vertraulich',rootCause:'Interne Ursache'}],
  files:[{id:'file-id',name:'Privater_Nachweis.pdf'}],
  history:[{action:'complaint-update',before:'private'}],
  publicAccess:{hash:'secret'}};
 const summary=project(record),wire=JSON.stringify(summary);
 assert.equal(summary.id,record.id);
 assert.equal(summary.fields.exporthubRef,'ABC123');
 assert.equal(summary.fields.colli,'2');
 assert.deepEqual(summary.complaints,[{state:'in_pruefung'}]);
 assert.equal(summary.fileCount,1);
 for(const secret of ['Vertraulicher Beschwerdetext','QM-Pruefprotokoll vertraulich',
  'Interne Ursache','Privater_Nachweis.pdf','secret-id','interne vertrauliche Bemerkung',
  'publicAccess','history'])assert.equal(wire.includes(secret),false,secret+' must never enter list response');
 assert.throws(()=>project({id:'DOK-20261111-11111111',complaints:null}),
  e=>e.code==='CORRUPT_COMPLAINTS'&&e.status===503);
 assert.throws(()=>project({id:'DOK-20261111-11111111',complaints:[null]}),
  e=>e.code==='CORRUPT_COMPLAINTS'&&e.status===503);
});
