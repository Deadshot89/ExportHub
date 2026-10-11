import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadPackI18n(){
  const files=[
    'assets/i18n/pack-notification.js',
    'assets/i18n/pack-notification-draft-bridge.js',
    'assets/i18n/pack-notification-drafts.js',
    'assets/i18n/pack-notification-draft-contract.js'
  ];
  const root={};
  const context=vm.createContext({window:root,globalThis:root,console,Intl,URL,setTimeout,clearTimeout});
  for(const file of files)vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  return root.ExportHUBPackI18n;
}

test('pack notification locale runtime exposes all six supported languages with identical keys',()=>{
  const runtime=loadPackI18n();
  assert.ok(runtime);
  assert.deepEqual(Array.from(runtime.supported),['de','en','pl','es','fr','it']);
  const base=Object.keys(runtime.packs.de).sort();
  assert.ok(base.length>=70,'pack locale catalog unexpectedly small');
  for(const lang of runtime.supported){
    assert.deepEqual(Object.keys(runtime.packs[lang]).sort(),base,`${lang}: translation-key contract differs from German base`);
    for(const key of base)assert.ok(String(runtime.packs[lang][key]||'').trim(),`${lang}: empty translation for ${key}`);
  }
});

test('pack notification locale runtime translates public, AVIS, internal and draft UI contracts',()=>{
  const runtime=loadPackI18n();
  for(const lang of runtime.supported){
    for(const key of ['pack.title','pack.submit','pack.avis.title','pack.internal.inboxTitle','pack.internal.createShipment','pack.api.PACK_SESSION_NOT_FOUND','pack.draft.openShipments','pack.draft.save','pack.draft.continue','pack.api.PACK_DRAFT_NOT_FOUND','pack.api.PACK_DOCUMENT_REQUIRED']){
      assert.notEqual(runtime.packs[lang][key],undefined,`${lang}: missing ${key}`);
    }
  }
  assert.equal(runtime.t('pack.packageNumber',{number:3},'de'),'Packstück 3');
  assert.equal(runtime.t('pack.packageNumber',{number:3},'en'),'Package 3');
  assert.equal(runtime.t('pack.draft.packageCountLabel',{},'de'),'Anzahl Paletten');
  assert.equal(runtime.t('pack.draft.packageCountLabel',{},'en'),'Number of pallets');
  assert.equal(runtime.t('pack.draft.deliveryRequirement',{},'de'),'Mindestens einen Lieferschein hochladen.');
});

test('public and internal builds load pack locale runtime before pack UI runtimes',()=>{
  const page=fs.readFileSync('pack.html','utf8');
  const builder=fs.readFileSync('.github/packmeldungen/build-three-env.mjs','utf8');
  const coreI18n=page.indexOf('/assets/i18n/pack-notification.js');
  const bridge=page.indexOf('/assets/i18n/pack-notification-draft-bridge.js');
  const draftI18n=page.indexOf('/assets/i18n/pack-notification-drafts.js');
  const draftContract=page.indexOf('/assets/i18n/pack-notification-draft-contract.js');
  const publicClient=page.indexOf('/assets/pack-notification.js');
  assert.ok(coreI18n>=0);
  assert.ok(bridge>coreI18n,'draft bridge must load after core pack locale runtime');
  assert.ok(draftI18n>bridge,'draft locale extension must load after draft bridge');
  assert.ok(draftContract>draftI18n,'current draft contract must load after legacy draft translations');
  assert.ok(publicClient>draftContract,'pack client must load after complete draft locale runtime');
  const i18nScript=builder.indexOf('<script id="exporthub-pack-notification-i18n"');
  const internalScript=builder.indexOf('<script id="exporthub-pack-notification-internal"');
  assert.ok(i18nScript>=0,'pack i18n script injection missing');
  assert.ok(internalScript>=0,'pack internal script injection missing');
  assert.ok(i18nScript<internalScript,'pack locale runtime must load before internal pack UI runtime');
});
