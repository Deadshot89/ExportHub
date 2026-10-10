const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const i18n=require('../api/shared/dynamic-i18n');

function pendingMeta(original,source='de'){
 const translations={};
 i18n.LANGUAGES.forEach(lang=>{translations[lang]=lang===source?original:''});
 return {
  originalText:original,
  sourceLanguage:source,
  translations,
  translationVersion:'sha256:'+i18n.hashText(original).slice(0,16),
  sourceHash:i18n.hashText(original),
  translatedAt:null,
  translationStatus:'pending',
  status:'pending',
  translationError:'TRANSLATOR_TIMEOUT'
 };
}

test('RC1483 normal saves do not retry unchanged pending translations',async()=>{
 const original='Abholung nur über Tor 3.';
 const state={customers:[{
  id:'C1',
  processNotes:original,
  _localizedText:{processNotes:pendingMeta(original)}
 }]};
 let calls=0;
 const fake=async(items,source)=>{
  calls++;
  return items.map(value=>({original:value,translations:Object.fromEntries(i18n.LANGUAGES.map(lang=>[lang,lang===source?value:lang+':'+value]))}));
 };
 const report=await i18n.enrichDynamicTranslations(state,'de',{translator:fake,retryPending:false,limit:50});
 assert.equal(calls,0,'unchanged pending translations must not block an unrelated state save');
 assert.equal(report.attempted,0);
 assert.equal(report.pending,1);
 assert.equal(state.customers[0]._localizedText.processNotes.translationError,'TRANSLATOR_TIMEOUT');
});

test('RC1483 changed dynamic text is still translated immediately on normal save',async()=>{
 const oldText='Tor 2';
 const state={customers:[{
  id:'C1',
  processNotes:'Tor 3, zuerst am Empfang anmelden',
  _localizedText:{processNotes:pendingMeta(oldText)}
 }]};
 let calls=0;
 const fake=async(items,source)=>{
  calls++;
  return items.map(value=>({original:value,translations:Object.fromEntries(i18n.LANGUAGES.map(lang=>[lang,lang===source?value:lang+':'+value]))}));
 };
 const report=await i18n.enrichDynamicTranslations(state,'de',{translator:fake,retryPending:false,limit:50});
 assert.equal(calls,1);
 assert.equal(report.attempted,1);
 assert.equal(report.completedNow,1);
 assert.equal(state.customers[0]._localizedText.processNotes.originalText,'Tor 3, zuerst am Empfang anmelden');
 assert.equal(state.customers[0]._localizedText.processNotes.status,'complete');
});

test('RC1483 state API uses no-retry mode only for normal save path',()=>{
 const stateApi=fs.readFileSync('api/exporthub-state/index.js','utf8');
 assert.match(stateApi,/enrichDynamicTranslations\(merged,[\s\S]*?retryPending\s*:\s*false/);
 assert.match(stateApi,/mode==='i18n-migrate'/);
});
