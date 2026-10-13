import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCALES,TRANSLATIONS} from '../scripts/taskplanner-v2-projection-i18n-pretest.mjs';

test('alle sechs Sprachen besitzen dasselbe TaskPlanner-V2-Projektions-Keyset',()=>{
  assert.deepEqual(Array.from(LOCALES),['de','en','pl','es','fr','it']);
  const expected=Object.keys(TRANSLATIONS.de).sort();
  assert.equal(expected.length,27);
  for(const locale of LOCALES){
    assert.deepEqual(Object.keys(TRANSLATIONS[locale]).sort(),expected,locale+' hat ein abweichendes Keyset');
    for(const key of expected)assert.ok(String(TRANSLATIONS[locale][key]||'').trim(),locale+' '+key+' ist leer');
  }
});

test('Dashboard-, Kunden-, Archiv- und Statistik-Kerntexte sind vollständig übersetzt',()=>{
  const required=['taskV2.dashboard.title','taskV2.dashboard.today','taskV2.dashboard.week','taskV2.customer.title','taskV2.customer.history','taskV2.archive.title','taskV2.stats.title','taskV2.stats.automatic','taskV2.stats.manual'];
  for(const locale of LOCALES)for(const key of required)assert.ok(TRANSLATIONS[locale][key],locale+' fehlt '+key);
});
