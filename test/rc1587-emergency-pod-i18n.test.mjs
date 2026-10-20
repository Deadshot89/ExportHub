import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('pod-notfall.html','utf8');
const languages=['de','en','pl','es','fr','it'];
const packs=Object.fromEntries(languages.map(code=>[
  code,JSON.parse(fs.readFileSync('assets/i18n/'+code+'.json','utf8'))
]));
const emergencyKeys=Object.keys(packs.de).filter(key=>key.startsWith('emergency.pod.')).sort();

test('POD emergency page: twenty-four confirmed offline page texts have six-language translations',()=>{
  assert.equal(emergencyKeys.length,24);
  for(const key of emergencyKeys){
    assert.ok(source.includes(packs.de[key]),'German text absent from offline POD page: '+key);
    for(const lang of languages){
      assert.equal(typeof packs[lang][key],'string',lang+': missing '+key);
      assert.ok(packs[lang][key].trim(),lang+': blank '+key);
    }
  }
});

test('POD emergency page: existing offline PDF, ZIP and vault operations are retained',()=>{
  assert.match(source,/src="\/assets\/rc1267-i18n\.js\?v=[0-9]+"/);
  assert.match(source,/function openDb\(/);
  assert.match(source,/function render\(/);
  assert.match(source,/function zip\(/);
  assert.match(source,/function folderFiles\(/);
  assert.match(source,/function rowsZip\(/);
  assert.match(source,/function isPdf\(/);
  assert.match(source,/\.addEventListener\('click',loadVault\)/);
});

const dynamicStatus={
 'legacyPattern.emergencyPodVaultLoaded':' vollständige POD-Ladeliste(n) aus dem Browser-Vault geladen.',
 'legacyPattern.emergencyPodFolderLoaded':' vollständige POD-PDF(s) aus dem Notfallordner geladen. Diese Daten stehen ohne ExportHUB zur Verfügung.',
 'legacyPattern.emergencyPodZipCreated':' POD-Ladeliste(n) als ZIP erstellt.'
};
test('POD emergency page: counter-based confirmation templates are translated in all six languages',()=>{
  const matcher=fs.readFileSync('assets/rc1267-i18n.js','utf8');
  assert.match(matcher,/key\.indexOf\('legacyPattern\.'\)/);
  for(const [key,suffix] of Object.entries(dynamicStatus)){
    assert.ok(source.includes(suffix),'POD status source is missing: '+key);
    for(const lang of languages){
      assert.equal(typeof packs[lang][key],'string',lang+': pattern missing '+key);
      assert.ok(packs[lang][key].includes('{{count}}'),lang+': count placeholder missing '+key);
    }
  }
});
