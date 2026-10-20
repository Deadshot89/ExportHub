import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const langs=['de','en','pl','es','fr','it'];
const page=fs.readFileSync('location.html','utf8');
const packs=Object.fromEntries(langs.map(lang=>[lang,JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'))]));
const locationKeys=Object.keys(packs.de).filter(key=>key.startsWith('location.')).sort();

test('Location booking has complete six-language translations for its registered source texts',()=>{
  assert.equal(locationKeys.length,23,'Expected the scoped Location UI translations');
  for(const key of locationKeys){
    const german=packs.de[key];
    assert.ok(page.includes(german),'German source text missing from location.html: '+key);
    for(const lang of langs){
      assert.equal(typeof packs[lang][key],'string',lang+': '+key);
      assert.ok(packs[lang][key].trim(),lang+': empty '+key);
    }
  }
});

test('Location page retains six-language runtime without changing the booking endpoints or token protections',()=>{
  assert.match(page,/src="\/assets\/rc1267-i18n\.js\?v=1267"/);
  assert.match(page,/src="\/assets\/rc1018-public-language\.js\?v=1018"/);
  assert.match(page,/\/api\/location-booking\?action=/);
  assert.match(page,/\^\[A-Za-z0-9_-\]\{6,128\}\$/);
  assert.match(page,/method:'POST'/);
});
