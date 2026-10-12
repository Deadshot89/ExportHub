import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const context={console,Date,Intl,setTimeout,clearTimeout};
  context.globalThis=context;
  for(const file of [
    'assets/taskplanner-v2-core.js',
    'assets/taskplanner-v2-recurrence.js',
    'assets/taskplanner-v2-planner.js',
    'assets/taskplanner-v2-ui.js'
  ])vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  return context.ExportHUBTaskUIV2;
}

const plain=value=>JSON.parse(JSON.stringify(value));

function baseTask(extra={}){
  return {
    id:'task-1',title:'ABD prüfen',description:'Zolldokument prüfen',customerId:'C1',customerName:'Kunde Eins',
    area:'Export',processId:'abd',status:'in_progress',priority:'P1',startAt:'2026-10-12T08:00:00+02:00',
    plannedAt:'2026-10-12T09:00:00+02:00',dueAt:'2026-10-12T16:15:00+02:00',latestCompletionAt:'2026-10-13T16:15:00+02:00',
    seriesId:'series-1',occurrenceKey:'series-1|2026-10-12',holidayPolicy:'previous_workday',contact:'Disposition',
    checklist:[{id:'a',text:'Rechnung prüfen',done:true},{id:'b',text:'ABD prüfen',done:false}],
    comments:[{id:'c',text:'Rückfrage offen'}],dependencies:['task-0'],history:[{action:'created',at:'2026-10-01T08:00:00+02:00'}],
    completedAt:'',completionMode:'',...extra
  };
}

test('Detailmodell enthält alle fachlichen TaskPlanner-V2-Felder',()=>{
  const api=load();
  const model=plain(api.detailModel(baseTask(),{series:[{id:'series-1',rule:{type:'weekly',weekdays:[1]}}]}));
  for(const key of ['title','customerId','customerName','area','processId','status','priority','startAt','plannedAt','dueAt','latestCompletionAt','seriesId','occurrenceKey','holidayPolicy','contact','checklist','comments','dependencies','history','nextOccurrence','upcomingOccurrences'])assert.ok(Object.hasOwn(model,key),key);
});

test('renderDetail erzeugt Sidepanel-Struktur mit zentralen Feldern und sichtbarem Erledigt-Button',()=>{
  const api=load(),root={innerHTML:''};
  api.renderDetail(root,'task-1',{state:{tasks:[baseTask()]}});
  assert.match(root.innerHTML,/data-taskplanner-v2-detail/);
  assert.match(root.innerHTML,/ABD prüfen/);
  assert.match(root.innerHTML,/Kunde Eins/);
  assert.match(root.innerHTML,/16:15/);
  assert.match(root.innerHTML,/data-action="complete"/);
  assert.match(root.innerHTML,/data-section="checklist"/);
  assert.match(root.innerHTML,/data-section="history"/);
});

test('saveTask setzt bei Fälligkeit ohne Uhrzeit 16:15 und löscht keine Legacy-Aliasfelder',()=>{
  const api=load();
  const state={tasks:[{id:'legacy',title:'Alt',date:'2026-10-12',day:'2026-10-12',targetDate:'2026-10-14'}]};
  let saves=0;
  const result=api.saveTask({id:'legacy',title:'Neu',dueDate:'2026-10-15',priority:'P0'},{state,persist:()=>saves++,now:'2026-10-12T10:00:00+02:00'});
  assert.equal(result.task.title,'Neu');
  assert.equal(result.task.dueAt,'2026-10-15T16:15:00+02:00');
  assert.equal(result.task.date,'2026-10-12');
  assert.equal(result.task.day,'2026-10-12');
  assert.equal(result.task.targetDate,'2026-10-14');
  assert.equal(saves,1);
});

test('fachliches Entfernen storniert gespeicherte Aufgabe statt sie physisch zu löschen',()=>{
  const api=load(),state={tasks:[baseTask()]};let saves=0;
  api.cancelTask('task-1',{state,persist:()=>saves++,now:'2026-10-12T11:00:00+02:00'});
  assert.equal(state.tasks.length,1);
  assert.equal(state.tasks[0].status,'cancelled');
  assert.equal(saves,1);
});

test('Erledigen akzeptiert optionalen Kommentar und ignoriert unvollständige Checkliste',()=>{
  const api=load(),state={tasks:[baseTask()]};
  const result=api.completeTask('task-1',{comment:'Fertig geprüft'},{state,persist:()=>{},now:'2026-10-12T12:00:00+02:00'});
  assert.equal(result.task.status,'done');
  assert.equal(result.task.checklist[1].done,false);
  assert.equal(result.task.history.at(-1).comment,'Fertig geprüft');
});

test('templateFromTask entfernt Instanzstatus, Abschluss, Historie und setzt Checkliste zurück',()=>{
  const api=load();
  const template=plain(api.templateFromTask(baseTask({status:'done',completedAt:'2026-10-12T12:00:00+02:00',completionMode:'manual'})));
  assert.equal(Object.hasOwn(template,'status'),false);
  assert.equal(Object.hasOwn(template,'completedAt'),false);
  assert.equal(Object.hasOwn(template,'completionMode'),false);
  assert.equal(Object.hasOwn(template,'occurrenceKey'),false);
  assert.equal(Object.hasOwn(template,'history'),false);
  assert.equal(template.checklist.every(item=>item.done===false),true);
  assert.equal(template.title,'ABD prüfen');
  assert.equal(template.customerId,'C1');
});

test('saveTemplate persistiert neue Vorlage ohne Task-Instanzdaten',()=>{
  const api=load(),state={taskTemplates:[]};let saves=0;
  const result=api.saveTemplate(api.templateFromTask(baseTask()),{state,persist:()=>saves++,now:'2026-10-12T12:00:00+02:00'});
  assert.equal(state.taskTemplates.length,1);
  assert.equal(state.taskTemplates[0].title,'ABD prüfen');
  assert.equal(saves,1);
});

test('kompakte und detaillierte Anzeigepräferenz wird pro Benutzer gespeichert',()=>{
  const api=load(),state={taskSettings:{users:{}}};let saves=0;
  api.setViewPreference('compact',{state,user:{id:'u1'},persist:()=>saves++});
  assert.equal(state.taskSettings.users.u1.viewMode,'compact');
  assert.equal(api.viewPreference({state,user:{id:'u1'}}),'compact');
  api.setViewPreference('detailed',{state,user:{id:'u1'},persist:()=>saves++});
  assert.equal(api.viewPreference({state,user:{id:'u1'}}),'detailed');
  assert.equal(saves,2);
});
