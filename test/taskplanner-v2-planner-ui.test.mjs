import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const context={console,Date,Intl,setTimeout,clearTimeout};
  context.globalThis=context;
  const de={
    'taskV2.planner.todaySummary':'Heute: {count} Aufgaben · {critical} kritisch · {overdue} überfällig',
    'taskV2.planner.overload':'Diese Woche ist überlastet.',
    'taskV2.planner.overdue':'Überfällig',
    'taskV2.planner.noOverdue':'Keine überfälligen Aufgaben',
    'taskV2.planner.currentWeek':'Aktuelle Woche',
    'taskV2.planner.nextWeek':'Nächste Woche',
    'taskV2.planner.month':'Monat',
    'taskV2.planner.workweek':'Arbeitswoche',
    'taskV2.planner.title':'Aufgabenplaner'
  };
  context.ExportHUBI18n={t(key,vars){let value=de[key]||key;if(vars)for(const [name,v] of Object.entries(vars))value=value.replaceAll('{'+name+'}',String(v));return value;}};
  for(const file of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/taskplanner-v2-planner.js','assets/taskplanner-v2-ui.js','assets/taskplanner-v2-planner-ui.js']){
    vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  }
  return context;
}

function task(id,date,extra={}){
  return {
    id,title:`Aufgabe ${id}`,status:'open',priority:'P2',plannedAt:`${date}T09:00:00+02:00`,
    dueAt:`${date}T16:15:00+02:00`,manualOverride:false,...extra
  };
}

const root=()=>({innerHTML:''});

test('Tageszusammenfassung zeigt Anzahl, kritische und überfällige Aufgaben kompakt',()=>{
  const {ExportHUBTaskUIV2:ui}=load(),state={tasks:[]};
  for(let i=0;i<9;i++)state.tasks.push(task(String(i+1),'2026-10-12',{priority:i<2?'P0':'P2',dueAt:i===0?'2026-10-12T10:00:00+02:00':'2026-10-12T16:15:00+02:00'}));
  const target=root();
  ui.renderDailySummary(target,{state,now:'2026-10-12T12:00:00+02:00'});
  assert.match(target.innerHTML,/Heute: 9 Aufgaben · 2 kritisch · 1 überfällig/);
  assert.match(target.innerHTML,/data-tpv2-daily-summary/);
});

test('Überfällige Aufgaben stehen in eigener Sektion und markieren die gesamte Karte',()=>{
  const {ExportHUBTaskUIV2:ui}=load(),state={tasks:[
    task('old','2026-10-10',{title:'Überfällige Zollprüfung',dueAt:'2026-10-10T16:15:00+02:00'}),
    task('future','2026-10-13',{title:'Morgen erledigen'})
  ]};
  const target=root();
  ui.renderOverdue(target,{state,now:'2026-10-12T12:00:00+02:00'});
  assert.match(target.innerHTML,/data-tpv2-overdue/);
  assert.match(target.innerHTML,/Überfällige Zollprüfung/);
  assert.doesNotMatch(target.innerHTML,/Morgen erledigen/);
  assert.match(target.innerHTML,/tpv2-task-card[^\"]*is-overdue/);
});

test('Arbeitswochenansicht zeigt ausgewählte und folgende Woche eindeutig getrennt',()=>{
  const {ExportHUBTaskUIV2:ui}=load(),state={tasks:[
    task('current','2026-10-12',{title:'Diese Woche'}),
    task('next','2026-10-19',{title:'Nächste Woche'})
  ]};
  const target=root();
  ui.renderWorkweek(target,{state,weekStart:'2026-10-12',now:'2026-10-12T08:00:00+02:00'});
  assert.match(target.innerHTML,/data-week-scope="current"/);
  assert.match(target.innerHTML,/data-week-scope="next"/);
  assert.match(target.innerHTML,/tpv2-week-next/);
  assert.match(target.innerHTML,/Diese Woche/);
  assert.match(target.innerHTML,/Nächste Woche/);
  assert.equal((target.innerHTML.match(/data-tpv2-drop-date=/g)||[]).length,10,'zwei Arbeitswochen müssen 10 Drop-Tage besitzen');
});

test('überlasteter Wochenentwurf zeigt die verbindliche Warnung',()=>{
  const {ExportHUBTaskUIV2:ui}=load(),target=root(),state={tasks:[task('a','2026-10-12')]};
  ui.renderWorkweek(target,{state,weekStart:'2026-10-12',now:'2026-10-12T08:00:00+02:00',weekDraft:{weekStart:'2026-10-12',weekEnd:'2026-10-16',proposals:[],conflicts:[],warnings:[],dependencyIssues:[],overloaded:true,manualChanges:0}});
  assert.match(target.innerHTML,/Diese Woche ist überlastet\./);
  assert.match(target.innerHTML,/data-tpv2-overload/);
});

test('Monatsansicht rendert nur leichte Tageszusammenfassungen statt voller Aufgabenkarten',()=>{
  const {ExportHUBTaskUIV2:ui}=load(),target=root(),state={tasks:[task('a','2026-10-12'),task('b','2026-10-12',{priority:'P0'})]};
  ui.renderMonth(target,{state,year:2026,month:10,now:'2026-10-12T08:00:00+02:00'});
  assert.match(target.innerHTML,/data-tpv2-month/);
  assert.match(target.innerHTML,/data-day-summary="2026-10-12"/);
  assert.doesNotMatch(target.innerHTML,/class="tpv2-task-card/);
  assert.doesNotMatch(target.innerHTML,/data-taskplanner-v2-detail/);
});

test('Planner-DnD delegiert genau einen Occurrence-Move an den Runtime-Owner',()=>{
  const {ExportHUBTaskUIV2:ui}=load();
  const originalDue='2026-10-12T16:15:00+02:00',state={tasks:[task('move','2026-10-12',{dueAt:originalDue})]};
  const calls=[];
  const runtime={plannerV2:{moveTaskOccurrence(id,plannedAt,ctx){calls.push({id,plannedAt,ctx});return{changed:true,task:{...state.tasks[0],plannedAt,manualOverride:true}};}}};
  const day={closest:sel=>sel==='[data-tpv2-drop-date], [data-i218-drop-date]'?day:null,getAttribute:name=>name==='data-tpv2-drop-date'?'2026-10-15':null};
  const card={closest:sel=>sel==='[data-task-id]'?card:null,getAttribute:name=>name==='data-task-id'?'move':null};
  const handlers={};
  const target={ownerDocument:{elementFromPoint:()=>day},addEventListener:(type,fn)=>{handlers[type]=fn}};
  ui.bindPlannerDnD(target,{state,runtime,now:'2026-10-12T08:00:00+02:00'});
  assert.equal(typeof handlers.pointerup,'function');
  handlers.pointerup({clientX:10,clientY:10,target:card});
  assert.equal(calls.length,1);
  assert.equal(calls[0].id,'move');
  assert.match(calls[0].plannedAt,/^2026-10-15T09:00:00\+02:00$/);
  assert.equal(state.tasks[0].dueAt,originalDue,'UI darf dueAt nicht selbst überschreiben');
});

test('generierter TESTSERVICE-Planer besitzt genau den V2-Cutover-Marker und delegiert den alten render-Einstieg',()=>{
  const html=fs.readFileSync('TESTVERSION.html','utf8');
  assert.match(html,/__EXPORTHUB_TASKPLANNER_V2_UI_CUTOVER__/);
  assert.match(html,/ExportHUBTaskUIV2\.renderPlannerPage/);
  const plannerStart=html.indexOf('function render(){if(rendering||view()!==\'planning\')return false;');
  assert.ok(plannerStart>=0,'autoritärer Planner-render-Einstieg fehlt');
  const head=html.slice(plannerStart,plannerStart+1800);
  assert.match(head,/__EXPORTHUB_TASKPLANNER_V2_UI_CUTOVER__/,'V2 muss vor dem Legacy-Markup entscheiden');
  assert.match(head,/return window\.ExportHUBTaskUIV2\.renderPlannerPage/,'Legacy-Renderer muss bei aktivem V2 früh zurückkehren');
});
test('Tageskarten sind nach Überfälligkeit, Priorität und Frist sortiert',()=>{
  const {ExportHUBTaskUIV2:ui}=load(),target=root(),state={tasks:[
    task('low','2026-10-13',{title:'Niedrig',priority:'P3'}),
    task('late','2026-10-13',{title:'Später fällig',priority:'P1',dueAt:'2026-10-16T16:15:00+02:00'}),
    task('critical','2026-10-13',{title:'Kritisch',priority:'P0'}),
    task('early','2026-10-13',{title:'Früher fällig',priority:'P1',dueAt:'2026-10-14T16:15:00+02:00'})
  ]};
  ui.renderWorkweek(target,{state,weekStart:'2026-10-12',now:'2026-10-12T08:00:00+02:00'});
  const order=[...target.innerHTML.matchAll(/data-task-id="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(order,['critical','early','late','low']);
});

function plannerTarget(){
  const handlers={};
  return {innerHTML:'',handlers,addEventListener:(type,fn)=>{handlers[type]=fn},querySelector:()=>null};
}
function button(attr,value){
  const node={getAttribute:name=>name===attr?value:null};
  node.closest=sel=>sel===`[${attr}]`?node:null;
  return node;
}

test('Wochenplan-Entwurf zeigt vor der Übernahme die Zusammenfassung und speichert erst nach Bestätigung',async()=>{
  const {ExportHUBTaskUIV2:ui}=load(),target=plannerTarget(),now='2026-10-12T08:00:00+02:00';
  const state={tasks:[
    {id:'open',title:'Ohne Termin',status:'open',priority:'P1',dueAt:'2026-10-14T16:15:00+02:00'},
    task('fixed','2026-10-13',{title:'Fest geplant',manualOverride:true})
  ]};
  const applied=[];
  const runtime={applyWeekPlan(draft,ctx){applied.push({draft,ctx});return{changed:true};}};
  ui.renderPlannerPage(target,{state,runtime,weekStart:'2026-10-12',now});
  assert.match(target.innerHTML,/data-tpv2-weekplan="plan"/);
  assert.match(target.innerHTML,/data-tpv2-weekplan="recalculate"/);
  assert.doesNotMatch(target.innerHTML,/data-tpv2-weekplan-summary/);

  await target.handlers.click({target:button('data-tpv2-weekplan','plan')});
  assert.match(target.innerHTML,/data-tpv2-weekplan-summary/);
  assert.match(target.innerHTML,/<li><strong>2<\/strong><span>Planned this week/);
  assert.match(target.innerHTML,/<li><strong>1<\/strong><span>Dates that will change/);
  assert.match(target.innerHTML,/<li><strong>1<\/strong><span>Manually planned, kept/);
  assert.doesNotMatch(target.innerHTML,/data-tpv2-weekplan="apply" disabled/);
  assert.equal(applied.length,0,'Entwurf darf nichts speichern');

  await target.handlers.click({target:button('data-tpv2-weekplan','apply')});
  assert.equal(applied.length,1);
  const item=applied[0].draft.items.find(x=>x.taskId==='open');
  assert.equal(item.plannedDate,'2026-10-14');
  assert.equal(applied[0].draft.items.find(x=>x.taskId==='fixed').manualProtected,true);
  assert.doesNotMatch(target.innerHTML,/data-tpv2-weekplan-summary/,'nach der Übernahme schließt der Entwurf');
});

test('Wochenplan mit Feiertagskonflikt kann nicht übernommen werden',async()=>{
  const {ExportHUBTaskUIV2:ui}=load(),target=plannerTarget(),applied=[];
  const state={tasks:[task('xmas','2026-12-25',{title:'Am Feiertag',manualOverride:true})]};
  ui.renderPlannerPage(target,{state,runtime:{applyWeekPlan:d=>applied.push(d)},weekStart:'2026-12-21',now:'2026-12-21T08:00:00+01:00',weekPlanMode:'plan'});
  assert.match(target.innerHTML,/data-conflict-type="holiday"/);
  assert.match(target.innerHTML,/data-tpv2-weekplan="apply" disabled/);
  assert.match(target.innerHTML,/data-tpv2-overload/);
  await target.handlers.click({target:button('data-tpv2-weekplan','apply')});
  assert.equal(applied.length,0);
  await target.handlers.click({target:button('data-tpv2-weekplan','discard')});
  assert.doesNotMatch(target.innerHTML,/data-tpv2-weekplan-summary/);
});
