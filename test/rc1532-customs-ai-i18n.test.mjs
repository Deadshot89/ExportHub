import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const runtimePath='assets/rc1532-customs-ai.js';
const packPath='assets/i18n/rc1532-customs-ai.js';
const serverPackPath='api/shared/i18n/customs-ai.json';
const apiPath='api/customs-ai/index.js';
const deterministicPath='api/shared/customs-ai-deterministic.js';
const servicePath='api/shared/customs-ai-service.js';
const LANGS=['de','en','pl','es','fr','it'];

function loadFeaturePack(){
  const source=fs.readFileSync(packPath,'utf8');
  const sandbox={console,Intl,URL,setTimeout,clearTimeout};
  vm.runInNewContext(source,sandbox,{filename:packPath});
  return sandbox.ExportHUBRC1532I18n;
}
function analysis(){return{
  groups:[
    {commodityCode:'39269097',originCountry:'DE',value:100,currency:'EUR',status:'complete'},
    {commodityCode:'73181595',originCountry:'CN',value:150,currency:'EUR',status:'review'}
  ],
  unassigned:[{position:'30',originCountry:'CN',value:50,currency:'EUR',missing:['commodityCode']}],
  totals:{invoiceTotal:300,accountedTotal:300,difference:0,currency:'EUR'},
  review:{complete:false,unassignedCount:1,missingHsCount:1,missingOriginCount:0,missingValueCount:0}
}}

test('RC1532 i18n: Zoll-KI Featurepaket deckt alle sechs UI-Sprachen mit identischen Keys ab',()=>{
  assert.equal(fs.existsSync(packPath),true,'RC1532 Feature-Sprachpaket fehlt');
  const api=loadFeaturePack();
  assert.ok(api&&api.packs&&typeof api.t==='function','RC1532 Feature-i18n API fehlt');
  const base=Object.keys(api.packs.de||{}).sort();
  assert.ok(base.length>=25,'Zu wenige RC1532 Übersetzungen');
  for(const lang of LANGS){
    assert.ok(api.packs[lang],lang+' Sprachpaket fehlt');
    assert.deepEqual(Object.keys(api.packs[lang]).sort(),base,lang+' Key-Satz weicht ab');
    for(const key of base)assert.equal(typeof api.packs[lang][key]==='string'&&api.packs[lang][key].trim().length>0,true,lang+' leer: '+key);
  }
});

test('RC1532 i18n: Server-Sprachpaket deckt alle sechs Sprachen mit identischen Keys ab',()=>{
  assert.equal(fs.existsSync(serverPackPath),true,'RC1532 Server-Sprachpaket fehlt');
  const packs=JSON.parse(fs.readFileSync(serverPackPath,'utf8'));
  const base=Object.keys(packs.de||{}).sort();
  assert.ok(base.length>=20,'Zu wenige RC1532 Server-Übersetzungen');
  for(const lang of LANGS){
    assert.ok(packs[lang],lang+' Server-Sprachpaket fehlt');
    assert.deepEqual(Object.keys(packs[lang]).sort(),base,lang+' Server-Key-Satz weicht ab');
    for(const key of base)assert.equal(typeof packs[lang][key]==='string'&&packs[lang][key].trim().length>0,true,lang+' Server-Text leer: '+key);
  }
});

test('RC1532 i18n: Runtime lädt Feature-i18n statt deutscher Inline-Texte',()=>{
  const runtime=fs.readFileSync(runtimePath,'utf8');
  assert.match(runtime,/\/assets\/i18n\/rc1532-customs-ai\.js\?v=1532/,'RC1532 Feature-Sprachpaket wird nicht geladen');
  assert.match(runtime,/ExportHUBRC1532I18n/,'RC1532 Feature-Sprach-API wird nicht verwendet');
  assert.doesNotMatch(runtime,/var\s+I18N\s*=/,'Inline-i18n darf nicht im Runtime-Asset verbleiben');
  for(const literal of [
    'Beratende Zollhilfe mit geprüften Quellen und direktem Rechnungs-Kontext.',
    'Beratend · keine automatische Änderung an ABD, Sendung oder Aufgabe',
    'Keine Rechnungsanalyse aktiv. Allgemeine Zollfragen sind trotzdem möglich.',
    'Welche Positionen sind noch ungeklärt?',
    'Welche Ursprungsländer sind enthalten?',
    'HS/Ursprung',
    ' offen'
  ])assert.equal(runtime.includes(literal),false,'Hardcoded UI-Text verbleibt: '+literal);
});

test('RC1532 i18n: API und deterministische Antworten verwenden die zentrale Server-Sprachauflösung',()=>{
  const endpoint=fs.readFileSync(apiPath,'utf8');
  const deterministic=fs.readFileSync(deterministicPath,'utf8');
  const service=fs.readFileSync(servicePath,'utf8');
  assert.match(endpoint,/require\(['"]\.\.\/shared\/i18n['"]\)/,'API-i18n wird im Endpunkt nicht verwendet');
  assert.match(endpoint,/language\s*:\s*apiI18n\.language\(/,'Request-Sprache wird nicht an den Zoll-KI-Service übergeben');
  assert.match(deterministic,/apiI18n\.tLang\(/,'Deterministische Antworten sind nicht serverseitig lokalisiert');
  assert.match(service,/apiI18n\.tLang\(/,'Service-Fallbacks sind nicht serverseitig lokalisiert');
});

test('RC1532 i18n: alle vier Schnellfragen funktionieren deterministisch in allen sechs Sprachen',()=>{
  const feature=loadFeaturePack();
  const deterministic=require('../api/shared/customs-ai-deterministic.js');
  const intents={quickHs:'commodity-codes',quickOpen:'unassigned',quickSum:'reconciliation',quickOrigin:'origin-countries'};
  for(const lang of LANGS){
    for(const [key,kind] of Object.entries(intents)){
      const result=deterministic.answerDeterministicCustomsQuestion({question:feature.packs[lang][key],analysis:analysis(),language:lang});
      assert.equal(result.matched,true,lang+' '+key+' wurde nicht deterministisch erkannt');
      assert.equal(result.kind,kind,lang+' '+key+' erkannte falschen Intent');
    }
  }
});
