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
  assert.match(nav,/pack-station-admin\.js\?v=1501/,'stable Packmeldungen navigation must load the QR admin runtime');
});

test('RC1502 Packmeldungen exposes exactly one shared Pack-QR instead of a multi-station UI',()=>{
  const admin=read('assets/pack-station-admin.js');
  assert.match(admin,/Pack-QR-Code/);
  assert.match(admin,/Gemeinsamer QR-Code für alle Packplätze/);
  assert.match(admin,/renderPackStations/);
  assert.match(admin,/data-pack-tab=\\?['"]qr/);
  assert.match(admin,/data-pack-station-action=\\?['"]show-qr/);
  assert.match(admin,/data-pack-station-action=\\?['"]rotate/);
  assert.match(admin,/data-pack-station-action=\\?['"]print/);
  assert.match(admin,/data-pack-station-action=\\?['"]copy/);
  assert.doesNotMatch(admin,/data-pack-station-action=\\?['"]create/);
  assert.doesNotMatch(admin,/data-pack-station-action=\\?['"]toggle/);
  assert.doesNotMatch(admin,/Name des Packtischs|Packtisch anlegen/);
});

test('RC1502 pack QR admin API derives one recoverable shared token without persisting plaintext token',()=>{
  const api=read('api/pack-stations-admin/index.js');
  const fn=JSON.parse(read('api/pack-stations-admin/function.json'));
  assert.equal(fn.bindings[0].type,'httpTrigger');
  assert.match(api,/SHARED_STATION_ID=['"]PACK-SHARED['"]/);
  assert.match(api,/action===['"]shared['"]/);
  assert.match(api,/action===['"]rotate-shared['"]/);
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

test('RC1501 deployable pack page keeps translated draft controls strict-i18n clean',()=>{
  const html=read('assets/pack.html');
  const draftI18n=read('assets/i18n/pack-notification-drafts.js');
  const client=read('assets/pack-notification.js');
  const placeholderIds=['packSubtitle','packHomeTitle','packHomeHelp','packNewShipment','packDraftEmpty','packBackHome','packDeliveryNotesHelp','packValidationHint','packSaveDraft','packRestart'];
  for(const id of placeholderIds){
    assert.match(html,new RegExp(`id=["']${id}["'][^>]*>…<`),`${id} must use a neutral pre-i18n placeholder in the deploy copy`);
  }
  for(const id of ['packSubtitle','packHomeTitle','packHomeHelp','packNewShipment','packDraftEmpty','packBackHome','packDeliveryNotesHelp','packRestart']){
    assert.match(draftI18n,new RegExp(`${id}:['"]pack\\.`),`${id} must be translated by the static pack draft i18n runtime`);
  }
  assert.match(client,/els\.saveDraft\.textContent=tr\(['"]pack\.draft\.save['"]\)/,'packSaveDraft must be translated before the form becomes visible');
  assert.match(client,/els\.hint\.textContent=tr\(['"]pack\.draft\.ready['"]\)/,'ready validation hint must use i18n');
  assert.match(client,/els\.hint\.textContent=tr\(['"]pack\.draft\.deliveryRequirement['"]\)/,'delivery-note validation hint must use i18n');
  assert.match(client,/els\.hint\.textContent=tr\(['"]pack\.draft\.validation['"]\)/,'general validation hint must use i18n');
});
