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
 for(const name of ['rc1810-task-board.css','i18n/rc1810-task-board.js','rc1810-task-board.js'])assert.ok(build.includes(name+'?v=1811'),name);
});
