import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtimePath='assets/rc1532-customs-ai.js';
const packPath='assets/i18n/rc1532-customs-ai.js';
const apiPath='api/customs-ai/index.js';
const deterministicPath='api/shared/customs-ai-deterministic.js';
const servicePath='api/shared/customs-ai-service.js';

test('RC1532 i18n: Zoll-KI Featurepaket deckt alle sechs UI-Sprachen mit identischen Keys ab',()=>{
  assert.equal(fs.existsSync(packPath),true,'RC1532 Feature-Sprachpaket fehlt');
  const source=fs.readFileSync(packPath,'utf8');
  const sandbox={console,Intl,URL,setTimeout,clearTimeout};
  vm.runInNewContext(source,sandbox,{filename:packPath});
  const api=sandbox.ExportHUBRC1532I18n;
  assert.ok(api&&api.packs&&typeof api.t==='function','RC1532 Feature-i18n API fehlt');
  const langs=['de','en','pl','es','fr','it'];
  const base=Object.keys(api.packs.de||{}).sort();
  assert.ok(base.length>=25,'Zu wenige RC1532 Übersetzungen');
  for(const lang of langs){
    assert.ok(api.packs[lang],lang+' Sprachpaket fehlt');
    assert.deepEqual(Object.keys(api.packs[lang]).sort(),base,lang+' Key-Satz weicht ab');
    for(const key of base)assert.equal(typeof api.packs[lang][key]==='string'&&api.packs[lang][key].trim().length>0,true,lang+' leer: '+key);
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
