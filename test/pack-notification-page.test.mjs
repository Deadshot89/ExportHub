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
  assert.doesNotMatch(html,/id="packDocuments"[^>]*\srequired(?:\s|>)/,'empty native file input must not block a valid state-based document submit');
  assert.doesNotMatch(read('assets/pack.html'),/id="packDocuments"[^>]*\srequired(?:\s|>)/,'deployed pack page must obey the same contract');
  assert.match(html,/id="packSubmit"/);
  assert.doesNotMatch(html,/id="login"|ehLoginProduction|sidebar|main-navigation/i);
});

test('pack client creates a server session at first write and locks logical submit without reviving removed reference input',()=>{
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
  assert.doesNotMatch(js,/return state\.documents\.length>0/,'uploaded documents may not be a condition for submit');
  assert.match(js,/const documentsOk=state\.documents\.length>0/,'document progress is informational only');
  assert.doesNotMatch(js,/if\(!documentsOk\)items\.push/,'missing documents must not appear in mandatory steps');
});

test('pack homepage remains usable without session writes and only creates a session on save/submit',()=>{
  const js=read('assets/pack-notification.js');
  const block=(name,next)=>{const start=js.indexOf('async function '+name+'(');assert.ok(start>=0,'missing '+name);const end=js.indexOf('function '+next+'(',start+16);assert.ok(end>start,'missing delimiter '+next);return js.slice(start,end)};
  const page=block('startPage','submit');
  assert.doesNotMatch(page,/await ensureSession\(\)/,'initial page render must not write sessions');
  assert.match(page,/await loadDrafts\(\)/,'token must be verified through read-only API before opening home');
  assert.match(page,/Promise\.all\(\[showHome\(true\),loadPackagingMaster\(\)\]\)/);
  const newShipment=block('openNewShipment','openDraft');
  assert.doesNotMatch(newShipment,/ensureSession\(\)/,'opening new form must not need storage writes');
  const draft=block('openDraft','saveDraft');
  assert.doesNotMatch(draft,/ensureSession\(\)/,'opening an existing draft is read-only');
  const save=block('saveDraft','startPage'),submit=block('submit','refreshLanguage');
  assert.match(save,/await ensureSession\(\)/,'draft persistence requires server session');
  assert.match(submit,/await ensureSession\(\)/,'submitting to ExportHUB360 requires server session');
});

test('pack homepage renders with valid QR even if creating a writable session would fail',async()=>{
  const js=read('assets/pack-notification.js');
  const match=js.match(/async function startPage\(\)\{[\s\S]*?\}(?=\s*async function submit)/);
  assert.ok(match,'Packtisch startPage implementation should be present');
  let sessionCalls=0,loaded=0,shown=0,verified=0,error='';
  const state={stationToken:''},els={loading:{hidden:false}};
  const start=new Function('clearError','state','tokenFromPath','els','showError','tr','ensureSession','loadDrafts','showHome','loadPackagingMaster',
    match[0]+'; return startPage;')(
      ()=>{},state,()=>'VALID-PACKTISCH-TOKEN',els,
      msg=>{error=msg},key=>key,
      async()=>{sessionCalls++;throw new Error('HTTP 500')},
      async()=>{verified++},async(flag)=>{assert.equal(flag,true);shown++},async()=>{loaded++}
    );
  await start();
  assert.equal(els.loading.hidden,true);
  assert.equal(state.stationToken,'VALID-PACKTISCH-TOKEN');
  assert.equal(sessionCalls,0,'initial page must not call the write-session endpoint');
  assert.equal(verified,1,'QR token is checked via read-only draft-list before home');
  assert.equal(shown,1,'Packtisch home should show despite any session-write outage');
  assert.equal(loaded,1,'packaging remains loaded');
  assert.equal(error,'');
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

test('pack client autofills known length width and height from selected master packaging without inventing missing height',()=>{const js=read('assets/pack-notification.js');assert.match(js,/applyPackageDimensions/);assert.match(js,/selectedPackageEntry/);assert.match(js,/data-dim="length"/);assert.match(js,/data-dim="width"/);assert.match(js,/data-dim="height"/);assert.match(js,/selected\[field\]!=null/);assert.match(js,/els\.type\.addEventListener\('change'/);});

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

test('static web app routes /pack/* to the deployable public pack asset and excludes it from SPA fallback',()=>{const config=JSON.parse(read('staticwebapp.config.json')),route=config.routes.find(r=>r.route==='/pack/*'),direct=config.routes.find(r=>r.route==='/pack.html'),asset=read('assets/pack.html');assert.ok(route);assert.equal(route.rewrite,'/assets/pack.html');assert.equal(direct&&direct.rewrite,'/assets/pack.html');assert.ok(Array.isArray(route.allowedRoles)&&route.allowedRoles.includes('anonymous'));assert.ok(config.navigationFallback.exclude.includes('/pack/*'));assert.ok(config.navigationFallback.exclude.includes('/pack.html'));assert.match(asset,/ExportHUB360 · Packmeldung/);assert.match(asset,/id="packForm"/);assert.match(asset,/\/assets\/document-reference-normalizer\.js\?v=3/);assert.match(asset,/\/assets\/pack-notification\.js\?v=\d+/);});

test('pack document selection never waits forever for optional PDF text detection',()=>{
  const js=read('assets/pack-notification.js');
  const html=read('assets/pack.html');
  assert.match(js,/async function optionalPdfNaming\(file\)/);
  assert.match(js,/Promise\.race\(/);
  assert.match(js,/setTimeout\(\(\)=>resolve\(fallback\),2000\)/);
  assert.doesNotMatch(js,/file\.size>2\*1024\*1024/,'large allowed SalesPackingSlip PDFs must also be inspected');
  assert.match(js,/const data=await readFileDataUrl\(file\)/);
  assert.match(js,/const naming=await optionalPdfNaming\(file\)/);
  assert.match(js,/MAX_PACK_DOCUMENT_BYTES=10\*1024\*1024/);
  assert.match(html,/pack-notification\.js\?v=\d+/,'deployed pack asset must load the new client');
});


test('Packmeldung uses repeatable package type / quantity / group weight lines in both public pages',()=>{
  for(const page of ['pack.html','assets/pack.html']){
    const html=read(page);
    assert.match(html,/id="packEntryRows"/);
    assert.match(html,/id="packAddPackage"/);
    assert.match(html,/id="packEntryTotals"/);
    assert.ok(html.indexOf('id="packEntryRows"')<html.indexOf('id="packStepDimensions"'));
    assert.doesNotMatch(html,/id="packCountPlus"|id="packCountMinus"/);
  }
  const js=read('assets/pack-notification.js');
  assert.match(js,/function entriesFromPackages/);
  assert.match(js,/function renderEntries/);
  assert.match(js,/function syncEntrySummary/);
  assert.match(js,/function entriesValid/);
  assert.match(js,/data-entry-type/);
  assert.match(js,/data-entry-count/);
  assert.match(js,/data-entry-weight/);
  assert.match(js,/data-entry-remove/);
  assert.match(js,/weight:groupWeight\/count/);
  assert.match(read('assets/pack-notification.css'),/\.pack-entry-fields/);
});


test('Packmeldung follows the same visible Colli sequence as Sendung erstellen (RC1903)',()=>{
  const shipment=read('assets/rc1903-neue-erfassung.js'),pack=read('assets/pack-notification.js');
  const names=shipment.match(/var names=\[([^\]]+)\]/);
  assert.ok(names,'canonical shipment form must declare its Colli fields');
  assert.deepEqual(names[1].replace(/'/g,'').split(',').map(x=>x.trim()),['type','count','weight','ldm','l','w','h']);
  for(const page of ['pack.html','assets/pack.html']){
    const html=read(page);
    assert.match(html,/id="packEntryRows"/);
    assert.doesNotMatch(html,/data-pack-step="dimensions"/,'dimension entry must not be a separate visible step');
    assert.match(html,/id="packStepDimensions"[^>]*hidden/,'legacy compatible dimensions container stays hidden');
  }
  for(const field of ['type','count','weight','ldm','length','width','height']){
    assert.match(pack,new RegExp('data-entry-'+field),'entry field '+field+' must exist in the same line');
  }
  assert.match(pack,/function fillEntryDimensions/);
  assert.match(pack,/function entriesFromPackages/);
  assert.match(pack,/function collectPackages/);
  assert.match(pack,/const groupWeight=positive\(group\.weight\)/);
});
