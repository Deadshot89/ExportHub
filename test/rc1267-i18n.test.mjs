import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const LANGS=['de','en','pl','es','fr','it'];
const read=(p)=>fs.readFileSync(p,'utf8');
const packs=Object.fromEntries(LANGS.map((lang)=>[lang,JSON.parse(read('assets/i18n/'+lang+'.json'))]));
const runtime=read('assets/rc1267-i18n.js');
const builder=read('.github/rc1112/build-three-env.mjs');
const auth=read('api/exporthub-auth/index.js');
const userPolicy=read('api/shared/user-policy.js');
const profile=read('assets/rc1079-profile-settings.js');

test('RC1267: all six language packs have identical non-empty keys',()=>{
  const base=Object.keys(packs.de).sort();
  assert.ok(base.length>=200,'too few translation keys');
  for(const lang of LANGS){
    assert.deepEqual(Object.keys(packs[lang]).sort(),base,lang+' key mismatch');
    for(const key of base)assert.equal(typeof packs[lang][key]==='string'&&packs[lang][key].trim().length>0,true,lang+': '+key+' empty');
  }
});

test('RC1267: runtime supports persistence profile priority six languages and locale formatting',()=>{
  assert.match(runtime,/SUPPORTED=Object\.freeze\(\['de','en','pl','es','fr','it'\]\)/);
  assert.match(runtime,/localStorage/);
  assert.match(runtime,/profileLanguage\(\)/);
  assert.match(runtime,/formatDate/);
  assert.match(runtime,/formatNumber/);
  assert.match(runtime,/formatCurrency/);
  assert.match(runtime,/MutationObserver/);
  assert.match(runtime,/data-i18n/);
});

test('RC1267: language selector carries the six user-facing language labels',()=>{
  for(const label of ['Deutsch','English','Polski','Español','Français','Italiano'])assert.match(runtime,new RegExp(label));
});

test('RC1267: profile and backend persist all six codes',()=>{
  assert.match(auth,/normalizeProfileLanguage/);
  assert.match(auth,/de\|en\|pl\|es\|fr\|it/);
  assert.match(userPolicy,/normalizeLanguage/);
  assert.match(profile,/SUPPORTED_LANGUAGES=\['de','en','pl','es','fr','it'\]/);
  assert.match(profile,/ExportHUBI18n/);
  assert.doesNotMatch(profile,/low\(language\)==='en'\?'en':'de'/);
});

test('RC1267: release build copies and injects central i18n',()=>{
  assert.match(builder,/assets\/rc1267-i18n\.js/);
  assert.match(builder,/assets\/i18n/);
  assert.match(builder,/RC1267_I18N_TAG/);
  for(const page of ['customer-avis.html','pickup.html','location.html'])assert.match(read(page),/exporthub-rc1267-i18n/);
});

test('RC1267: legacy public runtime delegates to central i18n',()=>{
  const legacy=read('assets/rc1018-public-language.js');
  assert.match(legacy,/RC1267-compat/);
  assert.match(legacy,/window\.ExportHUBI18n\.setLanguage/);
});
