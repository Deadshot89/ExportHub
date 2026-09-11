import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('assets/rc1014-task-runtime.js','utf8');
const build=fs.readFileSync('.github/rc1016/build-three-env.mjs','utf8');

test('RC1054: Task-Runtime stellt einen gemeinsamen kanonischen Aufgabenbestand bereit',()=>{
  assert.match(runtime,/function currentTasks\s*\(/,'Task-Runtime braucht eine nebenwirkungsfreie gemeinsame Aufgabenquelle');
  assert.match(runtime,/Object\.freeze\(\{[^}]*currentTasks/s,'Gemeinsame Aufgabenquelle muss für Aufgabenansicht und Planner exportiert sein');
});

test('RC1054: Aufgaben-Planner liest nicht mehr direkt aus dem alten st().tasks-Bestand',()=>{
  assert.match(build,/function patchTaskPlannerSource\s*\(/,'Release-Build muss den Planner auf die gemeinsame Aufgabenquelle umstellen');
  assert.match(build,/ExportHUBRC1014TaskRuntime\.currentTasks/,'Planner muss denselben kanonischen Runtime-Bestand wie Aufgaben verwenden');
});

test('RC1054: gemeinsame Aufgabenquelle reconciled Status und Vertretung vor der Darstellung',()=>{
  const start=runtime.indexOf('function currentTasks');
  assert.ok(start>=0,'currentTasks fehlt');
  const block=runtime.slice(start,start+1800);
  assert.match(block,/normalizeTask/,'Aufgaben müssen vor Darstellung normalisiert werden');
  assert.match(block,/reconcile/,'Aufgaben müssen vor Darstellung fachlich abgeglichen werden');
});
