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


test('RC1335: i18n batches DOM translation and avoids no-op DOM writes',()=>{
  assert.match(runtime,/function scheduleTranslateFlush\(/);
  assert.match(runtime,/function queueTranslateRoot\(/);
  assert.match(runtime,/function queueFullTranslation\(/);
  assert.match(runtime,/requestAnimationFrame/);
  assert.match(runtime,/if\(el\.textContent!==value\)el\.textContent=value/);
  assert.match(runtime,/el\.getAttribute\(target\)!==value/);
  assert.match(runtime,/el\.getAttribute\(attr\)!==String\(next\)/);
  assert.match(runtime,/if\(node\.nodeType===1\)queueTranslateRoot\(node\)/);
  assert.match(runtime,/if\(d\.body\)queueFullTranslation\(\)/);
  const stateEvents=runtime.match(/\['exporthub:state-loaded'[\s\S]*?\}\);/)?.[0]||'';
  assert.doesNotMatch(stateEvents,/translate\(d\.body,current\)/);
});


test('RC1354: language switch preserves the live shipment remark before any legacy rerender',()=>{
  assert.match(runtime,/function snapshotShipmentDraft\(\)/);
  assert.match(runtime,/shipment\.comments=values\.comments/);
  assert.match(runtime,/shipment\.remarks=values\.comments/);
  assert.match(runtime,/function captureLanguageChange\(event\)/);
  assert.match(runtime,/d\.addEventListener\('change',captureLanguageChange,true\)/);
  assert.match(runtime,/event\.stopImmediatePropagation/);
  assert.match(runtime,/syncApplicationLanguage\(next\)/);
  assert.match(runtime,/snapshotShipmentDraft\(\);\s*var next=normalize\(lang\)/);
  for(const label of ['bemerkung','comment','uwaga','remarque','observacion','osservazioni'])assert.match(runtime,new RegExp(label));
});


test('RC1355: language switch snapshots remark into active shipment collections before rerender',()=>{
  assert.match(runtime,/function shipmentDraftTargets\(root\)/);
  assert.match(runtime,/\['shipments','savedShipments','salesSharedShipments','sharedShipments'\]/);
  assert.match(runtime,/shipment\.remark=values\.comments/);
  assert.match(runtime,/shipment\.bemerkung=values\.comments/);
  assert.match(runtime,/snapshotShipmentDraft\(\);\s*var next=normalize\(lang\)/);
});
