import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const pack=lang=>JSON.parse(read(`assets/i18n/${lang}.json`));
const FOREIGN=['en','pl','es','fr','it'];

test('RC1730: die ergänzten Bedienelemente sind wirklich übersetzt, nicht deutsch kopiert',()=>{
  const de=pack('de'),packs=Object.fromEntries(FOREIGN.map(l=>[l,pack(l)]));
  const keys=Object.keys(de).filter(k=>k.startsWith('legacyUi.v2.'));
  assert.ok(keys.length>=250,`nur ${keys.length} ergänzte Texte`);
  for(const key of keys){
    // brand names and terms like "Audit" may stay the same in a few languages, never in all five
    const same=FOREIGN.filter(l=>packs[l][key]===de[key]);
    assert.ok(same.length<FOREIGN.length,`${key} ist in keiner Sprache übersetzt: ${de[key]}`);
    for(const l of FOREIGN)assert.ok(String(packs[l][key]||'').trim(),`${key} fehlt in ${l}`);
  }
});

test('RC1730: Zahlentexte wie "3 Treffer" laufen über legacyPattern.* mit Platzhalter',()=>{
  const de=pack('de');
  for(const key of ['legacyPattern.hits','legacyPattern.shipmentHistoryCount','legacyPattern.moreItems','legacyPattern.stowRows','legacyPattern.diagnosticsSummary']){
    assert.match(de[key],/\{\{count\}\}/,key);
  }
});

test('RC1730: die Browser-Prüfung auf deutsche Reste läuft bei Oberflächenänderungen mit',()=>{
  const workflow=read('.github/workflows/rc1511-i18n-browser.yml');
  assert.match(workflow,/rc1730-ui-language-gaps\.spec\.mjs --project=laptop/);
  assert.match(workflow,/- 'index\.html'/);
  const spec=read('e2e/specs/rc1730-ui-language-gaps.spec.mjs');
  assert.match(spec,/switchLanguage\(page,'en'\)/);
  assert.match(spec,/data-i18n-ignore/);
});
