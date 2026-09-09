import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path,'utf8');

function block(source,startMarker,endMarker){
  const start=source.indexOf(startMarker);
  assert.ok(start>=0,`${startMarker} fehlt.`);
  const end=endMarker?source.indexOf(endMarker,start+startMarker.length):-1;
  return source.slice(start,end>start?end:source.length);
}

test('Abgeschlossene QR-Abholung bleibt im Status lesbar statt HTTP 410 zu liefern',()=>{
  const source=read('api/pickup-status/index.js');
  assert.match(source,/access\.resolve\(req,'pickup',token,\{allowUsed:true\}/,'pickup-status muss einen nach Abschluss verbrauchten Token noch lesend auflösen dürfen.');
  assert.doesNotMatch(source,/access\.resolve\(req,'pickup',token,\{allowUsed:false\}/,'pickup-status darf abgeschlossene Einmal-Tokens nicht als Fehler verwerfen.');
  assert.match(source,/readOnly:complete/,'Abgeschlossene Abholungen müssen als Nur-Lesen-Status zurückkommen.');
});

test('Gemeinsame Sitzungsprüfung liest Auth und Team parallel und initialisiert den Container höchstens einmal pro Prozess',()=>{
  const source=read('api/shared/auth-store.js');
  const validation=block(source,'async function validateSession(','function cookieToken');
  assert.match(validation,/Promise\.all\(\[/,'Auth- und Team-Dokument müssen parallel geladen werden.');
  assert.match(validation,/readJson\(c\.auth[\s\S]*readJson\(c\.team/s,'Parallelpfad muss Auth- und Team-Dokument enthalten.');
  assert.match(source,/containerReadyPromise|ensureContainerReady/,'Container-Initialisierung braucht einen wiederverwendeten Prozess-Cache.');
});

test('ExportHUB-State wiederholt transiente Azure-Lesefehler kontrolliert',()=>{
  const source=read('api/exporthub-state/index.js');
  assert.match(source,/storageReadRetry|withStorageReadRetry|readWithRetry/,'Für transiente Azure-Lesefehler fehlt ein begrenzter Retry-Pfad.');
  assert.match(source,/429|408|5\d\d|ECONNRESET|ETIMEDOUT/,'Retry-Pfad muss nur transiente Netzwerk-/Storagefehler behandeln.');
});

test('Lagerplatz-API initialisiert ihren Storage-Container nicht bei jedem Aufruf neu',()=>{
  const source=read('api/location-booking/index.js');
  assert.match(source,/locationContainerReadyPromise|ensureLocationContainerReady/,'Location-Storage braucht eine einmalige Container-Initialisierung pro Prozess.');
  const blobFn=block(source,'async function blob()','async function read()');
  assert.doesNotMatch(blobFn,/await container\.createIfNotExists\(\)/,'blob() darf nicht bei jedem Request createIfNotExists ausführen.');
});

test('Kunden-Avis initialisiert den Team-Container nicht bei jedem Aufruf neu',()=>{
  const source=read('api/customer-avis/index.js');
  assert.match(source,/teamContainerReadyPromise|ensureTeamContainerReady/,'Kunden-Avis braucht eine einmalige Container-Initialisierung pro Prozess.');
  const teamBlobFn=block(source,'async function teamBlob(','async function readTeam');
  assert.doesNotMatch(teamBlobFn,/await c\.createIfNotExists\(\)/,'teamBlob() darf nicht bei jedem Avis-Aufruf createIfNotExists ausführen.');
});

test('Kunden-Avis findet Sendungen über alle aktiven gemeinsamen Sendungslisten und Identitäts-Aliase',()=>{
  const source=read('api/customer-avis/index.js');
  assert.match(source,/salesSharedShipments/,'Gemeinsam gespeicherte Sendungen müssen für Kunden-Avis berücksichtigt werden.');
  assert.match(source,/sharedShipments/,'Shared-Shipments müssen für Kunden-Avis berücksichtigt werden.');
  assert.match(source,/referenceNumber/,'Referenz-Alias referenceNumber muss beim Matching berücksichtigt werden.');
  assert.match(source,/shipmentRef/,'Referenz-Alias shipmentRef muss beim Matching berücksichtigt werden.');
});

test('SOP-Filter ersetzt den DOM nicht synchron innerhalb des input/change-Events',()=>{
  const source=read('assets/sop/rc1007-sop-ui.js');
  assert.match(source,/function schedulePaint\(/,'SOP-UI braucht einen gebündelten Render-Scheduler.');
  const filter=block(source,'function onFilter(','host.addEventListener');
  assert.match(filter,/schedulePaint\(\)/,'Filteränderungen müssen den Render nach dem laufenden Event einplanen.');
  assert.doesNotMatch(filter,/;paint\(\)/,'Filteränderungen dürfen host.innerHTML nicht synchron im Input-Event ersetzen.');
});

test('Abholkalender baut einen Datumsindex statt die komplette Sendungsliste für jeden Wochentag erneut zu filtern',()=>{
  const source=read('assets/abholkalender.js');
  assert.match(source,/shipmentsByDate|shipmentDateIndex/,'Abholkalender braucht einen einmaligen Datumsindex für Sendungen.');
});
