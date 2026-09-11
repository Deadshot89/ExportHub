import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('.github/rc1046/build-three-env.mjs','utf8');

test('RC1046 Fälligkeit nutzt kein createdAt',()=>{
  assert.match(src,/workspaceTaskDueDate/);
  assert.match(src,/\['dueDate','due','date','plannedDate','targetDate'\]/);
  const dueBlock=src.slice(src.indexOf('function workspaceTaskDueDate'),src.indexOf('function workspaceWeekdayIndex'));
  assert.doesNotMatch(dueBlock,/createdAt/);
});

test('RC1046 persönlicher Arbeitsplatz zeigt nur eigene oder Alle-Aufgaben',()=>{
  assert.match(src,/workspaceTaskForCurrentUser/);
  assert.match(src,/workspaceTaskCurrentWeekVisible/);
  assert.match(src,/!isDone\(t\) && workspaceTaskForCurrentUser\(t\) && workspaceTaskCurrentWeekVisible\(t\)/);
});

test('RC1046 Rückstand und Wochentag werden korrekt als fällig behandelt',()=>{
  assert.match(src,/workspaceTaskBacklog\(t\)\)return true/);
  assert.match(src,/workspaceWeekdayIndex/);
  assert.match(src,/ti>0&&ci<=5&&ti<=ci/);
});

test('RC1046 zentrale Meine-Aufgaben-Kachel fällt nie auf fremde Benutzer zurück',()=>{
  assert.match(src,/\.filter\(taskForUser\);/);
  assert.doesNotMatch(src,/owned=tasks\.filter\(taskForUser\);if\(owned\.length\)tasks=owned/);
});

test('RC1046 patcht Produktion TESTSERVICE und Demo',()=>{
  assert.match(src,/html=patchDashboardDueTasks\(html,file\)/);
  assert.match(src,/for\(const file of \['index\.html','TESTVERSION\.html','demo\.html'\]\)patchHtml\(file\)/);
});
