import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const context={console,Date,Intl,setTimeout,clearTimeout};
  context.globalThis=context;
  for(const file of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/taskplanner-v2-planner.js']){
    const source=fs.readFileSync(file,'utf8');
    vm.runInNewContext(source,context,{filename:file});
  }
  return {core:context.ExportHUBTaskCoreV2,recurrence:context.ExportHUBTaskRecurrenceV2,planner:context.ExportHUBTaskPlannerV2};
}

function baseTask(id,extra={}){
  return {id,title:id,status:'open',priority:'P2',dueAt:'2026-10-16T16:15:00+02:00',...extra};
}

test('Planner priorisiert überfällig vor P0-P3 und sortiert danach nach Deadline',()=>{
  const {planner}=load();
  const tasks=[
    baseTask('p2',{priority:'P2',dueAt:'2026-10-15T16:15:00+02:00'}),
    baseTask('p0-late',{priority:'P0',dueAt:'2026-10-16T16:15:00+02:00'}),
    baseTask('overdue',{priority:'P3',dueAt:'2026-10-09T16:15:00+02:00'}),
    baseTask('p0-early',{priority:'P0',dueAt:'2026-10-14T16:15:00+02:00'}),
    baseTask('p1',{priority:'P1',latestCompletionAt:'2026-10-13T16:15:00+02:00',dueAt:'2026-10-16T16:15:00+02:00'})
  ];
  const ordered=planner.orderTasks(tasks,'2026-10-12T08:00:00+02:00');
  assert.deepEqual(ordered.map(t=>t.id),['overdue','p0-early','p0-late','p1','p2']);
});

test('Abhängigkeitsprüfung erkennt Zyklen und fehlende Vorgänger',()=>{
  const {planner}=load();
  const cyclic=[baseTask('A',{dependencies:['B']}),baseTask('B',{dependencies:['A']})];
  const c=planner.validateDependencies(cyclic);
  assert.equal(c.valid,false);
  assert.deepEqual(c.cycles.sort(),['A','B']);
  const missing=planner.validateDependencies([baseTask('C',{dependencies:['NOPE']})]);
  assert.equal(missing.valid,false);
  assert.deepEqual(missing.missing,[{taskId:'C',dependencyId:'NOPE'}]);
});

test('buildWeekDraft mutiert Eingangsdaten nicht und schützt manuelle Planung',()=>{
  const {planner,recurrence}=load();
  const task=baseTask('manual',{manualOverride:true,plannedAt:'2026-10-15T09:00:00+02:00'});
  const before=JSON.stringify(task);
  const draft=planner.buildWeekDraft({tasks:[task],weekStart:'2026-10-12',calendar:recurrence.calendar({}),now:'2026-10-12T08:00:00+02:00'});
  assert.equal(JSON.stringify(task),before);
  assert.equal(draft.items[0].plannedDate,'2026-10-15');
  assert.equal(draft.items[0].manualProtected,true);
});

test('Neu berechnen lässt manuelle Overrides standardmäßig stehen und überschreibt nur explizit',()=>{
  const {planner,recurrence}=load();
  const task=baseTask('manual',{manualOverride:true,plannedAt:'2026-10-15T09:00:00+02:00',dueAt:'2026-10-13T16:15:00+02:00'});
  const keep=planner.recalculateWeek({tasks:[task],weekStart:'2026-10-12',calendar:recurrence.calendar({}),now:'2026-10-12T08:00:00+02:00'});
  assert.equal(keep.items[0].plannedDate,'2026-10-15');
  const overwrite=planner.recalculateWeek({tasks:[task],weekStart:'2026-10-12',calendar:recurrence.calendar({}),now:'2026-10-12T08:00:00+02:00',allowManualOverride:true});
  assert.notEqual(overwrite.items[0].plannedDate,'2026-10-15');
});

test('manual_decision Feiertagskonflikt blockiert die Übernahme',()=>{
  const {planner,recurrence}=load();
  const task=baseTask('holiday',{holidayPolicy:'manual_decision',plannedAt:'2026-12-25T09:00:00+01:00',dueAt:'2026-12-28T16:15:00+01:00'});
  const draft=planner.buildWeekDraft({tasks:[task],weekStart:'2026-12-21',calendar:recurrence.calendar({}),now:'2026-12-21T08:00:00+01:00'});
  assert.equal(draft.items[0].holidayConflict,true);
  assert.throws(()=>planner.applyWeekDraft({tasks:[task]},draft),/Feiertagskonflikt|holiday/i);
});

test('previous_workday Feiertagsregel erzeugt Planvorschlag, aber verändert Task erst bei apply',()=>{
  const {planner,recurrence}=load();
  const task=baseTask('holiday-move',{holidayPolicy:'previous_workday',plannedAt:'2026-12-25T09:00:00+01:00',dueAt:'2026-12-28T16:15:00+01:00'});
  const state={tasks:[task]};
  const before=JSON.stringify(state);
  const draft=planner.buildWeekDraft({tasks:state.tasks,weekStart:'2026-12-21',calendar:recurrence.calendar({}),now:'2026-12-21T08:00:00+01:00'});
  assert.equal(JSON.stringify(state),before);
  assert.equal(draft.items[0].plannedDate,'2026-12-24');
  assert.equal(draft.items[0].autoMoved,true);
  const applied=planner.applyWeekDraft(state,draft);
  assert.equal(applied.state.tasks[0].plannedAt.startsWith('2026-12-24'),true);
  assert.equal(state.tasks[0].plannedAt.startsWith('2026-12-25'),true);
});

test('offener Vorgänger kennzeichnet abhängige Aufgabe und plant sie nicht vor dem Vorgänger',()=>{
  const {planner,recurrence}=load();
  const tasks=[
    baseTask('A',{priority:'P1',dueAt:'2026-10-13T16:15:00+02:00'}),
    baseTask('B',{priority:'P0',dependencies:['A'],dueAt:'2026-10-14T16:15:00+02:00'})
  ];
  const draft=planner.buildWeekDraft({tasks,weekStart:'2026-10-12',calendar:recurrence.calendar({}),now:'2026-10-12T08:00:00+02:00'});
  const a=draft.items.find(x=>x.taskId==='A'),b=draft.items.find(x=>x.taskId==='B');
  assert.equal(b.dependencyBlocked,true);
  assert.ok(b.plannedDate>=a.plannedDate);
});

test('unmögliche Abhängigkeit plus harte Deadline markiert Woche als überlastet',()=>{
  const {planner,recurrence}=load();
  const tasks=[
    baseTask('A',{manualOverride:true,plannedAt:'2026-10-16T09:00:00+02:00',dueAt:'2026-10-16T16:15:00+02:00'}),
    baseTask('B',{dependencies:['A'],latestCompletionAt:'2026-10-13T16:15:00+02:00',dueAt:'2026-10-13T16:15:00+02:00'})
  ];
  const draft=planner.buildWeekDraft({tasks,weekStart:'2026-10-12',calendar:recurrence.calendar({}),now:'2026-10-12T08:00:00+02:00'});
  assert.equal(draft.overloaded,true);
  assert.ok(draft.conflicts.some(c=>c.type==='deadline_dependency'));
});

test('weekSummary zählt Planung, Verschiebungen, Feiertage und Abhängigkeiten',()=>{
  const {planner}=load();
  const summary=planner.weekSummary({items:[
    {taskId:'1',plannedDate:'2026-10-12',autoMoved:true,holidayConflict:false,dependencyBlocked:false,manualChanged:false},
    {taskId:'2',plannedDate:'2026-10-13',autoMoved:false,holidayConflict:true,dependencyBlocked:true,manualChanged:true}
  ]});
  assert.deepEqual(summary,{planned:2,autoMoved:1,holidayConflicts:1,dependencyConflicts:1,manualChanges:1});
});

test('monthProjection liefert Tageszusammenfassungen statt Vollkarten',()=>{
  const {planner,recurrence}=load();
  const tasks=[baseTask('a',{plannedAt:'2026-10-12T09:00:00+02:00'}),baseTask('b',{plannedAt:'2026-10-12T11:00:00+02:00',status:'done'}),baseTask('c',{plannedAt:'2026-10-13T09:00:00+02:00',priority:'P0'})];
  const projection=planner.monthProjection({year:2026,month:10,tasks,calendar:recurrence.calendar({}),now:'2026-10-12T12:00:00+02:00'});
  const d12=projection.days.find(d=>d.date==='2026-10-12');
  assert.equal(d12.taskCount,2);
  assert.equal(d12.doneCount,1);
  assert.equal(Array.isArray(d12.tasks),false);
});
