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

test('RC1499: Exportexperte runtime loads feature i18n and contains no new German UI fallbacks',()=>{
  const runtime=fs.readFileSync(runtimePath,'utf8');
  assert.match(runtime,/\/assets\/i18n\/rc1499-exportexperte\.js\?v=1499/,'Feature-Sprachpaket wird nicht geladen');
  assert.match(runtime,/ExportHUBRC1499I18n/,'Feature-Sprach-API wird nicht verwendet');
  for(const literal of [
    'Wähle den passenden Einstieg.',
    'Aus Sendung',
    'Rechnung analysieren',
    'Noch zu prüfen',
    'Gruppierte Daten für die Zollanmeldung',
    'Daten für Zollportal',
    'Der bestehende Sendungs-ABD-Ablauf ist derzeit nicht verfügbar.'
  ])assert.equal(runtime.includes(literal),false,'Hardcoded UI-Text verbleibt: '+literal);
});
