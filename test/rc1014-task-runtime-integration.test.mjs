import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

function build(){
  execFileSync(process.execPath,['.github/rc1014/build-three-env.mjs'],{stdio:'pipe'});
}

function read(rel){return fs.readFileSync(rel,'utf8');}

function taskBlock(html){
  const start=html.indexOf('function tasks(){');
  assert.ok(start>=0,'tasks() fehlt');
  const end=html.indexOf('function taskSortRC67',start);
  assert.ok(end>start,'Ende des aktiven Aufgabenblocks fehlt');
  return html.slice(start,end);
}

function loadRuntime(){
  const context={};
  context.globalThis=context;
  vm.runInNewContext(read('assets/rc1014-task-lifecycle.js'),context,{filename:'lifecycle.js'});
  vm.runInNewContext(read('assets/rc1014-task-runtime.js'),context,{filename:'runtime.js'});
  return context.ExportHUBRC1014TaskRuntime;
}

test('RC1014 Build bindet Lifecycle und Runtime in Produktion TESTSERVICE und Demo ein',()=>{
  build();
  for(const file of ['dist-rc1014/index.html','dist-rc1014/TESTVERSION.html','dist-rc1014/demo.html']){
    const html=read(file);
    assert.match(html,/assets\/rc1014-task-lifecycle\.js\?v=1014/);
    assert.match(html,/assets\/rc1014-task-runtime\.js\?v=1014/);
    const block=taskBlock(html);
    assert.match(block,/const rawOpen=window\.ExportHUBRC1014TaskRuntime\.prepareTasks\(\(state\.tasks\|\|\[\]\),\{/);
    assert.match(block,/dedupeVisibleTasksRC874\(rawOpen\)/,'bestehendes RC874-Dedupe muss erhalten bleiben');
  }
});

test('RC1014 Runtime besitzt keinen zweiten Aufgaben-Store und keine zweite Task-API',()=>{
  const runtime=read('assets/rc1014-task-runtime.js');
  assert.doesNotMatch(runtime,/localStorage\.setItem\([^)]*task/i);
  assert.doesNotMatch(runtime,/sessionStorage\.setItem\([^)]*task/i);
  assert.doesNotMatch(runtime,/fetch\([^)]*(?:rc1014|task)/i);
  assert.doesNotMatch(runtime,/indexedDB/i);
  assert.match(runtime,/function\s+prepareTasks\s*\(/);
  assert.match(runtime,/function\s+openTask\s*\(/);
  assert.match(runtime,/function\s+taskCardMeta\s*\(/);
  assert.match(runtime,/function\s+syncAndroidSnapshot\s*\(/);
});

test('RC1014 Runtime normalisiert über den Lifecycle-Kern ohne Fachgruppen umzubenennen',()=>{
  const runtime=read('assets/rc1014-task-runtime.js');
  assert.match(runtime,/ExportHUBRC1014Tasks/);
  for(const group of ['Offene Sendungen','Fehlende POD','Kunde angemeldet','Picks','Offene ABDs']){
    assert.doesNotMatch(runtime,new RegExp(`replace[^\n]{0,100}${group}`,'i'));
  }
});

test('RC1014 Runtime persistiert Reconcile nur bei echter Änderung über übergebenen Callback',()=>{
  const runtime=loadRuntime();
  const raw=[{id:'pod-1',group:'Fehlende POD',sourceType:'pod',sourceId:'S1',companyId:'essentra',environment:'production',status:'open'}];
  const state={shipments:[{id:'S1',status:'Abgeholt',totalColli:1,collectedColli:1,podFiles:[{name:'pod.pdf'}]}]};
  const writes=[];
  const first=runtime.prepareTasks(raw,{companyId:'essentra',environment:'production',now:'2026-09-09T10:00:00+02:00',state,persist:tasks=>writes.push(tasks)});
  assert.equal(first[0].status,'done');
  assert.equal(writes.length,1);
  assert.equal(writes[0][0].completedBy,'system:pod');
  const secondWrites=[];
  const second=runtime.prepareTasks(first,{companyId:'essentra',environment:'production',now:'2026-09-09T10:00:00+02:00',state,persist:tasks=>secondWrites.push(tasks)});
  assert.equal(second[0].status,'done');
  assert.equal(secondWrites.length,0,'stabiler Reconcile darf keinen Save-Loop erzeugen');
});
