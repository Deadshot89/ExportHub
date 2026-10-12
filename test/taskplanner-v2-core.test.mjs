import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const context={console,Date,Intl};
  context.globalThis=context;
  const source=fs.readFileSync(new URL('../assets/taskplanner-v2-core.js',import.meta.url),'utf8');
  vm.runInNewContext(source,context,{filename:'taskplanner-v2-core.js'});
  return context.ExportHUBTaskCoreV2;
}

test('normalisiert Legacy-Datumsfelder ohne sie zu löschen',()=>{
  const api=load();
  const input={id:'t1',title:'Legacy',date:'2026-10-12',day:'2026-10-12',dueDate:'2026-10-12',plannedDate:'2026-10-11',targetDate:'2026-10-13'};
  const out=api.normalizeTask(input,{now:'2026-10-10T10:00:00+02:00'});
  assert.equal(out.date,input.date);
  assert.equal(out.day,input.day);
  assert.equal(out.dueDate,input.dueDate);
  assert.equal(out.plannedDate,input.plannedDate);
  assert.equal(out.targetDate,input.targetDate);
  assert.equal(out.plannedAt,'2026-10-11T00:00:00+02:00');
  assert.equal(out.dueAt,'2026-10-12T16:15:00+02:00');
  assert.equal(out.latestCompletionAt,'2026-10-13T16:15:00+02:00');
});

test('mappt Statuswerte auf das V2-Statusmodell',()=>{
  const api=load();
  const cases=new Map([
    ['Geplant','planned'],['Offen','open'],['In Bearbeitung','in_progress'],['Wartet','waiting'],
    ['Wartet auf Rückmeldung','waiting_feedback'],['Blockiert','blocked'],['Erledigt','done'],['Storniert','cancelled']
  ]);
  for(const [legacy,expected] of cases){
    assert.equal(api.normalizeTask({id:legacy,title:legacy,status:legacy}).status,expected,legacy);
  }
});

test('mappt Prioritäten auf P0 bis P3 und bewahrt Legacy-P4 als P3',()=>{
  const api=load();
  for(const p of ['P0','P1','P2','P3'])assert.equal(api.normalizeTask({id:p,title:p,priority:p}).priority,p);
  const p4=api.normalizeTask({id:'p4',title:'p4',priority:'P4'});
  assert.equal(p4.priority,'P3');
  assert.equal(p4.legacyPriority,'P4');
});

test('setzt bei fehlender Fälligkeitsuhrzeit 16:15 Europe/Berlin auch über DST-Grenzen',()=>{
  const api=load();
  assert.equal(api.normalizeTask({id:'summer',title:'Summer',dueDate:'2026-03-30'}).dueAt,'2026-03-30T16:15:00+02:00');
  assert.equal(api.normalizeTask({id:'winter',title:'Winter',dueDate:'2026-10-26'}).dueAt,'2026-10-26T16:15:00+01:00');
});

test('derive kennzeichnet überfällig ohne dueAt oder priority zu verändern',()=>{
  const api=load();
  const task=api.normalizeTask({id:'o1',title:'Overdue',priority:'P2',dueDate:'2026-10-10'});
  const before={dueAt:task.dueAt,priority:task.priority};
  const derived=api.derive(task,'2026-10-12T12:00:00+02:00');
  assert.equal(derived.overdue,true);
  assert.equal(derived.overdueDays,2);
  assert.equal(task.dueAt,before.dueAt);
  assert.equal(task.priority,before.priority);
});

test('completeTask ergänzt Historie und completionMode unabhängig von Checklistenfortschritt',()=>{
  const api=load();
  const task=api.normalizeTask({id:'c1',title:'Done',status:'open',checklist:[{id:'a',done:false},{id:'b',done:false}]});
  const done=api.completeTask(task,{at:'2026-10-12T14:00:00+02:00',mode:'manual',comment:'fertig'});
  assert.equal(done.status,'done');
  assert.equal(done.completionMode,'manual');
  assert.equal(done.completedAt,'2026-10-12T14:00:00+02:00');
  assert.equal(done.checklist[0].done,false);
  assert.equal(done.history.at(-1).action,'completed');
  assert.equal(done.history.at(-1).comment,'fertig');
});

test('lokale Uhrzeiten erhalten den Europe-Berlin-Offset statt timezone-los zu bleiben',()=>{
  const api=load();
  assert.equal(api.normalizeTask({id:'time1',title:'Zeit',dueAt:'2026-10-12T13:00:00'}).dueAt,'2026-10-12T13:00:00+02:00');
  assert.equal(api.normalizeTask({id:'time2',title:'Zeit',dueAt:'2026-12-12 13:00'}).dueAt,'2026-12-12T13:00:00+01:00');
});
