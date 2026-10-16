import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const UI='assets/rc1546-pickup-control.js';
const API='api/manual-pickup-confirm/index.js';
const ROUTE='api/manual-pickup-confirm/function.json';
const LOADER='assets/rc1488-auto-update.js';
const MANIFEST='RELEASE_MANIFEST.txt';

test('RC1546: Abholkontrolle und manuelles Nachtragen sind als eigener Runtime-Baustein vorhanden',()=>{
  assert.ok(fs.existsSync(UI),'RC1546 Pickup-Control Runtime fehlt');
  assert.ok(fs.existsSync(API),'RC1546 Manual-Pickup API fehlt');
  assert.ok(fs.existsSync(ROUTE),'RC1546 Manual-Pickup Route fehlt');
});

test('RC1546: offene Abholungen schließen Entwurf, Storniert und bereits abgeholte Sendungen aus',()=>{
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

test('RC1546: Print-Control enthält Kontrollfelder, Alter und manuelle Nachtragsaktion',()=>{
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

test('RC1546: manuelle Abholung verlangt Datum und Begründung und schreibt revisionssichere Felder',()=>{
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

test('RC1546: spätere Status werden durch manuelles Nachtragen niemals zurückgestuft',()=>{
  const source=fs.readFileSync(API,'utf8');
  assert.match(source,/POD vorhanden/);
  assert.match(source,/Abgeschlossen/);
  assert.match(source,/Archiviert/);
  assert.match(source,/preserve|nicht zur.ck|laterStatus|statusRank/i);
});

test('RC1546: Runtime wird geladen und in das Release-Paket aufgenommen',()=>{
  const loader=fs.readFileSync(LOADER,'utf8');
  const manifest=fs.readFileSync(MANIFEST,'utf8');
  assert.match(loader,/rc1546-pickup-control\.js\?v=1546/);
  assert.match(manifest,/assets\/rc1546-pickup-control\.js/);
  assert.match(manifest,/api\/manual-pickup-confirm\/index\.js/);
  assert.match(manifest,/api\/manual-pickup-confirm\/function\.json/);
});
