import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const UI='assets/rc1546-pickup-control.js';
const API='api/manual-pickup-confirm/index.js';
const ROUTE='api/manual-pickup-confirm/function.json';
const FINALIZER='.github/rc1488/finalize-auto-update.mjs';
const PROD='.github/workflows/exporthub-production-release.yml';
const TESTSERVICE='.github/workflows/exporthub-testservice.yml';

function loadUi(){
  const source=fs.readFileSync(UI,'utf8');
  const context={console,setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){}};
  context.globalThis=context;
  vm.runInNewContext(source,context,{filename:UI});
  return context.ExportHUBRC1546PickupControl;
}

test('RC1547: Abholkontrolle und manuelles Nachtragen sind als eigener Runtime-Baustein vorhanden',()=>{
  assert.ok(fs.existsSync(UI),'Pickup-Control Runtime fehlt');
  assert.ok(fs.existsSync(API),'Manual-Pickup API fehlt');
  assert.ok(fs.existsSync(ROUTE),'Manual-Pickup Route fehlt');
});

test('RC1547: offene Abholungen schließen Entwurf, Storniert und bereits abgeholte Sendungen aus',()=>{
  const api=loadUi();
  assert.ok(api&&typeof api.openPickupShipments==='function','openPickupShipments fehlt');
  const rows=api.openPickupShipments([
    {reference:'OPEN01',status:'Bereit zur Abholung',plannedPickupDate:'2026-10-15'},
    {reference:'DRAFT1',status:'Entwurf'},
    {reference:'CANCEL',status:'Storniert'},
    {reference:'PICKED',status:'Abgeholt',actualPickupDate:'2026-10-15'},
    {reference:'POD001',status:'POD vorhanden',pickedUpAt:'2026-10-15T12:00:00Z'},
    {reference:'CREAT1',status:'Erstellt',plannedPickupDate:'2026-10-16'}
  ],new Date('2026-10-16T09:00:00+02:00'));
  assert.deepEqual(Array.from(rows,r=>r.reference),['OPEN01','CREAT1']);
});

test('RC1547: Print-Control enthält Kontrollfelder, Alter und manuelle Nachtragsaktion',()=>{
  const ui=fs.readFileSync(UI,'utf8');
  for(const marker of [
    'Abholkontrolle',
    'Noch nicht abgeholt',
    'Abholung nachtragen',
    'physisch vorhanden',
    'bereits abgeholt',
    'Klärung erforderlich',
    'Geprüft von',
    'window.print'
  ]) assert.ok(ui.includes(marker),marker+' fehlt');
});

test('RC1547: Druckkontrolle erzwingt A4 Querformat und wiederholbare Tabellenköpfe',()=>{
  const ui=fs.readFileSync(UI,'utf8');
  assert.match(ui,/@page\s+rc1546ControlPage\s*\{[^}]*size\s*:\s*A4\s+landscape/i,'A4-Querformat für die Abholkontrolle fehlt');
  assert.match(ui,/\.rc1546-overlay\{page:rc1546ControlPage!important;/,'Abholkontrolle muss die benannte Querformat-Seite verwenden');
  assert.doesNotMatch(ui,/@page\s*\{[^}]*size\s*:\s*A4\s+landscape/i,'Globale Querformat-Regel darf nicht normale Ladelisten verändern');
  assert.match(ui,/thead\s*\{[^}]*display\s*:\s*table-header-group/i,'Tabellenkopf ist für Mehrseiten-Druck nicht abgesichert');
});

test('RC1547: Wartet auf ABD wird als Versandblockade und nicht als versäumte Abholung gewertet',()=>{
  const api=loadUi();
  assert.ok(api&&typeof api.rowPresentation==='function','rowPresentation fehlt');
  const blocked=api.rowPresentation({status:'Wartet auf ABD'},5);
  assert.equal(blocked.level,'blocked');
  assert.match(blocked.note,/ABD/i);
  const overdue=api.rowPresentation({status:'Bereit zur Abholung'},5);
  assert.equal(overdue.level,'3');
});

test('RC1547: manuelle Abholung verlangt Datum und Begründung und schreibt revisionssichere Felder',()=>{
  const api=fs.readFileSync(API,'utf8');
  for(const marker of [
    "require('../shared/fast-auth-store')",
    'actualPickupDate',
    'actualPickupAt',
    'pickedUpAt',
    "status:'Abgeholt'",
    'manualPickupConfirmationHistory',
    'shipmentHistory',
    'reason',
    'ifMatch'
  ]) assert.ok(api.includes(marker),marker+' fehlt');
  assert.match(api,/pickupDate.*required|pickupDate.*erforderlich|Abholdatum/i);
  assert.match(api,/reason.*required|reason.*erforderlich|Begr/i);
});

test('RC1547: tatsächliches manuelles Abholdatum darf nicht in der Zukunft liegen',()=>{
  const api=fs.readFileSync(API,'utf8');
  const ui=fs.readFileSync(UI,'utf8');
  assert.match(api,/PICKUP_DATE_FUTURE/,'Backend-Fehlercode für zukünftiges Ist-Abholdatum fehlt');
  assert.match(api,/Europe\/Berlin/,'fachliche Tagesgrenze muss in der ExportHUB-Zeitzone geprüft werden');
  assert.match(api,/pickupDate\s*>\s*businessToday/,'Backend muss zukünftige Abholdaten tatsächlich blockieren');
  assert.match(ui,/pickupDate\.max\s*=\s*ymd\(new Date\(\)\)/,'Datumsfeld muss heute als Maximalwert setzen');
  assert.match(ui,/date\s*>\s*ymd\(new Date\(\)\)/,'UI muss Zukunftsdatum auch beim Submit abfangen');
});

test('RC1547: spätere Status werden durch manuelles Nachtragen niemals zurückgestuft',()=>{
  const source=fs.readFileSync(API,'utf8');
  assert.match(source,/POD vorhanden/);
  assert.match(source,/Abgeschlossen/);
  assert.match(source,/Archiviert/);
  assert.match(source,/preserve|nicht zur.ck|laterStatus|statusRank/i);
});

test('RC1547: Legacy-Teamdaten ohne state-Wrapper erzeugen keine zyklische JSON-Struktur',()=>{
  const api=fs.readFileSync(API,'utf8');
  assert.doesNotMatch(api,/state\s*=\s*obj\(team\.state\)\s*\?\s*team\.state\s*:\s*team\s*;/,'team.state darf niemals auf das Team-Dokument selbst zeigen');
  assert.match(api,/state\s*=\s*obj\(team\.state\)\s*\?\s*team\.state\s*:\s*\{\}\s*;/,'fehlender state-Wrapper muss als eigenes Objekt initialisiert werden');
});

test('RC1547: manueller Abhol-Endpoint trennt Production und TESTSERVICE wie der zentrale State-Endpoint',()=>{
  const api=fs.readFileSync(API,'utf8');
  assert.match(api,/ENVIRONMENT_INVALID/,'ungültige Umgebungswerte müssen abgelehnt werden');
  assert.match(api,/ENVIRONMENT_MISMATCH/,'Host-/Origin-Widersprüche müssen abgelehnt werden');
  assert.match(api,/-testservice\\\./,'TESTSERVICE-Evidenz fehlt');
  assert.match(api,/azurestaticapps/,'Produktionshost-Erkennung fehlt');
});

test('RC1547: nur Benutzer mit Bearbeitungsrecht dürfen Abholungen manuell verändern',()=>{
  const api=fs.readFileSync(API,'utf8');
  assert.match(api,/hasAnyEditRight\(session\.user\)/,'Bearbeitungsrechte werden vor der Mutation nicht geprüft');
  assert.match(api,/WRITE_FORBIDDEN/,'403-Fehler für fehlende Bearbeitungsrechte fehlt');
});

test('RC1547: Pickup-Control beobachtet nicht den kompletten DOM-Baum auf Child-Mutations',()=>{
  const ui=fs.readFileSync(UI,'utf8');
  assert.doesNotMatch(ui,/childList\s*:\s*true/,'Pickup-Control darf keine globalen Child-Mutations beobachten');
  assert.match(ui,/attributeFilter\s*:\s*\['data-exporthub-view'\]/,'View-Wechsel sollen gezielt beobachtet werden');
});

test('RC1547: aktueller RC1112-Build nimmt Runtime und API in das Deploy-Paket auf',()=>{
  const finalizer=fs.readFileSync(FINALIZER,'utf8');
  assert.match(finalizer,/rc1546-pickup-control\.js\?v=1546/);
  assert.match(finalizer,/assets[^\n]+rc1546-pickup-control\.js/);
  for(const workflow of [PROD,TESTSERVICE]){
    const yaml=fs.readFileSync(workflow,'utf8');
    assert.match(yaml,/api_location:\s*api\/?/,'API-Verzeichnis fehlt im Deploy '+workflow);
  }
});
