import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtimePath='assets/rc1294-abd-self-service.js';
const packPath='assets/i18n/rc1499-exportexperte.js';

test('RC1499: Exportexperte feature i18n covers all six UI languages with identical keys',()=>{
  assert.equal(fs.existsSync(packPath),true,'Feature-Sprachpaket fehlt');
  const source=fs.readFileSync(packPath,'utf8');
  const sandbox={console,Intl,URL,setTimeout,clearTimeout};
  vm.runInNewContext(source,sandbox,{filename:packPath});
  const api=sandbox.ExportHUBRC1499I18n;
  assert.ok(api&&api.packs&&typeof api.t==='function','Feature-i18n API fehlt');
  const langs=['de','en','pl','es','fr','it'];
  const base=Object.keys(api.packs.de||{}).sort();
  assert.ok(base.length>=25,'Zu wenige Exportexperte-Übersetzungen');
  for(const lang of langs){
    assert.ok(api.packs[lang],lang+' Sprachpaket fehlt');
    assert.deepEqual(Object.keys(api.packs[lang]).sort(),base,lang+' Key-Satz weicht ab');
    for(const key of base)assert.equal(typeof api.packs[lang][key]==='string'&&api.packs[lang][key].trim().length>0,true,lang+' leer: '+key);
  }
});

test('RC1786: Exportexperte runtime loads all six localized offline fallback packs',()=>{
 const runtime=fs.readFileSync(runtimePath,'utf8');
 assert.match(runtime,/rc1499-exportexperte\.js\?v=\d+/,'Feature-Sprachpaket wird nicht geladen');
 assert.match(runtime,/ExportHUBRC1499I18n/,'Feature-Sprach-API wird nicht verwendet');
 const begin=runtime.indexOf('var languageFallback={'),end=runtime.indexOf('function xtr(',begin);
 assert.ok(begin>=0&&end>begin,'Fallback-Sprachpakete fehlen');
 const isolated={};
 vm.runInNewContext(runtime.slice(begin,end)+'\nthis.fallback=languageFallback;',isolated);
 const fallback=isolated.fallback;
 const packSource=fs.readFileSync(packPath,'utf8');
 const original={console,Intl,URL,setTimeout,clearTimeout};
 vm.runInNewContext(packSource,original,{filename:packPath});
 const expected=original.ExportHUBRC1499I18n.packs;
 const languages=['de','en','pl','es','fr','it'];
 const required=Object.keys(fallback.de).sort();
 assert.ok(required.length>=15,'Zu wenig Fallback-Texte für den Upload');
 for(const language of languages){
  assert.ok(fallback[language],language+' Fallback fehlt');
  assert.deepEqual(Object.keys(fallback[language]).sort(),required,language+' Fallback-Schlüssel nicht vollständig');
  for(const key of required)assert.equal(fallback[language][key],expected[language][key],language+'.'+key+' weicht vom Sprachpaket ab');
 }
 assert.ok(runtime.includes('return pack[key]||key'),'Fallback wird nicht verwendet');
 assert.ok(!runtime.includes('if(!ensureFeatureI18n())return false'),'Dateiauswahl darf nicht auf optionales Sprachpaket warten');
});

test('RC1499: handoff loader waits for analysis results and does not create abort-prone navigation requests',()=>{
  const source=fs.readFileSync(packPath,'utf8');
  let hasResults=false,observerCallback=null;
  const appended=[];
  class MutationObserver{
    constructor(callback){observerCallback=callback}
    observe(){}
    disconnect(){}
  }
  const document={
    documentElement:{},
    head:{appendChild(node){appended.push(node)}},
    querySelector(selector){
      if(selector!=='[data-rc1294-results]')return null;
      return hasResults?{hidden:false,querySelector(inner){return inner==='.rc1294-document'?{}:null}}:null;
    },
    getElementById(){return null},
    createElement(tag){return{tagName:String(tag).toUpperCase(),id:'',src:'',async:false,addEventListener(){},remove(){}}}
  };
  const sandbox={console,Intl,URL,setTimeout,clearTimeout,document,MutationObserver};
  vm.runInNewContext(source,sandbox,{filename:packPath});
  assert.equal(appended.length,0,'Handoff-Script darf beim bloßen Betreten der ABD-Ansicht nicht laden');
  assert.equal(typeof observerCallback,'function','Analyseergebnisse werden nicht beobachtet');
  hasResults=true;observerCallback();
  assert.equal(appended.length,1,'Handoff-Script wird nach Analyseergebnissen nicht geladen');
  assert.equal(appended[0].src,'/assets/rc1499-exportexperte-handoff.js?v=1499');
  assert.equal(appended[0].async,true,'Handoff-Script soll die UI nicht blockieren');
});
