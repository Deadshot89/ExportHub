import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadPackI18n(){
  const source=fs.readFileSync('assets/i18n/pack-notification.js','utf8');
  const root={};
  const context=vm.createContext({window:root,globalThis:root,console,Intl,URL,setTimeout,clearTimeout});
  vm.runInContext(source,context,{filename:'assets/i18n/pack-notification.js'});
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

test('pack notification locale runtime translates public, AVIS and internal UI contracts',()=>{
  const runtime=loadPackI18n();
  for(const lang of runtime.supported){
    for(const key of ['pack.title','pack.submit','pack.avis.title','pack.internal.inboxTitle','pack.internal.createShipment','pack.api.PACK_SESSION_NOT_FOUND']){
      assert.notEqual(runtime.packs[lang][key],undefined,`${lang}: missing ${key}`);
    }
  }
  assert.equal(runtime.t('pack.packageNumber',{number:3},'de'),'Packstück 3');
  assert.equal(runtime.t('pack.packageNumber',{number:3},'en'),'Package 3');
});

test('public and internal builds load pack locale runtime before pack UI runtimes',()=>{
  const page=fs.readFileSync('pack.html','utf8');
  const builder=fs.readFileSync('.github/packmeldungen/build-three-env.mjs','utf8');
  assert.ok(page.indexOf('/assets/i18n/pack-notification.js')>=0);
  assert.ok(page.indexOf('/assets/i18n/pack-notification.js')<page.indexOf('/assets/pack-notification.js'));
  assert.ok(builder.indexOf('exporthub-pack-notification-i18n')>=0);
  assert.ok(builder.indexOf('exporthub-pack-notification-i18n')<builder.indexOf('exporthub-pack-notification-internal'));
});
