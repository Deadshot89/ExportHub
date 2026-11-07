import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const state={tasks:[]},ctx={console,Date,Intl,setTimeout(){},addEventListener(){},__EXPORTHUB_GET_STATE__:()=>state};
ctx.window=ctx;ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync('assets/i18n/rc1810-task-board.js','utf8'),ctx);
vm.runInNewContext(fs.readFileSync('assets/rc1810-task-board.js','utf8'),ctx);
const board=ctx.ExportHUBTaskBoard1810;
test('RC1811: Routine-Untergruppen klassifizieren ohne Aufgabenänderung',()=>{
 const tasks=[
  {id:'pick',title:'Picks prüfen',group:'Picks',masterTaskRC848:true},
  {id:'abd',title:'ABD für Mesan',masterTaskRC848:true},
  {id:'uk',title:'UK',masterTaskRC848:true},
  {id:'report',title:'MiniBag report updaten',masterTaskRC848:true},
  {id:'pod',title:'POD prüfen',status:'done',masterTaskRC848:true}
 ];
 const before=JSON.stringify(tasks);
 assert.deepEqual(tasks.map(board._workGroup),['picks','abd','anmeldung','berichte','pod']);
 const markup=board._routineGroupsHtml(tasks,'Tobias|2026-11-02');
 for(const type of ['picks','abd','anmeldung','berichte','pod'])assert.match(markup,new RegExp('data-rc1810-worktype="'+type+'"'));
 assert.match(markup,/aria-expanded="true"/);
 assert.match(markup,/1\/1/);
 assert.equal(JSON.stringify(tasks),before);
});
test('RC1811: eine geschlossene Gruppe behält ihre Aufgaben und ihren Zähler',()=>{
 const tasks=[{id:'a',title:'ABD für Mesan',masterTaskRC848:true}];
 board._ui.open['Tobias|2026-11-02|work|abd']=false;
 const markup=board._routineGroupsHtml(tasks,'Tobias|2026-11-02');
 assert.match(markup,/aria-expanded="false"/);
 assert.match(markup,/0\/1/);
 assert.doesNotMatch(markup,/data-rc1810-check="a"/);
 assert.equal(tasks.length,1);
});
test('RC1811: Asset-Version und Gruppendarstellung im Build',()=>{
 const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 const css=fs.readFileSync('assets/rc1810-task-board.css','utf8');
 assert.match(css,/rc1810-workgroup/);
 for(const name of ['rc1810-task-board.css','rc1810-task-board.js'])assert.ok(build.includes(name+'?v=1812'),name);
 assert.ok(build.includes('i18n/rc1810-task-board.js?v=1812'));
});

test('RC1812: einmalige Picks und ABD stehen ebenfalls in den farbigen Untergruppen',()=>{
 const now=new Date(),monday=new Date(now);
 monday.setDate(now.getDate()-((now.getDay()+6)%7));
 const d=[monday.getFullYear(),String(monday.getMonth()+1).padStart(2,'0'),String(monday.getDate()).padStart(2,'0')].join('-');
 const tasks=[
  {id:'pick-single',title:'Heute Picks prüfen',group:'Picks',assignedToName:'Sevastian',dueDate:d,status:'open'},
  {id:'abd-single',title:'ABD erstellen',assignedToName:'Sevastian',dueDate:d,status:'open'},
  {id:'routine-uk',title:'UK',masterTaskRC848:true,assignedToName:'Sevastian',dueDate:d,status:'open'}
 ];
 state.tasks=tasks;board._ui.tab='woche';board._ui.group='person';board._ui.who='alle';board._ui.weekStart=d;
 // Bereits bestehende Routine-Sektion gezielt öffnen; Einmaliges ist unabhängig davon sichtbar.
 board._ui.open['Sevastian|'+d]=false;
 const week=board._weekHtml();
 assert.match(week,/data-rc1810-worktype="picks"/);
 assert.match(week,/data-rc1810-worktype="abd"/);
 assert.match(week,/data-rc1810-check="pick-single"/);
 assert.match(week,/data-rc1810-check="abd-single"/);
 assert.doesNotMatch(week,/data-rc1810-check="routine-uk"/,'Routine geschlossen, aber einmalige Aufgaben sichtbar');
 const mobile=board._weekListHtml([d],tasks,['Sevastian'],d);
 assert.match(mobile,/data-rc1810-worktype="picks"/);
 assert.match(mobile,/data-rc1810-check="pick-single"/);
 state.tasks=[];
});
test('RC1812: Arbeitsgruppennamen und Checkboxen bleiben groß genug',()=>{
 const css=fs.readFileSync('assets/rc1810-task-board.css','utf8');
 assert.match(css,/\.rc1810-worktoggle\{min-height:34px;font-size:\.86rem/);
 assert.match(css,/\.rc1810-worktasks \.rc1810-name\{font-size:\.88rem/);
 assert.match(css,/\.rc1810-worktasks \.rc1810-box\{width:19px;height:19px/);
});
