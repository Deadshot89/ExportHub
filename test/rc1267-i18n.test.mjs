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


test('RC1451: mail textareas can never be classified or persisted as shipment goods description',()=>{
  const classify=runtime.slice(runtime.indexOf('function shipmentDraftField('),runtime.indexOf('function shipmentIdentity('));
  const snapshot=runtime.slice(runtime.indexOf('function snapshotShipmentDraft('),runtime.indexOf('function syncApplicationLanguage('));
  assert.match(classify,/#rc543MailArea|#rc363BlockMail/,'mail area exclusion is missing in shipmentDraftField');
  assert.match(snapshot,/#rc543MailArea|#rc363BlockMail/,'mail area exclusion is missing in shipment draft snapshot');
  assert.doesNotMatch(classify,/if\(\/goodsdescription\|goods-description\|description\/\.test\(explicit\)\)/,'generic description substring classifier must be removed');
  assert.match(classify,/\^\(\?:goodsdescription\|goods-description\|description\|warenbeschreibung\)\$/,'goods description identifiers must be exact matches');
});


test('RC1451: already corrupted mail text is repaired in shipment state and persisted once',()=>{
  assert.match(runtime,/function mailLikeGoodsDescription\(/);
  assert.match(runtime,/function repairContaminatedGoodsDescription\(/);
  assert.match(runtime,/\['goodsDescription','description','warenbeschreibung'\]/,'repair must cover every goods-description alias');
  assert.match(runtime,/shipment\[key\]=''/,'contaminated aliases must be cleared');
  assert.match(runtime,/ExportHUBRC565[\s\S]*?persistShipment/,'repair must persist through the shipment persistence bridge');
  assert.match(runtime,/exporthub:state-loaded[\s\S]*?repairContaminatedGoodsDescription/,'repair must run when shared state is loaded');
});


test('RC1453: production hotfix permanently removes historic mail text from 7YJUPL and 4UXU92',()=>{
  assert.match(runtime,/RC1453_TARGET_REFS=Object\.freeze\(\['7YJUPL','4UXU92'\]\)/,'target references missing');
  assert.match(runtime,/function rc1453RepairHistoricMailDescriptions\(/,'targeted cleanup function missing');
  assert.match(runtime,/\['shipments','savedShipments','salesSharedShipments','sharedShipments'\]/,'all shipment collections must be checked');
  assert.match(runtime,/\/api\/exporthub-state\?mode=read&full=1/,'repair must read the current production state first');
  assert.match(runtime,/\/api\/exporthub-state\?mode=save&ack=1/,'repair must persist the cleaned production state');
  assert.match(runtime,/mailLikeGoodsDescription\(item\[key\]\)/,'only mail-like contamination may be removed');
  assert.match(runtime,/baseRevision:Number\(readData\.revision\|\|0\)/,'repair must save against the read revision');
  assert.match(runtime,/rc1453VerifyHistoricMailDescriptions\(/,'repair must verify the two references after save');
});
