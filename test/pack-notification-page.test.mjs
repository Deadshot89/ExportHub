import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}

test('public qr pack page is standalone and keeps the current mandatory delivery-note upload contract',()=>{
  const html=read('pack.html');
  assert.match(html,/id="packForm"/);
  assert.match(html,/id="packCustomer"/);
  assert.doesNotMatch(html,/id="packDeliveryNoteReference"|Lieferschein \/ Referenz/);
  assert.match(html,/id="packPackageCount"/);
  assert.match(html,/id="packWeight"/);
  assert.match(html,/id="packDocuments"[^>]*multiple/);
  assert.doesNotMatch(html,/id="packDocuments"[^>]*\\srequired(?:\\s|>)/,'empty native file input must not block a valid state-based document submit');
  assert.doesNotMatch(read('assets/pack.html'),/id="packDocuments"[^>]*\\srequired(?:\\s|>)/,'deployed pack page must obey the same contract');
  assert.match(html,/id="packSubmit"/);
  assert.doesNotMatch(html,/id="login"|ehLoginProduction|sidebar|main-navigation/i);
});

test('pack client creates one fresh session per page instance and locks logical submit without reviving removed reference input',()=>{
  const js=read('assets/pack-notification.js');
  assert.match(js,/crypto\.randomUUID/);
  assert.match(js,/api\('session'/);
  assert.match(js,/api\('submit'/);
  assert.match(js,/sessionId/);
  assert.match(js,/submitLocked/);
  assert.match(js,/FileReader/);
  assert.match(js,/documents/);
  assert.doesNotMatch(js,/packDeliveryNoteReference|deliveryRef/);
  assert.match(js,/deliveryNoteReference:derivedDocumentReference\(\)/);
  assert.match(js,/return state\.documents\.length>0/);
});

test('pack page supports responsive package rows and confirmation state',()=>{
  const js=read('assets/pack-notification.js'),css=read('assets/pack-notification.css');
  assert.match(js,/renderPackages/);assert.match(js,/packPackageRows/);assert.match(js,/packSuccess/);assert.match(css,/@media\s*\(max-width:\s*640px\)/);assert.match(css,/\.pack-package-grid/);assert.match(css,/overflow-wrap/);
});

test('pack customer input searches master data and requires explicit manual confirmation',()=>{
  const html=read('pack.html'),js=read('assets/pack-notification.js'),css=read('assets/pack-notification.css');
  assert.match(html,/id="packCustomerResults"/);assert.match(html,/id="packCustomerManualConfirm"/);assert.match(html,/Kunde trotzdem verwenden/);assert.match(js,/customer-search/);assert.match(js,/selectedCustomer/);assert.match(js,/customCustomerConfirmed/);assert.match(js,/customerSource/);assert.match(js,/customerId/);assert.match(js,/customerAccount/);assert.match(js,/setTimeout[\s\S]*customer-search/);assert.match(js,/selectedCustomer\s*=\s*null/);assert.match(css,/\.pack-customer-results/);assert.match(css,/\.pack-customer-manual/);
});

test('pack page loads shared packaging catalog before client and builds package type options from it',()=>{
  const html=read('pack.html'),catalogIndex=html.indexOf('/assets/packaging-catalog.js'),clientIndex=html.indexOf('/assets/pack-notification.js');
  assert.ok(catalogIndex>=0,'packaging catalog script missing');assert.ok(clientIndex>catalogIndex,'catalog must load before pack client');assert.match(html,/id="packPackageType"/);assert.doesNotMatch(html,/<option value="Europalette">Europalette<\/option>/);const js=read('assets/pack-notification.js');assert.match(js,/ExportHubPackagingCatalog/);assert.match(js,/populatePackageTypes/);
});

test('pack client loads saved packaging master data and merges it with safe fallback catalog',()=>{const js=read('assets/pack-notification.js');assert.match(js,/api\('packaging-list'/);assert.match(js,/loadPackagingMaster/);assert.match(js,/state\.packagingMaster/);assert.match(js,/mergePackagingOptions/);assert.match(js,/source\s*===\s*'fixed'/);});

test('packaging options are sorted into a practical warehouse order',()=>{const js=read('assets/pack-notification.js');assert.match(js,/function packagingSortRank/);assert.match(js,/europalette:10/);assert.match(js,/einwegpalette:20/);assert.match(js,/industriepalette:30/);assert.match(js,/dusseldorferpalette:40/);assert.match(js,/kunststoffpalette:50/);assert.match(js,/palettengestell:60/);assert.match(js,/\^e\(\[0-6\]\)\$/);assert.match(js,/gestapelteuropalette/);assert.match(js,/localeCompare/);});

test('desktop pack page uses a compact content width and control sizing',()=>{const css=read('assets/pack-notification.css');assert.match(css,/\.pack-shell\{[^}]*width:min\(760px,100%\)/);assert.match(css,/input,select,textarea\{[^}]*min-height:40px/);assert.match(css,/\.pack-section\{[^}]*padding:14px 0/);});

test('pack client autofills known length width and height from selected master packaging without inventing missing height',()=>{const js=read('assets/pack-notification.js');assert.match(js,/applyPackageDimensions/);assert.match(js,/selectedPackageEntry/);assert.match(js,/data-dim="length"/);assert.match(js,/data-dim="width"/);assert.match(js,/data-dim="height"/);assert.match(js,/entry\.height\s*!=\s*null/);assert.match(js,/els\.type\.addEventListener\('change'/);});

test('pack PDF upload loads the shared DNC SIDE normalizer before the client and applies it before metadata is persisted',()=>{
  const html=read('pack.html'),js=read('assets/pack-notification.js'),build=read('.github/packmeldungen/build-three-env.mjs');
  const normalizerIndex=html.indexOf('/assets/document-reference-normalizer.js');
  const clientIndex=html.indexOf('/assets/pack-notification.js');
  assert.ok(normalizerIndex>=0,'document reference normalizer script missing');
  assert.ok(clientIndex>normalizerIndex,'document reference normalizer must load before pack client');
  assert.match(js,/ExportHubDocumentReferenceNormalizer/);
  assert.match(js,/normalizePdfFile/);
  assert.match(js,/originalName/);
  assert.match(js,/documentReference/);
  assert.match(build,/document-reference-normalizer\.js/,'pack deployment must copy the normalizer asset');
});

test('pack PDF rename change preserves valid semicolon-terminated quote escaping',()=>{
  const js=read('assets/pack-notification.js');
  assert.match(js,/&quot;/,'double quotes must remain escaped as &quot;');
});

test('static web app routes /pack/* to the deployable public pack asset and excludes it from SPA fallback',()=>{const config=JSON.parse(read('staticwebapp.config.json')),route=config.routes.find(r=>r.route==='/pack/*'),direct=config.routes.find(r=>r.route==='/pack.html'),asset=read('assets/pack.html');assert.ok(route);assert.equal(route.rewrite,'/assets/pack.html');assert.equal(direct&&direct.rewrite,'/assets/pack.html');assert.ok(Array.isArray(route.allowedRoles)&&route.allowedRoles.includes('anonymous'));assert.ok(config.navigationFallback.exclude.includes('/pack/*'));assert.ok(config.navigationFallback.exclude.includes('/pack.html'));assert.match(asset,/ExportHUB360 · Packmeldung/);assert.match(asset,/id="packForm"/);assert.match(asset,/\/assets\/document-reference-normalizer\.js\?v=2/);assert.match(asset,/\/assets\/pack-notification\.js\?v=3/);});
