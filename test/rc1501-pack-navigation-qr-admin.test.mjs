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
  assert.match(nav,/pack-station-admin\.js\?v=1501/,'stable Packmeldungen navigation must load the station admin runtime');
});

test('RC1501 Packmeldungen exposes Packtische & QR-Codes administration inside the dedicated view',()=>{
  const admin=read('assets/pack-station-admin.js');
  assert.match(admin,/Packtische\s*&\s*QR-Codes/);
  assert.match(admin,/renderPackStations/);
  assert.match(admin,/data-pack-tab=\\?['"]stations/);
  assert.match(admin,/data-pack-station-action=\\?['"]create/);
  assert.match(admin,/data-pack-station-action=\\?['"]show-qr/);
  assert.match(admin,/data-pack-station-action=\\?['"]rotate/);
  assert.match(admin,/data-pack-station-action=\\?['"]print/);
  assert.match(admin,/data-pack-station-action=\\?['"]copy/);
  assert.match(admin,/data-pack-station-action=\\?['"]toggle/);
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
  assert.match(api,/station\.tokenHash\s*=\s*packStore\.hashStationToken/,'only the derived token hash belongs in persisted station state');
  assert.doesNotMatch(api,/station\.(?:token|stationToken)\s*=/,'raw station token must never be persisted on the station record');
  assert.match(api,/QRCode\.toString/,'server must create a scannable SVG QR code');
  assert.match(api,/GLOBAL_ADMIN_REQUIRED/,'QR management must remain admin-protected');
});

test('RC1501 API runtime includes QR generator dependency',()=>{
  const pkg=JSON.parse(read('api/package.json'));
  assert.equal(pkg.dependencies.qrcode,'1.5.4');
});
