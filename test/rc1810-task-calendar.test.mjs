import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const recurrence=fs.readFileSync('assets/taskplanner-v2-recurrence.js','utf8');
const calendar=fs.readFileSync('assets/rc1810-task-calendar.js','utf8');
const board=fs.readFileSync('assets/rc1810-task-board.js','utf8');
const texts=fs.readFileSync('assets/i18n/rc1810-task-board.js','utf8');
const css=fs.readFileSync('assets/rc1810-task-board.css','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8').replace(/\r\n/g,'\n');

function load(state){
  const saves=[];
  const ctx={console,Date,Intl,setTimeout(){},addEventListener(){},dispatchEvent(){},CustomEvent:class{constructor(n,o){this.type=n;this.detail=o&&o.detail}},
    __EXPORTHUB_GET_STATE__:()=>state,__EXPORTHUB_GET_CURRENT_USER__:()=>({name:'Tobias'}),ExportHUBClean:{queueSave:r=>saves.push(r)}};
  ctx.globalThis=ctx;ctx.window=ctx;
  vm.runInNewContext(recurrence,ctx);vm.runInNewContext(calendar,ctx);
  return{api:ctx.ExportHUBTaskCalendar1810,saves};
}
const master=(id,day,week)=>({id:'M848:'+id+':'+week,title:id,day,originalDay:day,weekKey:week,masterTaskRC848:true,status:'offen'});

test('RC1810 Wochenplan: Aufgabe am 1. Weihnachtstag wird in derselben Woche vorgezogen',()=>{
  const state={tasks:[master('fr','Freitag','2026-W52'),master('mi','Mittwoch','2026-W52')]};
  const {api}=load(state);
  const r=api.applyToTasks(state,{now:'2026-11-06T10:00:00Z'});
  assert.equal(r.moved,1);
  const fr=state.tasks[0];
  assert.equal(fr.day,'Donnerstag');
  assert.equal(fr.dueDate,'2026-12-24');
  assert.equal(fr.rc1810Holiday.originalDate,'2026-12-25');
  assert.equal(state.tasks[1].rc1810Holiday,undefined);
  assert.equal(api.applyToTasks(state).changed,0,'zweiter Lauf ändert nichts');
});

test('RC1810 Betriebsferien: Routine entfällt, Löschen der Ferien stellt den alten Stand her',()=>{
  const state={tasks:[master('do','Donnerstag','2026-W52'),master('mo','Montag','2026-W53'),{id:'one',title:'Einzelaufgabe',dueDate:'2026-12-28',status:'open'}]};
  const {api,saves}=load(state);
  api.saveClosure({label:'Betriebsferien',startDate:'2026-12-24',endDate:'2027-01-01',routineRule:'skip'});
  assert.equal(saves.length,1);
  assert.equal(state.taskCalendar.closures.length,1);
  assert.equal(state.tasks[0].status,'cancelled');
  assert.equal(state.tasks[0].cancelReason,'rc1810_holiday');
  assert.equal(state.tasks[1].status,'cancelled');
  assert.equal(state.tasks[2].status,'open','Einzelaufgaben bleiben unverändert');
  api.removeClosure(state.taskCalendar.closures[0].id);
  assert.equal(state.tasks[0].status,'offen');
  assert.equal(state.tasks[0].rc1810Holiday,undefined);
  assert.equal(state.tasks[1].status,'offen');
});

test('RC1810 Feiertag am Montag: vorziehen geht nicht, Aufgabe wird auf Dienstag nachgeholt',()=>{
  // Ostermontag 2027-03-29
  const state={tasks:[master('mo','Montag','2027-W13')]};
  const {api}=load(state);
  api.applyToTasks(state);
  assert.equal(state.tasks[0].day,'Dienstag');
  assert.equal(state.tasks[0].dueDate,'2027-03-30');
});

test('RC1810 von Hand wieder geöffnete Aufgabe wird nicht erneut gestrichen, erledigte bleiben erledigt',()=>{
  const done=master('fr','Freitag','2026-W53');done.status='erledigt';done.done=true;
  const state={tasks:[master('do','Donnerstag','2026-W52'),done],taskCalendar:{closures:[{startDate:'2026-12-24',endDate:'2027-01-01',routineRule:'skip'}]}};
  const {api}=load(state);
  api.applyToTasks(state);
  assert.equal(state.tasks[0].status,'cancelled');
  assert.equal(state.tasks[1].rc1810Holiday,undefined,'erledigte Aufgabe wird nicht angefasst');
  state.tasks[0].status='offen';
  api.applyToTasks(state);api.applyToTasks(state);
  assert.equal(state.tasks[0].status,'offen');
  assert.equal(state.tasks[0].rc1810Holiday.action,'override');
});

test('RC1810 Stornieren: Aufgabe bleibt erhalten, Ferienlogik fasst sie nicht an, Wieder öffnen stellt sie her',()=>{
  const state={tasks:[master('fr','Freitag','2026-W52'),{id:'one',title:'Einzelaufgabe',dueDate:'2026-12-28',status:'open'}]};
  const {api}=load(state);
  const fr=state.tasks[0];
  assert.equal(api.cancelTask(fr,{user:'Tobias',now:'2026-11-06T10:00:00Z'}),true);
  assert.equal(fr.status,'cancelled');
  assert.equal(fr.cancelReason,'manual');
  assert.equal(fr.cancelledBy,'Tobias');
  assert.equal(fr.statusUpdatedAt,'2026-11-06T10:00:00Z','Statuszeit schützt vor altem Ledger-Eintrag beim Server-Merge');
  assert.equal(state.tasks.length,2,'nichts gelöscht');
  api.applyToTasks(state);
  assert.equal(fr.status,'cancelled','Feiertagslogik überschreibt eine von Hand stornierte Aufgabe nicht');
  assert.equal(fr.rc1810Holiday,undefined);
  assert.equal(api.cancelTask(fr),false,'doppelt stornieren ändert nichts');
  assert.equal(api.uncancelTask(fr,{now:'2026-11-06T11:00:00Z'}),true);
  assert.equal(fr.status,'offen');
  assert.equal(fr.cancelReason,undefined);
  assert.equal(fr.rc1810Cancel,undefined);
  api.applyToTasks(state);
  assert.equal(fr.day,'Donnerstag','nach Wieder öffnen greift die Feiertagsregel wieder');
  const done={id:'d',title:'x',status:'erledigt',done:true};
  assert.equal(api.cancelTask(done),false,'erledigte Aufgaben werden nicht storniert');
  const one=state.tasks[1];api.cancelTask(one);api.uncancelTask(one);
  assert.equal(one.status,'open','voriger Status kommt zurück');
});

test('RC1810 Datumseingabe: TT-MM-JJJJ und TT.MM.JJJJ werden verstanden',()=>{
  const {api}=load({tasks:[]});
  assert.equal(api.dayKey('24-12-2026'),'2026-12-24');
  assert.equal(api.dayKey('1.1.2027'),'2027-01-01');
  assert.equal(api.dayKey('2026-12-24'),'2026-12-24');
});

test('RC1810 Build bindet Kalender, Aufgabenseite und Styles in allen Umgebungen ein',()=>{
  assert.match(build,/rc1810-task-calendar\.js\?v=1810/);
  assert.match(build,/rc1810-task-board\.js\?v=1810/);
  assert.match(build,/rc1810-task-board\.css\?v=1810/);
  assert.match(build,/i18n\/rc1810-task-board\.js\?v=1810/);
  assert.ok(build.indexOf("'exporthub-rc1810-task-board-i18n'")<build.indexOf("injectDeferredRuntimeInHead(html,RC1810_TASK_BOARD_SCRIPT_TAG"),'Texte laden vor der Aufgabenseite');
  assert.match(build,/RC1810 Aufgabenseite fehlt/);
  assert.ok(build.indexOf("'exporthub-rc1810-task-board-script'")>build.indexOf("'exporthub-rc1570-tasks-script'"),'Aufgabenseite lädt nach RC1570');
});

test('RC1810 Seite: Reiter, Menü zusammengeführt, Korrekturen in der RC971-Ebene',()=>{
  for(const tab of ['heute','woche','monat','liste'])assert.match(board,new RegExp("'"+tab+"'"));
  assert.doesNotMatch(css,/nav#nav#nav\\s*>\\s*button\\[data-view="planning"\\][^{}]*\\{display:none!important\\}/,'Aufgabenplaner muss im Menü bleiben');
  assert.doesNotMatch(css,/nav#nav#nav\\s*>\\s*button\\[data-view="taskdetail"\\][^{}]*\\{display:none!important\\}/,'Aufgabenansicht muss im Menü bleiben');
  assert.match(board,/data-rc1810-route="planning"/,'RC1810 Planer-Link bleibt erhalten');
  assert.match(texts,/ExportHUBTaskBoard1810I18n=/);
  assert.match(texts,/Betriebsferien & Feiertage/);
  assert.match(css,/@layer rc971\{/);
  assert.match(css,/#rc1810TaskBoard#rc1810TaskBoard#rc1810TaskBoard\{display:grid!important\}/);
  assert.match(board,/data-rc1810-cancel=/,'Stornieren-Knopf im Detailbereich');
  assert.match(board,/data-rc1810-uncancel=/,'Wieder öffnen für stornierte Aufgaben');
  assert.match(board,/var TAB_ATTR='data-rc1810-board-tab';/,'Body-Attribut darf nicht wie ein Reiter-Knopf heißen (closest() träfe sonst body)');
});
