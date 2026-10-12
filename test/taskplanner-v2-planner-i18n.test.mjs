import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCALES,TRANSLATIONS} from '../scripts/taskplanner-v2-planner-i18n-pretest.mjs';

test('alle sechs Sprachen besitzen dasselbe TaskPlanner-V2-Planner-Keyset',()=>{
  assert.deepEqual(LOCALES,['de','en','pl','es','fr','it']);
  const expected=Object.keys(TRANSLATIONS.de).sort();
  assert.ok(expected.length>=9);
  for(const locale of LOCALES){
    assert.deepEqual(Object.keys(TRANSLATIONS[locale]).sort(),expected,locale);
    for(const key of expected)assert.ok(String(TRANSLATIONS[locale][key]||'').trim(),`${locale}:${key}`);
  }
});

test('Planner-Kerntexte und variable Tageszusammenfassung sind vollständig vorhanden',()=>{
  const keys=TRANSLATIONS.de;
  for(const key of ['taskV2.planner.title','taskV2.planner.workweek','taskV2.planner.month','taskV2.planner.currentWeek','taskV2.planner.nextWeek','taskV2.planner.overdue','taskV2.planner.noOverdue','taskV2.planner.overload','taskV2.planner.todaySummary'])assert.ok(keys[key],key);
  assert.match(keys['taskV2.planner.todaySummary'],/\{count\}/);
  assert.match(keys['taskV2.planner.todaySummary'],/\{critical\}/);
  assert.match(keys['taskV2.planner.todaySummary'],/\{overdue\}/);
});
