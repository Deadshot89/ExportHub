import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const spec=fs.readFileSync('e2e/specs/taskplanner-v2-production.spec.mjs','utf8');

test('RC1554: Production-Gate zählt ausschließlich echte Task-Karten',()=>{
  assert.match(
    spec,
    /taskCount:list\.querySelectorAll\('\.tpv2-task-card\[data-task-id="rc1547-prod-smoke"\]'\)\.length/,
    'Der Live-Gate-Count muss die Task-Karte selektieren, nicht alle Elemente mit derselben data-task-id.'
  );
  assert.doesNotMatch(
    spec,
    /taskCount:list\.querySelectorAll\('\[data-task-id="rc1547-prod-smoke"\]'\)\.length/,
    'Der breite Selector zählt zusätzlich den Detail-Button und erzeugt einen falschen Doppel-Task.'
  );
});
