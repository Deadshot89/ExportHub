import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const locales=['de','en','pl','es','fr','it'];
const packs=Object.fromEntries(locales.map(lang=>[
  lang,JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'))
]));
const testPage=fs.readFileSync('TESTVERSION.html','utf8');
const keys=Object.keys(packs.de).filter(key=>key.startsWith('legacyUi.audit.')).sort();

test('Selected visible TESTVERSION labels have complete six-language translations',()=>{
  assert.equal(keys.length,16);
  for(const key of keys){
    const source=packs.de[key];
    assert.ok(testPage.includes(source),'Visible German source text is absent: '+key);
    for(const lang of locales){
      assert.equal(typeof packs[lang][key],'string',lang+': key is missing '+key);
      assert.ok(packs[lang][key].trim(),lang+': translation is empty '+key);
    }
  }
});

test('Selected audit labels keep a source-language mapping for the existing translation runtime',()=>{
  const uniqueSources=new Set(keys.map(key=>packs.de[key]));
  assert.equal(uniqueSources.size,keys.length,'Different labels must not collapse onto the same German source');
  const runtime=fs.readFileSync('assets/rc1267-i18n.js','utf8');
  assert.match(runtime,/function buildSourceIndex\(/);
  assert.match(runtime,/sourceByText\[value\]=key/);
  assert.match(runtime,/function translateLegacyValue\(/);
});
