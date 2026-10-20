import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8').replace(/\r\n/g,'\n');
const html=fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n');
const css=fs.readFileSync('assets/rc1560-full-width.css','utf8');

function fnSource(src,name){
  const start=src.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' fehlt');
  let depth=0;
  for(let i=src.indexOf('{',start);i<src.length;i++){
    if(src[i]==='{')depth++;
    else if(src[i]==='}'&&--depth===0)return src.slice(start,i+1);
  }
  throw new Error(name+' nicht abgeschlossen');
}
// build functions are top-level declarations that end with a closing brace in column 0
function buildFn(name){
  const start=build.indexOf('\nfunction '+name+'(');
  assert.ok(start>=0,name+' fehlt im Build');
  return new Function('return '+build.slice(start+1,build.indexOf('\n}\n',start)+2))();
}
const patchTasks=buildFn('patchNotificationTasks');
const patchDetails=buildFn('patchNotificationTaskDetails');
const patched=patchDetails(patchTasks(html,'index.html'),'index.html');
const a=patched.indexOf('<script id="index236-notification-controller">');
const block=patched.slice(a,patched.indexOf('<!-- INDEX 236 NOTIFICATION CENTER END -->',a));

function sandbox(tasks,currentUser){
  const names=['q','low','arr','iso','localISO','fmtDate','isDone','taskIsTemplate','taskTitle','taskId','taskRef','taskOwner','taskOwnerKeys','taskForUser','taskDate','notificationTaskKey','openTasks','overdueTasks','taskPriorityRank','taskLine','urgentTasks','userName','esc','hintTaskList'];
  const code=names.map(n=>fnSource(block,n)).join('\n');
  const ctx={main:()=>({tasks}),user:()=>currentUser};
  vm.createContext(ctx);vm.runInContext(code,ctx);
  return ctx;
}
const me={id:'U-7',user:'t.limberg',name:'Tobias Limberg'};

test('RC1566 Build patcht das Benachrichtigungsmodul genau einmal',()=>{
  assert.match(block,/function taskOwnerKeys\(t\)/);
  assert.match(block,/\+\(empty\?'':hintTaskList\(\)\)\+'<div class="index236-hint-actions">/);
  assert.match(block,/function openTask\(id\)\{removeHint\(\);/);
  assert.match(fnSource(block,'boot'),/updateBadge\(\);bootCheck\(0\);scheduleNext\(\);/,'Startprüfung wartet auf geladene Aufgaben');
  assert.ok(fnSource(block,'bootCheck').includes("var u=user();if((typeof window.__EXPORTHUB_GET_STATE__!=='function'||!arr(main().tasks).length||!q(u.id||u.user||u.login||u.username))&&n<20){later(function(){bootCheck(n+1)},1500);return}checkSchedule(false)"),'wartet auf Benutzer und Aufgaben');
  assert.ok(block.includes("renderView();bootCheck(0);scheduleNext()}"),'auch exporthub:ready wartet auf geladene Aufgaben');
  assert.equal(block.split('checkSchedule(false)').length-1,2,'nur bootCheck und der Timer prüfen geplant');
  assert.match(fnSource(block,'renderView'),/var tasks=urgentTasks\(\)/,'Center sortiert nach Dringlichkeit');
  assert.match(fnSource(block,'taskCard'),/esc\(q\(t\.priority\)\.toUpperCase\(\)\)/,'Center zeigt die Priorität');
  assert.match(build,/html=patchNotificationTasks\(html,file\);\n\s*html=patchNotificationTaskDetails\(html,file\);/);
});

test('RC1566 Aufgaben, die per Benutzer-ID zugewiesen sind, zählen als eigene Aufgaben',()=>{
  const ctx=sandbox([
    {id:'1',title:'Per ID',status:'open',assignedTo:'U-7',owner:'U-7',effectiveAssignee:'U-7',dueAt:'2026-10-18T10:00:00.000Z'},
    {id:'2',title:'Per Name',status:'open',owner:'Tobias'},
    {id:'3',title:'Fremd',status:'open',owner:'Sevastian'},
    {id:'4',title:'Vertretung weg',status:'open',owner:'U-7',originalAssignee:'U-7',effectiveAssignee:'U-9'},
    {id:'5',title:'Ähnliche ID',status:'open',owner:'U-70',effectiveAssignee:'U-70'},
    {id:'6',title:'Erledigt',status:'Erledigt',owner:'U-7'},
    {id:'7',title:'Für alle',status:'open',owner:'Alle'}
  ],me);
  assert.deepEqual(Array.from(ctx.openTasks(),t=>t.id),['1','2','7']);
});

test('RC1566 dueAt mit Zeitzone wird als lokaler Kalendertag gelesen',()=>{
  const ctx=sandbox([],me);
  const d=new Date('2026-10-18T10:00:00.000Z');
  const local=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  assert.equal(ctx.taskDate({dueAt:'2026-10-18T10:00:00.000Z'}),local);
  assert.equal(ctx.taskDate({dueDate:'19.10.2026'}),'2026-10-19');
  assert.equal(ctx.taskDate({day:'Montag'}),'');
});

test('RC1566 Hinweis und Push nennen konkrete Aufgaben nach Fälligkeit und Priorität',()=>{
  const ctx=sandbox([
    {id:'a',title:'Ladeliste vorbereiten',status:'open',owner:'U-7',priority:'P3',dueDate:'2026-10-19'},
    {id:'b',title:'Abholtag',status:'open',owner:'U-7',priority:'P1',dueDate:'2026-10-18'},
    {id:'c',title:'ABD <prüfen>',status:'open',owner:'U-7',priority:'P0',dueDate:'2026-10-18'}
  ],me);
  assert.deepEqual(Array.from(ctx.urgentTasks(),t=>t.id),['c','b','a']);
  assert.match(ctx.taskLine({title:'X',priority:'p1',dueDate:'2026-10-18'}),/^X · P1 · fällig /);
  const list=ctx.hintTaskList();
  assert.equal((list.match(/data-index236-action="open-task"/g)||[]).length,3);
  assert.match(list,/ABD &lt;prüfen&gt;/,'Titel werden escaped');
  const notify=fnSource(block,'nativeNotify');
  assert.match(notify,/one\?'ExportHUB · '\+taskTitle\(one\)/);
  assert.match(notify,/if\(one\)openTask\(taskId\(one\)\);else openView\(\)/);
  assert.doesNotMatch(notify,/'ExportHUB · '\+label,/,'kein reiner Zähler-Push mehr');
});

test('RC1566 Entwickler-Etikett privatePill wird in den Seitenköpfen nicht mehr angezeigt',()=>{
  assert.match(css,/html body #content \.page-head > span\.pill\.blue:last-child\{display:none!important\}/);
});
