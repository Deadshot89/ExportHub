import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const runtime=fs.readFileSync('assets/rc1014-task-runtime.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const css=fs.readFileSync('assets/rc1014-task-ui.css','utf8');

test('RC1179: Navigation erhält Aufgabenansicht direkt hinter Aufgaben mit demselben Recht',()=>{
  assert.match(build,/view:['"]taskdetail['"],label:['"]Aufgabenansicht['"],right:['"]tasks['"]/);
  assert.match(build,/const taskAt=list\.indexOf\("view:'tasks'"\)/);
  assert.match(build,/taskEnd\+1/);
});

test('RC1179: Direktroute rendert die Aufgabenansicht in #content',()=>{
  assert.match(build,/view==='taskdetail'/);
  assert.match(build,/ExportHUBRC1014TaskRuntime\.renderTaskDetailView/);
  assert.match(build,/document\.getElementById\('content'\)/);
  assert.match(runtime,/host\.appendChild\(panel\)/);
});

test('RC1179: Öffnen merkt nur Routing-Kontext in browser history und wechselt in taskdetail',()=>{
  assert.doesNotMatch(runtime,/sessionStorage\.setItem\([^)]*task/i);
  assert.match(runtime,/history\.replaceState/);
  assert.match(runtime,/exporthubTaskId/);
  assert.match(runtime,/root\.setView\('taskdetail'\)/);
  assert.match(runtime,/root\.setView\('tasks'\)/);
});

test('RC1179: Aufgabenansicht bleibt responsive und eingebettet',()=>{
  assert.match(css,/data-rc1179-task-view/);
  assert.match(css,/position:relative/);
  assert.match(css,/@media \(max-width:640px\)/);
});

test('RC1179: geänderte JavaScript-Dateien sind syntaktisch gültig',()=>{
  for(const file of ['assets/rc1014-task-runtime.js','.github/rc1112/build-three-env.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
