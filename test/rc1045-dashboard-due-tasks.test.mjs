import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rc1044=fs.readFileSync('.github/rc1044/build-three-env.mjs','utf8');
const rc1045=fs.readFileSync('.github/rc1045/build-three-env.mjs','utf8');

test('Fällige Aufgaben verwenden nie createdAt als Fälligkeit',()=>{
  assert.match(rc1044,/workspaceTaskDate\(t\).*dueDate.*plannedDate.*targetDate.*deadline/s);
  assert.doesNotMatch(rc1044,/workspaceTaskDate\(t\).*createdAt/s);
});

test('Persönlicher Arbeitsfokus filtert Aufgaben nach Benutzer und aktueller Woche',()=>{
  assert.match(rc1044,/workspaceTaskForUser\(t\) && workspaceTaskVisible\(t\)/);
  assert.match(rc1044,/function workspaceTaskBacklog\(t\)/);
  assert.match(rc1044,/function workspaceIsoWeek\(d\)/);
});

test('Rückstand und heutige bzw. überfällige Aufgaben zählen als fällig',()=>{
  assert.match(rc1044,/if\(workspaceTaskBacklog\(t\)\)return true/);
  assert.match(rc1044,/dayKey\(d\)<=todayKey\(\)/);
  assert.match(rc1044,/return idx<=today&&today<=5/);
});

test('Kern-Dashboard fällt bei keinem Treffer nicht mehr auf fremde Aufgaben zurück',()=>{
  assert.match(rc1044,/\.filter\(taskForUser\);/);
  assert.doesNotMatch(rc1044,/owned=tasks\.filter\(taskForUser\);if\(owned\.length\)tasks=owned/);
});

test('RC1045 verweigert Release ohne korrigierte Aufgabenlogik',()=>{
  assert.match(rc1045,/fällige Aufgaben nutzen kein echtes Fälligkeitsdatum/);
  assert.match(rc1045,/persönlicher Aufgabenfilter fehlt/);
  assert.match(rc1045,/Aufgaben-Dashboard fällt auf fremde Aufgaben zurück/);
});
