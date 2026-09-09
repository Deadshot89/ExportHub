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
  assert.match(source,/access\.resolve\(req,'pickup',token,\{allowUsed:true\}/);
  assert.doesNotMatch(source,/access\.resolve\(req,'pickup',token,\{allowUsed:false\}/);
  assert.match(source,/readOnly:complete/);
  assert.match(source,/usedAt&&!complete/,'Ein verbrauchter, aber nicht vollständig abgeschlossener Token darf nicht wieder schreibbar werden.');
});

test('Sitzungsprüfung für Diagnose-Hotpaths liest Auth und Team parallel und cached die Containerinitialisierung',()=>{
  const source=read('api/shared/fast-auth-store.js');
  assert.match(source,/let clientsPromise = null/);
  assert.match(source,/Promise\.all\(\[/);
  assert.match(source,/auth\.readJson\(c\.auth[\s\S]*auth\.readJson\(c\.team/s);
  assert.match(source,/supportsFastPath/,'Die schnelle Auth-Schicht muss bei alten API-Mocks auf die zentrale Sitzungsprüfung zurückfallen können.');
  for(const path of ['api/pickup-init/index.js','api/fixed-pickups/index.js','api/customer-avis/index.js']){
    assert.match(read(path),/shared\/fast-auth-store/,`${path} muss die parallele Sitzungsprüfung verwenden.`);
  }
  const location=read('api/location-booking/index.js');
  assert.match(location,/shared\/auth-store/,'Location behält den etablierten direkten Sicherheitsvertrag.');
  assert.match(location,/action===['"]list['"][\s\S]{0,350}await auth\.validateSession\(req\)/,'Location-Liste muss direkt zentral validiert werden.');
});

test('ExportHUB-State Blob-Client wiederholt transiente Azure-Fehler standardmäßig einmal',()=>{
  const source=read('api/shared/blob-rest.js');
  assert.match(source,/new Set\(\[408,425,429,500,502,503,504\]\)/);
  assert.match(source,/EXPORTHUB_STORAGE_ATTEMPTS \|\| 2/,'Der Standard muss zwei Versuche erlauben.');
  assert.match(source,/for\(let attempt=1;attempt<=attempts;attempt\+\+\)/);
});

test('Lagerplatz-API initialisiert ihren Storage-Container nicht bei jedem Aufruf neu',()=>{
  const source=read('api/location-booking/index.js');
  assert.match(source,/locationContainerReadyPromise/);
  assert.match(source,/ensureLocationContainerReady/);
  const blobFn=block(source,'async function blob()','async function read()');
  assert.doesNotMatch(blobFn,/createIfNotExists/);
});

test('Kunden-Avis cached den Team-Container und findet aktive gemeinsame Sendungslisten sowie Identitäts-Aliase',()=>{
  const source=read('api/customer-avis/index.js');
  assert.match(source,/teamContainerReadyPromise/);
  assert.match(source,/ensureTeamContainerReady/);
  assert.match(source,/salesSharedShipments/);
  assert.match(source,/sharedShipments/);
  assert.match(source,/referenceNumber/);
  assert.match(source,/shipmentRef/);
  assert.match(source,/shipmentIdentityValues/);
});

test('SOP-Filter rendert erst nach dem laufenden Input-Event neu',()=>{
  const source=read('assets/sop/rc1013-sop-stability.js');
  const build=read('.github/rc1013/build-three-env.mjs');
  assert.match(source,/function schedulePaint\(/);
  assert.match(source,/stopImmediatePropagation\(\)/);
  assert.match(source,/requestAnimationFrame/);
  assert.match(source,/controller\.refresh\(\)/);
  assert.match(build,/rc1013-sop-stability\.js\?v=1013/);
  assert.match(build,/copy\('assets\/sop\/rc1013-sop-stability\.js'\)/);
});
