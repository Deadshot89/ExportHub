import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}

test('public qr pack page is standalone and has no ExportHUB login/navigation shell',()=>{
  const html=read('pack.html');
  assert.match(html,/id="packForm"/);
  assert.match(html,/id="packCustomer"/);
  assert.doesNotMatch(html,/id="packDeliveryNote"|Lieferschein \/ Referenz/);
  assert.match(html,/id="packPackageCount"/);
  assert.match(html,/id="packWeight"/);
  assert.match(html,/id="packDocuments"[^>]*multiple/);
  assert.match(html,/id="packSubmit"/);
  assert.doesNotMatch(html,/id="login"|ehLoginProduction|sidebar|main-navigation/i);
});

test('pack client creates one fresh session per page instance and locks logical submit',()=>{
  const js=read('assets/pack-notification.js');
  assert.match(js,/crypto\.randomUUID/);
  assert.match(js,/api\('session'/);
  assert.match(js,/api\('submit'/);
  assert.match(js,/sessionId/);
  assert.match(js,/submitLocked/);
  assert.match(js,/FileReader/);
  assert.match(js,/documents/);
  assert.doesNotMatch(js,/packDeliveryNote|deliveryNoteReference:els\.delivery/);
});

test('pack page supports responsive package rows and confirmation state',()=>{
  const js=read('assets/pack-notification.js');
  const css=read('assets/pack-notification.css');
  assert.match(js,/renderPackages/);
  assert.match(js,/packPackageRows/);
  assert.match(js,/packSuccess/);
  assert.match(css,/@media\s*\(max-width:\s*640px\)/);
  assert.match(css,/\.pack-package-grid/);
  assert.match(css,/overflow-wrap/);
});

test('pack customer input searches master data and requires explicit manual confirmation',()=>{
  const html=read('pack.html');
  const js=read('assets/pack-notification.js');
  const css=read('assets/pack-notification.css');
  assert.match(html,/id="packCustomerResults"/);
  assert.match(html,/id="packCustomerManualConfirm"/);
  assert.match(html,/Kunde trotzdem verwenden/);
  assert.match(js,/customer-search/);
  assert.match(js,/selectedCustomer/);
  assert.match(js,/customCustomerConfirmed/);
  assert.match(js,/customerSource/);
  assert.match(js,/customerId/);
  assert.match(js,/customerAccount/);
  assert.match(js,/setTimeout[\s\S]*customer-search/);
  assert.match(js,/selectedCustomer\s*=\s*null/);
  assert.match(css,/\.pack-customer-results/);
  assert.match(css,/\.pack-customer-manual/);
});

test('pack page loads shared packaging catalog before client and builds package type options from it',()=>{
  const html=read('pack.html');
  const catalogIndex=html.indexOf('/assets/packaging-catalog.js');
  const clientIndex=html.indexOf('/assets/pack-notification.js');
  assert.ok(catalogIndex>=0,'packaging catalog script missing');
  assert.ok(clientIndex>catalogIndex,'catalog must load before pack client');
  assert.match(html,/id="packPackageType"/);
  assert.doesNotMatch(html,/<option value="Europalette">Europalette<\/option>/);
  const js=read('assets/pack-notification.js');
  assert.match(js,/ExportHubPackagingCatalog/);
  assert.match(js,/populatePackageTypes/);
});

test('pack client loads saved packaging master data and merges it with safe fallback catalog',()=>{
  const js=read('assets/pack-notification.js');
  assert.match(js,/api\('packaging-list'/);
  assert.match(js,/loadPackagingMaster/);
  assert.match(js,/state\.packagingMaster/);
  assert.match(js,/mergePackagingOptions/);
  assert.match(js,/source\s*===\s*'fixed'/);
});

test('packaging options are sorted into a practical warehouse order',()=>{
  const js=read('assets/pack-notification.js');
  assert.match(js,/function packagingSortRank/);
  assert.match(js,/Euro Palette/);
  assert.match(js,/Einwegpalette/);
  assert.match(js,/Industrie Palette/);
  assert.match(js,/Düsseldorfer Palette/);
  assert.match(js,/^|[^A-Za-z]E0[^A-Za-z]|E0/);
  assert.match(js,/localeCompare/);
});

test('desktop pack page uses a compact content width and control sizing',()=>{
  const css=read('assets/pack-notification.css');
  assert.match(css,/\.pack-shell\{[^}]*width:min\(760px,100%\)/);
  assert.match(css,/input,select,textarea\{[^}]*min-height:40px/);
  assert.match(css,/\.pack-section\{[^}]*padding:14px 0/);
});

test('pack client autofills known length width and height from selected master packaging without inventing missing height',()=>{
  const js=read('assets/pack-notification.js');
  assert.match(js,/applyPackageDimensions/);
  assert.match(js,/selectedPackageEntry/);
  assert.match(js,/data-dim="length"/);
  assert.match(js,/data-dim="width"/);
  assert.match(js,/data-dim="height"/);
  assert.match(js,/entry\.height\s*!=\s*null/);
  assert.match(js,/els\.type\.addEventListener\('change'/);
});

test('static web app routes /pack/* to public pack.html and excludes it from SPA fallback',()=>{
  const config=JSON.parse(read('staticwebapp.config.json'));
  const route=config.routes.find(r=>r.route==='/pack/*');
  assert.ok(route);
  assert.equal(route.rewrite,'/pack.html');
  assert.ok(Array.isArray(route.allowedRoles)&&route.allowedRoles.includes('anonymous'));
  assert.ok(config.navigationFallback.exclude.includes('/pack/*'));
  assert.ok(config.navigationFallback.exclude.includes('/pack.html'));
});
