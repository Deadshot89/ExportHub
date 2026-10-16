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

test('RC1547: Abholkontrolle und manuelles Nachtragen sind als eigener Runtime-Baustein vorhanden',()=>{
  assert.ok(fs.existsSync(UI),'Pickup-Control Runtime fehlt');
  assert.ok(fs.existsSync(API),'Manual-Pickup API fehlt');
  assert.ok(fs.existsSync(ROUTE),'Manual-Pickup Route fehlt');
});

test('RC1547: offene Abholungen schließen Entwurf, Storniert und bereits abgeholte Sendungen aus',()=>{
  const source=fs.readFileSync(UI,'utf8');
  const context={console,setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){}};
  context.globalThis=context;
  vm.runInNewContext(source,context,{filename:UI});
  const api=context.ExportHUBRC1546PickupControl;
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
  assert.match(api,/azurestaticapps\\?\\?\.net|azurestaticapps\\\.net|azurestaticapps/,'Produktionshost-Erkennung fehlt');
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
