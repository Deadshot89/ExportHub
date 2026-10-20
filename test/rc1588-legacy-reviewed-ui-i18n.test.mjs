import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const languages=['de','en','pl','es','fr','it'];
const packs=Object.fromEntries(languages.map(lang=>[
  lang,JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'))
]));
const primary=fs.readFileSync('TESTVERSION.html','utf8');
const keys=Object.keys(packs.de).filter(key=>key.startsWith('legacyUi.review.')).sort();

test('Confirmed account, report, privacy and customer notice labels exist in the source and all languages',()=>{
  assert.equal(keys.length,18,'Review only the selected, verified UI messages');
  for(const key of keys){
    const german=packs.de[key];
    assert.ok(primary.includes(german),'Missing UI source text: '+key);
    for(const lang of languages){
      assert.equal(typeof packs[lang][key],'string',lang+' missing '+key);
      assert.ok(packs[lang][key].trim(),lang+' blank '+key);
    }
  }
});

test('Source-text translation still uses the existing runtime, without changing shipment or Avis operations',()=>{
  const runtime=fs.readFileSync('assets/rc1267-i18n.js','utf8');
  assert.match(runtime,/function buildSourceIndex\(/);
  assert.match(runtime,/sourceByText\[value\]=key/);
  assert.match(runtime,/function translateLegacyValue\(/);
  assert.ok(primary.includes('Kunden-Avis konnte nicht geändert werden.'));
  assert.ok(primary.includes('Der Lieferavis ist nach der Abholung geschlossen und kann nicht erneut aktiviert werden.'));
});
