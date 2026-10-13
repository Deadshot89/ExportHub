import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const context={console,Date,Intl,setTimeout,clearTimeout};
  context.globalThis=context;
  for(const file of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/taskplanner-v2-planner.js','assets/taskplanner-v2-projections.js']){
    vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  }
  return context;
}

const task=(id,extra={})=>({
  id,title:`Task ${id}`,customerId:'C1',customerName:'Same Name',status:'open',priority:'P2',
  plannedAt:'2026-10-13T09:00:00+02:00',dueAt:'2026-10-13T16:15:00+02:00',createdAt:'2026-10-10T08:00:00+02:00',
  ...extra
});

const plain=value=>JSON.parse(JSON.stringify(value));

test('Dashboard liefert verbindliche KPIs, Wochenfortschritt und Überlaststatus',()=>{
  const {ExportHUBTaskProjectionsV2:p}=load();
  const state={tasks:[
    task('critical',{priority:'P0'}),
    task('waiting',{status:'waiting'}),
    task('overdue',{plannedAt:'2026-10-12T09:00:00+02:00',dueAt:'2026-10-12T16:15:00+02:00'}),
    task('future',{plannedAt:'2026-10-14T09:00:00+02:00',dueAt:'2026-10-14T16:15:00+02:00'}),
    task('done',{status:'done',completedAt:'2026-10-13T10:00:00+02:00',completionMode:'manual'})
  ],taskArchive:[]};
  const view=plain(p.dashboard(state,{now:'2026-10-13T12:00:00+02:00',weekDraft:{overloaded:true}}));
  assert.deepEqual(view.counts,{today:2,week:4,overdue:1,critical:1,done:1,waiting:1});
  assert.deepEqual(view.weekly,{done:1,total:5,percent:20});
  assert.equal(view.overloaded,true);
});

test('Kundenprojektion trennt aktiv, kommend und Historie ausschließlich per customerId',()=>{
  const {ExportHUBTaskProjectionsV2:p}=load();
  const state={tasks:[
    task('active',{customerId:'C1',plannedAt:'2026-10-13T09:00:00+02:00'}),
    task('upcoming',{customerId:'C1',plannedAt:'2026-10-20T09:00:00+02:00',dueAt:'2026-10-20T16:15:00+02:00'}),
    task('recent-done',{customerId:'C1',status:'done',completedAt:'2026-10-12T10:00:00+02:00'}),
    task('wrong-id',{customerId:'C2',customerName:'Same Name'})
  ],taskArchive:[
    task('archived-c1',{customerId:'C1',status:'done',completedAt:'2026-09-01T10:00:00+02:00',archivedAt:'2026-09-10T10:00:00+02:00'}),
    task('archived-c2',{customerId:'C2',customerName:'Same Name',status:'done',completedAt:'2026-09-02T10:00:00+02:00',archivedAt:'2026-09-10T10:00:00+02:00'})
  ]};
  const view=plain(p.customer('C1',state,{now:'2026-10-13T12:00:00+02:00',page:1,pageSize:1}));
  assert.deepEqual(view.active.map(x=>x.id),['active']);
  assert.deepEqual(view.upcoming.map(x=>x.id),['upcoming']);
  assert.equal(view.history.items.length,1);
  assert.equal(view.history.total,2);
  assert.equal(view.history.pages,2);
  assert.ok(view.history.items.every(x=>x.customerId==='C1'));
});

test('Archiv filtert und paginiert nach Kunde, Prozess, Serie und completionMode',()=>{
  const {ExportHUBTaskProjectionsV2:p}=load();
  const state={tasks:[],taskArchive:[
    task('a',{status:'done',customerId:'C1',processId:'PICK',seriesId:'S1',completionMode:'automatic',completedAt:'2026-10-01T10:00:00+02:00'}),
    task('b',{status:'done',customerId:'C1',processId:'PICK',seriesId:'S1',completionMode:'automatic',completedAt:'2026-10-02T10:00:00+02:00'}),
    task('c',{status:'done',customerId:'C1',processId:'REG',seriesId:'S1',completionMode:'manual',completedAt:'2026-10-03T10:00:00+02:00'}),
    task('d',{status:'done',customerId:'C2',processId:'PICK',seriesId:'S2',completionMode:'automatic',completedAt:'2026-10-04T10:00:00+02:00'})
  ]};
  const view=plain(p.archive({customerId:'C1',processId:'PICK',seriesId:'S1',completionMode:'automatic',page:1,pageSize:1},state,{}));
  assert.equal(view.total,2);
  assert.equal(view.pages,2);
  assert.equal(view.items.length,1);
  assert.equal(view.items[0].id,'b');
});

test('Statistik unterscheidet automatisch/manuell, offen/überfällig und pünktlich/zu spät',()=>{
  const {ExportHUBTaskProjectionsV2:p}=load();
  const state={tasks:[
    task('open'),
    task('late-open',{dueAt:'2026-10-10T16:15:00+02:00',plannedAt:'2026-10-10T09:00:00+02:00'})
  ],taskArchive:[
    task('auto',{status:'done',completionMode:'automatic',dueAt:'2026-10-10T16:15:00+02:00',completedAt:'2026-10-10T15:00:00+02:00'}),
    task('manual-late',{status:'done',completionMode:'manual',dueAt:'2026-10-10T16:15:00+02:00',completedAt:'2026-10-11T09:00:00+02:00'})
  ]};
  const stats=plain(p.stats({},state,{now:'2026-10-13T12:00:00+02:00'}));
  assert.equal(stats.open,2);
  assert.equal(stats.overdue,1);
  assert.equal(stats.completed,2);
  assert.equal(stats.onTime,1);
  assert.equal(stats.late,1);
  assert.deepEqual(stats.completionMode,{automatic:1,manual:1,other:0});
});

test('7-Tage-Archivierung entfernt Alt-Erledigte aus aktiv, dedupliziert IDs und speichert kompakt',()=>{
  const {ExportHUBTaskCoreV2:core}=load();
  const existing=task('old',{status:'done',completedAt:'2026-10-01T10:00:00+02:00',archivedAt:'2026-10-09T10:00:00+02:00',history:[{action:'completed'}]});
  const state={tasks:[
    {...existing,description:'large text',archivedAt:''},
    task('new-archive',{status:'done',description:'drop me',completedAt:'2026-10-02T10:00:00+02:00',history:[{action:'completed'}]}),
    task('recent',{status:'done',completedAt:'2026-10-10T10:00:00+02:00'})
  ],taskArchive:[existing]};
  const next=plain(core.archiveCompleted(state,'2026-10-13T12:00:00+02:00'));
  assert.deepEqual(next.tasks.map(x=>x.id),['recent']);
  assert.equal(next.taskArchive.filter(x=>x.id==='old').length,1,'bereits archivierte ID darf nicht dupliziert werden');
  const compact=next.taskArchive.find(x=>x.id==='new-archive');
  assert.ok(compact);
  assert.equal(compact.description,undefined,'Archivdatensatz muss große Detailfelder abwerfen');
  assert.equal(compact.customerId,'C1');
  assert.equal(compact.history.at(-1).action,'archived');
});
