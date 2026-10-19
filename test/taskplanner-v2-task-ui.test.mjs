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

test('saveTask übernimmt ein neues dueDate auch wenn die V2-Aufgabe bereits dueAt besitzt',()=>{
  const api=load(),state={tasks:[baseTask()]};
  const result=api.saveTask({id:'task-1',dueDate:'2026-10-20'},{state,persist:()=>{},now:'2026-10-12T10:00:00+02:00'});
  assert.equal(result.task.dueAt,'2026-10-20T16:15:00+02:00');
  assert.equal(result.task.dueDate,'2026-10-20');
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

test('Detail zeigt abhakbare Checkliste, Kommentare, Abhängigkeiten, Seriendatum und kommende Wiederholungen',()=>{
  const api=load(),root={innerHTML:''};
  const state={tasks:[baseTask(),{id:'task-0',title:'Rechnung anlegen',status:'open'}],taskSeries:[{id:'series-1',rule:{type:'weekly',weekdays:[1]}}]};
  api.renderDetail(root,'task-1',{state,now:'2026-10-12T10:00:00+02:00'});
  assert.match(root.innerHTML,/type="checkbox" data-action="checklist-toggle" data-index="0" checked/);
  assert.match(root.innerHTML,/data-index="1"(?! checked)/);
  assert.match(root.innerHTML,/1 of 2 done/);
  assert.match(root.innerHTML,/data-section="comments"[\s\S]*Rückfrage offen/);
  assert.match(root.innerHTML,/data-action="comment-add"/);
  assert.match(root.innerHTML,/data-dependency-id="task-0" data-open="1"[\s\S]*Rechnung anlegen/);
  assert.match(root.innerHTML,/Original series date 2026-10-12/);
  assert.match(root.innerHTML,/data-complete-comment|data-tpv2-complete-comment/);
  assert.match(root.innerHTML,/data-action="save-template"/);
});

test('Detail einer erledigten Aufgabe bietet kein Erledigen mehr an und sperrt die Checkliste',()=>{
  const api=load(),root={innerHTML:''};
  api.renderDetail(root,'task-1',{state:{tasks:[baseTask({status:'done',completedAt:'2026-10-12T12:00:00+02:00'})]}});
  assert.doesNotMatch(root.innerHTML,/data-action="complete"/);
  assert.match(root.innerHTML,/data-action="checklist-toggle"[^>]*disabled/);
  assert.match(root.innerHTML,/data-action="save-template"/);
});

test('Checklistenpunkt wird einzeln abgehakt und zurückgesetzt, mit Historie',()=>{
  const api=load(),state={tasks:[baseTask()]};let saves=0;
  const ctx={state,persist:()=>saves++,now:'2026-10-12T11:00:00+02:00',user:{id:'u1'}};
  let result=api.toggleChecklistItem('task-1',1,ctx);
  assert.equal(result.changed,true);
  assert.equal(state.tasks[0].checklist[1].done,true);
  assert.equal(state.tasks[0].checklist[1].completedBy,'u1');
  assert.equal(state.tasks[0].status,'in_progress','Checkliste schließt die Aufgabe nicht ab');
  assert.equal(state.tasks[0].history.at(-1).action,'checklist_checked');
  result=api.toggleChecklistItem('task-1',0,ctx);
  assert.equal(state.tasks[0].checklist[0].done,false);
  assert.equal(api.toggleChecklistItem('task-1',9,ctx).changed,false);
  assert.equal(saves,2);
});

test('Kommentar wird mit Autor und Zeit gespeichert, leerer Kommentar nicht',()=>{
  const api=load(),state={tasks:[baseTask()]};
  const ctx={state,persist:()=>{},now:'2026-10-12T11:00:00+02:00',user:{id:'u1',name:'Tobias'}};
  assert.equal(api.addComment('task-1','   ',ctx).changed,false);
  api.addComment('task-1','Kunde angerufen',ctx);
  const c=state.tasks[0].comments.at(-1);
  assert.equal(c.text,'Kunde angerufen');
  assert.equal(c.authorName,'Tobias');
  assert.equal(c.at,'2026-10-12T11:00:00+02:00');
  assert.equal(state.tasks[0].history.at(-1).action,'commented');
});

test('Abschlusskommentar erscheint zusätzlich bei den Kommentaren',()=>{
  const api=load(),state={tasks:[baseTask()]};
  api.completeTask('task-1',{comment:'Fertig geprüft'},{state,persist:()=>{},now:'2026-10-12T12:00:00+02:00'});
  assert.equal(state.tasks[0].comments.at(-1).text,'Fertig geprüft');
  assert.equal(state.tasks[0].comments.at(-1).kind,'completion');
  const again=api.completeTask('task-1',{comment:'Nochmal'},{state,persist:()=>{},now:'2026-10-12T13:00:00+02:00'});
  assert.equal(again.task.comments.filter(c=>c.kind==='completion').length,1);
});

test('Aufgabe als Vorlage speichern übernimmt keinen Status und keinen Checklistenfortschritt',()=>{
  const api=load(),state={tasks:[baseTask({status:'done',completedAt:'2026-10-12T12:00:00+02:00'})]};
  const result=api.saveTaskAsTemplate('task-1',{state,persist:()=>{},now:'2026-10-12T12:00:00+02:00'});
  assert.equal(result.changed,true);
  const tpl=state.taskTemplates[0];
  assert.equal(tpl.sourceTaskId,'task-1');
  assert.notEqual(tpl.id,'task-1');
  assert.equal(Object.hasOwn(tpl,'status'),false);
  assert.equal(tpl.checklist.every(i=>i.done===false),true);
  assert.equal(tpl.comments.length,0);
  assert.equal(state.tasks.length,1);
});
