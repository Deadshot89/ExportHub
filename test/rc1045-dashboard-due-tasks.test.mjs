import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rc1044=fs.readFileSync('.github/rc1044/build-three-env.mjs','utf8');
const rc1045=fs.readFileSync('.github/rc1045/build-three-env.mjs','utf8');

test('Fällige Aufgaben verwenden ausschließlich fachliche Terminfelder',()=>{
  assert.match(rc1044,/function workspaceTaskDate\(t\)\{var keys=\['dueDate','due','date','plannedDate','targetDate','deadline'\]/);
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

test('Kern-Dashboard filtert ohne Fallback direkt auf den angemeldeten Benutzer',()=>{
  assert.match(rc1044,/const newRender="[^"]*\.filter\(taskForUser\);"/);
});

test('RC1045 verweigert Release ohne korrigierte Aufgabenlogik',()=>{
  assert.match(rc1045,/fällige Aufgaben nutzen kein echtes Fälligkeitsdatum/);
  assert.match(rc1045,/persönlicher Aufgabenfilter fehlt/);
  assert.match(rc1045,/Aufgaben-Dashboard fällt auf fremde Aufgaben zurück/);
});
