import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}

test('RC1501 Packmeldungen navigation is standalone and no longer clones Aufgaben or observes all DOM mutations',()=>{
  const nav=read('assets/pack-notification-nav.js');
  assert.doesNotMatch(nav,/cloneNode\(true\)/,'Packmeldungen must not clone the Aufgaben navigation entry');
  assert.doesNotMatch(nav,/new\s+root\.MutationObserver|new\s+MutationObserver/,'Packmeldungen navigation must not continuously rebuild from DOM mutations');
  assert.match(nav,/createElement\(['"]button['"]\)/,'Packmeldungen needs its own navigation button');
  assert.match(nav,/data-pack-notifications-nav-owner/);
  assert.match(nav,/packnotifications/,'Packmeldungen must own a dedicated view identity');
  assert.match(nav,/renderPackInbox/,'Packmeldungen click must render the dedicated inbox');
});

test('RC1501 Packmeldungen exposes Packtische & QR-Codes administration inside the dedicated view',()=>{
  const internal=read('assets/pack-notification-internal.js');
  assert.match(internal,/Packtische\s*&\s*QR-Codes/);
  assert.match(internal,/renderPackStations/);
  assert.match(internal,/data-pack-tab=["']stations["']/);
  assert.match(internal,/data-pack-station-action=["']create["']/);
  assert.match(internal,/data-pack-station-action=["']show-qr["']/);
  assert.match(internal,/data-pack-station-action=["']rotate["']/);
  assert.match(internal,/data-pack-station-action=["']print["']/);
  assert.match(internal,/data-pack-station-action=["']copy["']/);
});

test('RC1501 pack station admin API derives recoverable tokens without persisting plaintext token',()=>{
  const api=read('api/pack-stations-admin/index.js');
  const fn=JSON.parse(read('api/pack-stations-admin/function.json'));
  assert.equal(fn.bindings[0].type,'httpTrigger');
  assert.match(api,/action\s*===\s*['"]list['"]/);
  assert.match(api,/action\s*===\s*['"]create['"]/);
  assert.match(api,/action\s*===\s*['"]rotate['"]/);
  assert.match(api,/action\s*===\s*['"]qr['"]/);
  assert.match(api,/createHmac\(['"]sha256['"]/,'station token must be derived with server-side HMAC');
  assert.match(api,/tokenHash\s*:/,'only the token hash belongs in persisted station state');
  assert.doesNotMatch(api,/token\s*:\s*stationToken[^,}]*[,}]/,'raw station token must not be persisted on the station record');
  assert.match(api,/QRCode\.toString/,'server must create a scannable SVG QR code');
});

test('RC1501 API runtime includes QR generator dependency',()=>{
  const pkg=JSON.parse(read('api/package.json'));
  assert.equal(pkg.dependencies.qrcode,'1.5.4');
});
