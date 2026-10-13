const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

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


test('RC1351 duplicate dynamic texts are translated once per source language and applied to every row',async()=>{
 const state={
  customers:[
   {id:'C1',processNotes:'Abholung nur über Tor 3.'},
   {id:'C2',processNotes:'Abholung nur über Tor 3.'}
  ],
  tasks:[{id:'T1',description:'Abholung nur über Tor 3.'}]
 };
 const calls=[];
 const fake=async(items,source)=>{
  calls.push({items:[...items],source});
  return items.map(original=>({original,translations:Object.fromEntries(mod.LANGUAGES.map(lang=>[lang,lang+':'+original]))}));
 };
 const report=await mod.enrichDynamicTranslations(state,'de',{translator:fake,limit:50});
 assert.equal(calls.length,1);
 assert.equal(calls[0].source,'de');
 assert.deepEqual(calls[0].items,['Abholung nur über Tor 3.']);
 assert.equal(report.attempted,3);
 assert.equal(report.completedNow,3);
 assert.equal(state.customers[0]._localizedText.processNotes.translations.en,'en:Abholung nur über Tor 3.');
 assert.equal(state.customers[1]._localizedText.processNotes.translations.en,'en:Abholung nur über Tor 3.');
 assert.equal(state.tasks[0]._localizedText.description.translations.en,'en:Abholung nur über Tor 3.');
});

test('RC1351 dedupe never crosses source-language boundaries',async()=>{
 const state={
  customers:[
   {id:'C1',processNotes:'Dock 3 only',processNotesLanguage:'en'},
   {id:'C2',processNotes:'Dock 3 only',processNotesLanguage:'de'}
  ]
 };
 const calls=[];
 const fake=async(items,source)=>{
  calls.push({items:[...items],source});
  return items.map(original=>({original,translations:Object.fromEntries(mod.LANGUAGES.map(lang=>[lang,lang+':'+source+':'+original]))}));
 };
 const report=await mod.enrichDynamicTranslations(state,'de',{translator:fake,limit:50});
 assert.equal(calls.length,2);
 assert.deepEqual(calls.map(call=>call.source).sort(),['de','en']);
 assert.ok(calls.every(call=>call.items.length===1&&call.items[0]==='Dock 3 only'));
 assert.equal(report.attempted,2);
 assert.equal(report.completedNow,2);
});

test('RC1510 dynamic i18n covers future note and hint field variants',async()=>{
 const state={customers:[{
  customerNote:'Abholung nur über Tor 3.',
  internalNote:'Vor Versand Rücksprache halten.',
  externalHint:'Fahrer zuerst am Empfang anmelden.',
  taskDescription:'Dokumente prüfen.'
 }]};
 const fake=async(items,source)=>items.map(original=>({original,translations:Object.fromEntries(mod.LANGUAGES.map(lang=>[lang,lang+':'+original]))}));
 const report=await mod.enrichDynamicTranslations(state,'de',{translator:fake,limit:20});
 const meta=state.customers[0]._localizedText;
 for(const key of ['customerNote','internalNote','externalHint','taskDescription']){
  assert.ok(meta&&meta[key],key+' must be classified as dynamic localizable text');
  assert.equal(meta[key].status,'complete');
  assert.match(meta[key].translations.en,/^en:/);
 }
 assert.equal(report.completedNow,4);
});

test('RC1510 dynamic i18n never classifies names references numbers codes or tracking identifiers',async()=>{
 const state={customers:[{
  customerName:'Essentra Components GmbH',
  referenceNumber:'ABC123',
  itemNumber:'10340967',
  trackingNumber:'1Z999AA10123456784',
  customerCode:'9000003004',
  note:'Nur diese Notiz wird übersetzt.'
 }]};
 const fake=async(items,source)=>items.map(original=>({original,translations:Object.fromEntries(mod.LANGUAGES.map(lang=>[lang,lang+':'+original]))}));
 await mod.enrichDynamicTranslations(state,'de',{translator:fake,limit:20});
 const meta=state.customers[0]._localizedText||{};
 assert.ok(meta.note);
 for(const key of ['customerName','referenceNumber','itemNumber','trackingNumber','customerCode'])assert.equal(meta[key],undefined,key+' must stay untouched');
});

test('RC1512 existing admin i18n status includes safe translator diagnostics without credentials',()=>{
 const stateApi=fs.readFileSync('api/exporthub-state/index.js','utf8');
 assert.match(stateApi,/mode==='i18n-status'/);
 assert.match(stateApi,/translation:translationStatus/,'existing admin endpoint must continue returning translationStatus');
 assert.equal(typeof mod.translatorStatus,'function','translatorStatus helper must be exported');
 const status=mod.translatorStatus();
 assert.equal(typeof status.configured,'boolean');
 assert.equal(typeof status.regionConfigured,'boolean');
 assert.equal(typeof status.provider,'string');
 assert.equal(typeof status.endpointHost,'string');
 assert.equal(Object.prototype.hasOwnProperty.call(status,'key'),false,'translator key must never be exposed');
 const publicStatus=mod.translationStatus({});
 assert.deepEqual(publicStatus.translator,status,'admin i18n status must include the safe translator diagnostics');
 const secret=String(process.env.EXPORTHUB_TRANSLATOR_KEY||process.env.AZURE_TRANSLATOR_KEY||'');
 if(secret)assert.equal(JSON.stringify(publicStatus).includes(secret),false,'translator credentials must never be serialized');
});
