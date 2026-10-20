import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('pod-notfall.html','utf8');
const languages=['de','en','pl','es','fr','it'];
const packs=Object.fromEntries(languages.map(code=>[
  code,JSON.parse(fs.readFileSync('assets/i18n/'+code+'.json','utf8'))
]));
const emergencyKeys=Object.keys(packs.de).filter(key=>key.startsWith('emergency.pod.')).sort();

test('POD emergency page: sixteen confirmed visible texts have six-language translations',()=>{
  assert.equal(emergencyKeys.length,16);
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
