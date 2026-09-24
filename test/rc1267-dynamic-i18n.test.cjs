import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const mod=require('../api/shared/dynamic-i18n');

test('RC1267 dynamic i18n preserves original and stores all six translations',async()=>{
 const state={customers:[{id:'C1',processNotes:'Abholung nur über Tor 3.'}]};
 const fake=async(items,source)=>items.map(original=>({original,translations:{
  de:source==='de'?original:'DE '+original,
  en:'EN '+original,pl:'PL '+original,es:'ES '+original,fr:'FR '+original,it:'IT '+original
 }}));
 const report=await mod.enrichDynamicTranslations(state,'de',{translator:fake,limit:10});
 assert.equal(state.customers[0].processNotes,'Abholung nur über Tor 3.');
 const meta=state.customers[0]._localizedText.processNotes;
 assert.equal(meta.originalText,'Abholung nur über Tor 3.');
 assert.equal(meta.sourceLanguage,'de');
 assert.equal(meta.status,'complete');
 assert.ok(meta.translatedAt);
 assert.deepEqual(Object.keys(meta.translations).sort(),['de','en','es','fr','it','pl']);
 assert.equal(mod.localizedValue(state.customers[0],'processNotes','pl'),'PL Abholung nur über Tor 3.');
 assert.equal(report.complete,1);
});

test('RC1267 dynamic i18n invalidates stale translation when original changes',async()=>{
 const state={customers:[{processNotes:'Tor 2'}]};
 const fake=async(items,source)=>items.map(original=>({original,translations:Object.fromEntries(mod.LANGUAGES.map(l=>[l,l+':'+original]))}));
 await mod.enrichDynamicTranslations(state,'de',{translator:fake});
 const first=state.customers[0]._localizedText.processNotes.translationVersion;
 state.customers[0].processNotes='Tor 3, zuerst am Empfang anmelden';
 await mod.enrichDynamicTranslations(state,'de',{translator:fake});
 const meta=state.customers[0]._localizedText.processNotes;
 assert.notEqual(meta.translationVersion,first);
 assert.equal(meta.originalText,'Tor 3, zuerst am Empfang anmelden');
 assert.match(meta.translations.en,/Tor 3/);
});

test('RC1267 translation outage never overwrites dynamic source text',async()=>{
 const state={tasks:[{description:'Rampe prüfen'}]};
 const report=await mod.enrichDynamicTranslations(state,'de',{translator:async()=>{const e=new Error('offline');e.code='TRANSLATOR_OFFLINE';throw e}});
 assert.equal(state.tasks[0].description,'Rampe prüfen');
 const meta=state.tasks[0]._localizedText.description;
 assert.equal(meta.status,'pending');
 assert.equal(meta.translations.de,'Rampe prüfen');
 assert.equal(meta.translationError,'TRANSLATOR_OFFLINE');
 assert.equal(report.failedNow,1);
});

test('RC1267 state API wires translation into normal saves and exposes admin migration/status',()=>{
 const stateApi=fs.readFileSync('api/exporthub-state/index.js','utf8');
 assert.match(stateApi,/enrichDynamicTranslations/);
 assert.match(stateApi,/mode==='i18n-status'/);
 assert.match(stateApi,/mode==='i18n-migrate'/);
 assert.match(stateApi,/EXPORTHUB_I18N_SAVE_LIMIT/);
 assert.match(stateApi,/ADMIN_REQUIRED/);
});

test('RC1267 browser runtime renders sidecar translations without mutating application state',()=>{
 const runtime=fs.readFileSync('assets/rc1267-i18n.js','utf8');
 assert.match(runtime,/buildDynamicIndex/);
 assert.match(runtime,/dynamicByText/);
 assert.match(runtime,/localized:localized/);
 assert.match(runtime,/exporthub:state-loaded/);
 assert.doesNotMatch(runtime,/record\[key\]\s*=/);
});
