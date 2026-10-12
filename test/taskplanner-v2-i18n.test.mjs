import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCALES,TRANSLATIONS,patchLocaleObject} from '../scripts/taskplanner-v2-i18n-pretest.mjs';

test('alle sechs Sprachen besitzen dasselbe TaskPlanner-V2-Keyset',()=>{
  const expected=Object.keys(TRANSLATIONS.de).sort();
  assert.deepEqual(Array.from(LOCALES),['de','en','pl','es','fr','it']);
  for(const locale of LOCALES){
    assert.deepEqual(Object.keys(TRANSLATIONS[locale]).sort(),expected,locale);
    for(const key of expected)assert.ok(String(TRANSLATIONS[locale][key]||'').trim(),`${locale}:${key}`);
  }
});

test('Locale-Patch bewahrt bestehende Übersetzungen und ergänzt V2-Werte',()=>{
  const original={'common.save':'Speichern','custom.keep':'bleibt'};
  const patched=patchLocaleObject('de',original);
  assert.equal(patched['common.save'],'Speichern');
  assert.equal(patched['custom.keep'],'bleibt');
  assert.equal(patched['taskV2.latestCompletion'],'Spätestens abgeschlossen bis');
  assert.equal(original['taskV2.latestCompletion'],undefined);
});
