import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(withCore=true){
  const context={console,Date,Intl};context.globalThis=context;
  if(withCore)vm.runInNewContext(fs.readFileSync('assets/taskplanner-v2-core.js','utf8'),context,{filename:'taskplanner-v2-core.js'});
  vm.runInNewContext(fs.readFileSync('assets/rc1014-task-lifecycle.js','utf8'),context,{filename:'rc1014-task-lifecycle.js'});
  return context.ExportHUBRC1014Tasks;
}

test('RC1014-Kompatibilität bewahrt P4 und stellt parallel V2-Priorität bereit',()=>{
  const api=load();
  const task=api.normalizeTask({id:'x',title:'X',group:'Picks',priority:'P4',dueDate:'2026-10-12'},{companyId:'essentra',environment:'production'});
  assert.equal(task.priority,'P4');
  assert.equal(task.v2Priority,'P3');
  assert.equal(task.dueAt,'2026-10-12T16:15:00+02:00');
});

test('RC1014-Kompatibilität bleibt ohne geladenen V2-Core lauffähig',()=>{
  const api=load(false);
  const task=api.normalizeTask({id:'x',title:'X',group:'Picks',owner:'tobias'},{companyId:'essentra',environment:'production'});
  assert.equal(task.priority,'P4');
  assert.equal(task.originalAssignee,'tobias');
});

test('Systemabschluss nutzt V2-Historie und behält completedBy',()=>{
  const api=load();
  const ctx={companyId:'essentra',environment:'production',now:'2026-10-12T10:00:00+02:00'};
  const task=api.normalizeTask({id:'p',title:'POD',group:'Fehlende POD',sourceType:'pod',sourceId:'S1',status:'open'},ctx);
  const result=api.reconcile([task],{shipments:[{id:'S1',status:'Abgeholt',totalColli:1,collectedColli:1,podFiles:[{name:'pod.pdf'}]}]},ctx);
  assert.equal(result.tasks[0].status,'done');
  assert.equal(result.tasks[0].completedBy,'system:pod');
  assert.equal(result.tasks[0].history.at(-1).action,'completed');
});
