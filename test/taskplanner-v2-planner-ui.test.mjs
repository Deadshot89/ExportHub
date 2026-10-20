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

test('Monatsansicht beginnt am richtigen Wochentag und markiert Feiertage und Wochenenden',()=>{
  const {ExportHUBTaskUIV2:ui}=load(),target=root();
  ui.renderMonth(target,{state:{tasks:[]},year:2026,month:12,now:'2026-12-01T08:00:00+01:00'});
  assert.equal((target.innerHTML.match(/tpv2-month-pad/g)||[]).length,1,'1. Dezember 2026 ist ein Dienstag');
  assert.match(target.innerHTML,/class="tpv2-month-day is-nonwork" data-day-summary="2026-12-25" aria-label="2026-12-25 · 1\. Weihnachtstag"/);
  assert.match(target.innerHTML,/<small>1\. Weihnachtstag<\/small>/);
  assert.match(target.innerHTML,/class="tpv2-month-day is-weekend" data-day-summary="2026-12-27"/);
});

test('Klick auf einen Monatstag zeigt erst dann dessen Aufgaben, Monatsnavigation blättert',async()=>{
  const {ExportHUBTaskUIV2:ui}=load(),target=plannerTarget(),now='2026-10-12T08:00:00+02:00';
  const state={tasks:[task('a','2026-10-14',{title:'Am Mittwoch'})]};
  ui.renderPlannerPage(target,{state,now,view:'month'});
  assert.doesNotMatch(target.innerHTML,/Am Mittwoch/);
  await target.handlers.click({target:button('data-day-summary','2026-10-14')});
  assert.match(target.innerHTML,/data-tpv2-month-detail="2026-10-14"/);
  assert.match(target.innerHTML,/Am Mittwoch/);
  await target.handlers.click({target:button('data-tpv2-month-day-close','')});
  assert.doesNotMatch(target.innerHTML,/data-tpv2-month-detail/);
  await target.handlers.click({target:button('data-tpv2-nav','month-next')});
  assert.match(target.innerHTML,/11\/2026/);
  assert.match(target.innerHTML,/data-day-summary="2026-11-01"/);
  await target.handlers.click({target:button('data-tpv2-nav','month-prev')});
  await target.handlers.click({target:button('data-tpv2-nav','month-prev')});
  assert.match(target.innerHTML,/09\/2026/);
  await target.handlers.click({target:button('data-tpv2-nav','month-today')});
  assert.match(target.innerHTML,/10\/2026/);
});

test('Wochennavigation blättert vorwärts und nicht vor die aktuelle Woche',async()=>{
  const {ExportHUBTaskUIV2:ui}=load(),target=plannerTarget(),now='2026-10-12T08:00:00+02:00';
  ui.renderPlannerPage(target,{state:{tasks:[]},now,weekStart:'2026-10-12'});
  assert.match(target.innerHTML,/data-tpv2-nav="week-prev"[^>]*disabled/);
  await target.handlers.click({target:button('data-tpv2-nav','week-next')});
  assert.match(target.innerHTML,/data-tpv2-drop-date="2026-10-19"/);
  assert.doesNotMatch(target.innerHTML,/data-tpv2-drop-date="2026-10-12"/);
  await target.handlers.click({target:button('data-tpv2-nav','week-prev')});
  await target.handlers.click({target:button('data-tpv2-nav','week-prev')});
  assert.match(target.innerHTML,/data-tpv2-drop-date="2026-10-12"/);
});

test('Wochenspalten markieren Feiertage, Karten nennen die Tage der Überfälligkeit',()=>{
  const {ExportHUBTaskUIV2:ui}=load(),target=root();
  const state={tasks:[task('late','2026-12-14',{title:'Lange überfällig',dueAt:'2026-12-14T16:15:00+01:00'})]};
  ui.renderPlannerPage(target,{state,weekStart:'2026-12-21',now:'2026-12-21T10:00:00+01:00'});
  assert.match(target.innerHTML,/class="tpv2-day is-nonwork" data-tpv2-drop-date="2026-12-25"[\s\S]*?1\. Weihnachtstag/);
  assert.match(target.innerHTML,/7 days overdue/);
});

test('Aufgaben ohne Termin stehen im eigenen Bereich',()=>{
  const {ExportHUBTaskUIV2:ui}=load(),target=root();
  const state={tasks:[{id:'free',title:'Irgendwann',status:'open',priority:'P2'},task('dated','2026-10-13')]};
  ui.renderPlannerPage(target,{state,weekStart:'2026-10-12',now:'2026-10-12T08:00:00+02:00'});
  const section=target.innerHTML.slice(target.innerHTML.indexOf('data-tpv2-unplanned'));
  assert.match(section,/Irgendwann/);
  assert.ok(target.innerHTML.indexOf('data-tpv2-unplanned')>=0);
  assert.doesNotMatch(section.slice(0,section.indexOf('data-week-scope')),/data-task-id="dated"/);
});

test('Klick ohne Tageswechsel verschiebt nichts, Alt+Pfeil verschiebt per Tastatur',()=>{
  const {ExportHUBTaskUIV2:ui}=load(),calls=[];
  const state={tasks:[task('t','2026-10-13')]};
  const runtime={moveTaskOccurrence(id,plannedAt){calls.push({id,plannedAt});return{changed:true};}};
  const dayNode=date=>({closest:sel=>sel==='[data-tpv2-drop-date], [data-i218-drop-date]'?dayNode(date):null,getAttribute:name=>name==='data-tpv2-drop-date'?date:null});
  const card={closest:sel=>sel==='[data-task-id]'?card:null,getAttribute:name=>name==='data-task-id'?'t':null};
  const handlers={},days=['2026-10-12','2026-10-13','2026-10-14'].map(dayNode);
  const target={ownerDocument:{elementFromPoint:()=>days[1]},addEventListener:(type,fn)=>{handlers[type]=fn},querySelectorAll:()=>days};
  ui.bindPlannerDnD(target,{state,runtime,now:'2026-10-12T08:00:00+02:00'});
  handlers.pointerdown({target:card,clientX:5,clientY:5});
  handlers.pointerup({target:card,clientX:5,clientY:5});
  assert.equal(calls.length,0,'ein Klick darf keine manuelle Verschiebung erzeugen');
  handlers.keydown({target:card,altKey:true,key:'ArrowRight',preventDefault(){}});
  assert.equal(calls.length,1);
  assert.match(calls[0].plannedAt,/^2026-10-14T09:00/);
  handlers.keydown({target:card,altKey:false,key:'ArrowLeft'});
  assert.equal(calls.length,1);
});

test('Neu berechnen überschreibt manuelle Planung erst nach ausdrücklicher Wahl mit Warnung',async()=>{
  const {ExportHUBTaskUIV2:ui}=load(),target=plannerTarget(),applied=[];
  const state={tasks:[task('fixed','2026-10-16',{title:'Manuell Freitag',manualOverride:true,dueAt:'2026-10-13T16:15:00+02:00'})]};
  const runtime={applyWeekPlan(draft,ctx){applied.push({draft,ctx});return{changed:true};}};
  ui.renderPlannerPage(target,{state,runtime,weekStart:'2026-10-12',now:'2026-10-12T08:00:00+02:00',weekPlanMode:'recalculate'});
  assert.match(target.innerHTML,/<li><strong>1<\/strong><span>Manually planned, kept/);
  assert.match(target.innerHTML,/data-tpv2-weekplan="override"/);
  assert.doesNotMatch(target.innerHTML,/manually planned tasks will be moved/);
  await target.handlers.click({target:button('data-tpv2-weekplan','override')});
  assert.match(target.innerHTML,/role="alert">1 manually planned tasks will be moved/);
  assert.match(target.innerHTML,/<li><strong>1<\/strong><span>Manual plans overwritten/);
  await target.handlers.click({target:button('data-tpv2-weekplan','apply')});
  assert.equal(applied.length,1);
  assert.equal(applied[0].ctx.allowManualOverride,true);
  const item=applied[0].draft.items.find(x=>x.taskId==='fixed');
  assert.equal(item.manualProtected,false);
  assert.equal(item.plannedDate,'2026-10-13');
});

test('Aufgabendetails öffnen als Panel und schließen mit Escape',async()=>{
  const {ExportHUBTaskUIV2:ui}=load(),host={innerHTML:'',querySelector:()=>null};
  const target=plannerTarget();target.querySelector=sel=>sel==='[data-tpv2-detail-host]'?host:null;
  ui.renderPlannerPage(target,{state:{tasks:[task('a','2026-10-13',{title:'Detailaufgabe'})]},weekStart:'2026-10-12',now:'2026-10-12T08:00:00+02:00'});
  let focused=false;
  const card={getAttribute:name=>name==='data-task-id'?'a':null,focus(){focused=true;}};
  card.closest=sel=>sel==='.tpv2-task-card[data-task-id]'?card:null;
  await target.handlers.click({target:card});
  assert.match(host.innerHTML,/data-taskplanner-v2-detail/);
  assert.match(host.innerHTML,/Detailaufgabe/);
  target.handlers.keydown({key:'Escape',preventDefault(){}});
  assert.equal(host.innerHTML,'');
  assert.equal(focused,true,'Fokus kehrt zur Karte zurück');
});

function detailSetup(state){
  const {ExportHUBTaskUIV2:ui}=load(),host={innerHTML:'',querySelector:()=>null};
  const target=plannerTarget();target.querySelector=sel=>sel==='[data-tpv2-detail-host]'?host:null;
  const ctx={state,weekStart:'2026-10-12',now:'2026-10-12T08:00:00+02:00',persist:()=>{},user:{id:'u1',name:'Tobias'}};
  ui.renderPlannerPage(target,ctx);
  return {ui,host,target};
}
function detailAction(action,taskId,extra={}){
  const owner={getAttribute:name=>name==='data-task-id'?taskId:null};
  const fields=extra.fields||{};
  const panel={querySelector:sel=>{const key=sel.slice(1,-1);return key in fields?{value:fields[key]}:null;}};
  const node={getAttribute:name=>name==='data-action'?action:(name==='data-index'?extra.index:null)};
  node.closest=sel=>sel==='[data-action]'?node:sel==='[data-task-id]'?owner:sel==='[data-taskplanner-v2-detail]'?panel:null;
  return node;
}

test('Detailpanel im Planer: Checkliste abhaken, kommentieren, als Vorlage speichern, mit Kommentar erledigen',async()=>{
  const state={tasks:[task('a','2026-10-13',{title:'Detailaufgabe',checklist:[{text:'Punkt 1'},{text:'Punkt 2'}]})]};
  const {host,target}=detailSetup(state);
  await target.handlers.click({target:detailAction('checklist-toggle','a',{index:'1'})});
  assert.equal(state.tasks[0].checklist[1].done,true);
  assert.match(host.innerHTML,/data-index="1" checked/);
  await target.handlers.click({target:detailAction('comment-add','a',{fields:{'data-tpv2-comment-input':'Rückruf erledigt'}})});
  assert.equal(state.tasks[0].comments.at(-1).text,'Rückruf erledigt');
  assert.match(host.innerHTML,/Rückruf erledigt/);
  await target.handlers.click({target:detailAction('save-template','a')});
  assert.equal(state.taskTemplates.length,1);
  assert.equal(state.tasks.length,1,'Vorlage überschreibt die Aufgaben nicht');
  assert.match(host.innerHTML,/data-tpv2-detail-note/);
  await target.handlers.click({target:detailAction('complete','a',{fields:{'data-tpv2-complete-comment':'Alles geprüft'}})});
  assert.equal(state.tasks[0].status,'done');
  assert.equal(state.tasks[0].history.at(-1).comment,'Alles geprüft');
});

test('Kompakt/Detailliert wird pro Benutzer gespeichert und auf den Planer angewendet',async()=>{
  const state={tasks:[task('a','2026-10-13')]};
  const {target}=detailSetup(state);
  assert.match(target.innerHTML,/data-density="detailed"/);
  await target.handlers.click({target:button('data-tpv2-density','compact')});
  assert.equal(state.taskSettings.users.u1.viewMode,'compact');
  assert.match(target.innerHTML,/data-density="compact"/);
  assert.equal(state.tasks.length,1);
  const fresh=plannerTarget(),{ExportHUBTaskUIV2:ui}=load();
  ui.renderPlannerPage(fresh,{state,weekStart:'2026-10-12',now:'2026-10-12T08:00:00+02:00',user:{id:'u1'}});
  assert.match(fresh.innerHTML,/data-density="compact"/);
});
