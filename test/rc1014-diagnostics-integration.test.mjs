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

test('RC1014 Wiederverwendbarkeit der öffentlichen Links bleibt vollständig erhalten',()=>{
  const pickupStatus=read('api/pickup-status/index.js');
  const pickupInit=read('api/pickup-init/index.js');
  const rc1014=read('test/rc1014-reusable-public-links.test.mjs');
  assert.match(pickupStatus,/oneTime:false/);
  assert.match(pickupStatus,/version:'RC1014'/);
  assert.match(pickupInit,/oneTime:false/);
  assert.match(pickupInit,/version:'RC1014'/);
  assert.match(rc1014,/Abhol- und Avis-Link bleiben auch nach usedAt erneut auflösbar/);
});

test('Diagnose-Hotpaths lesen Auth und Team parallel und behalten zentrale Sicherheitslogik',()=>{
  const fast=read('api/shared/fast-auth-store.js');
  assert.match(fast,/Promise\.all\(\[/);
  assert.match(fast,/auth\.readJson\(c\.auth[\s\S]*auth\.readJson\(c\.team/s);
  assert.match(fast,/supportsFastPath/);
  assert.match(fast,/return auth\.validateSession\(req, options\)/);
  for(const path of ['api/pickup-init/index.js','api/fixed-pickups/index.js','api/customer-avis/index.js']){
    assert.match(read(path),/shared\/fast-auth-store/,`${path}: schneller Auth-Hotpath fehlt.`);
  }
  const location=read('api/location-booking/index.js');
  assert.match(location,/shared\/auth-store/);
  assert.match(location,/action===['"]list['"][\s\S]{0,350}await auth\.validateSession\(req\)/);
});

test('Azure-Blob-Leser wiederholt transiente Fehler standardmäßig einmal',()=>{
  const source=read('api/shared/blob-rest.js');
  assert.match(source,/new Set\(\[408,425,429,500,502,503,504\]\)/);
  assert.match(source,/EXPORTHUB_STORAGE_ATTEMPTS \|\| 2/);
  assert.match(source,/for\(let attempt=1;attempt<=attempts;attempt\+\+\)/);
});

test('Lagerplatz-Storage wird nicht pro Request neu initialisiert',()=>{
  const source=read('api/location-booking/index.js');
  assert.match(source,/locationContainerReadyPromise/);
  assert.match(source,/ensureLocationContainerReady/);
  const blobFn=block(source,'async function blob()','async function read()');
  assert.doesNotMatch(blobFn,/createIfNotExists/);
});

test('Kunden-Avis cached den Team-Container und findet alle relevanten Sendungskopien',()=>{
  const source=read('api/customer-avis/index.js');
  assert.match(source,/teamContainerReadyPromise/);
  assert.match(source,/ensureTeamContainerReady/);
  assert.match(source,/salesSharedShipments/);
  assert.match(source,/sharedShipments/);
  assert.match(source,/shipmentIdentityValues/);
  assert.match(source,/referenceNumber/);
  assert.match(source,/shipmentRef/);
});

test('SOP-Filter rendert nicht synchron mitten im DOM-Input-Event',()=>{
  const source=read('assets/sop/rc1013-sop-stability.js');
  const build=read('.github/rc1013/build-three-env.mjs');
  assert.match(source,/function schedulePaint\(/);
  assert.match(source,/stopImmediatePropagation\(\)/);
  assert.match(source,/requestAnimationFrame/);
  assert.match(source,/controller\.refresh\(\)/);
  assert.match(build,/rc1013-sop-stability\.js\?v=1013/);
  assert.match(build,/copy\('assets\/sop\/rc1013-sop-stability\.js'\)/);
});
