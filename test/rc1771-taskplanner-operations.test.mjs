import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const context={Date,Intl,console,setTimeout,clearTimeout};
  context.globalThis=context;
  context.ExportHUBI18n={t:key=>key};
  for(const file of [
    'assets/taskplanner-v2-core.js',
    'assets/taskplanner-v2-recurrence.js',
    'assets/taskplanner-v2-planner.js',
    'assets/taskplanner-v2-ui.js',
    'assets/taskplanner-v2-planner-ui.js'
  ])vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  return context;
}
function task(id,title,date,ref='S123'){
  return {id,title,status:'open',shipmentRef:ref,plannedAt:date+'T09:00:00',dueAt:date+'T15:00:00',priority:'P2'};
}
function scenario(){
  return [
    task('pick','Picken','2026-11-03'),
    task('abd','ABD erstellen','2026-11-03'),
    task('avis','Anmeldung','2026-11-03')
  ];
}
test('RC1771: ABD am Pick-Tag ist orange und nur nach ausdrücklicher Bestätigung aufgehoben',()=>{
  const api=load().ExportHUBTaskPlannerV2,tasks=scenario();
  let result=api.inspectOperationalPlan({tasks});
  assert.equal(result.byTaskId.abd.type,'abd_same_day');
  assert.equal(api.approveSameDayAbd(tasks,{taskId:'abd'}).changed,false,'ohne Benutzer keine Zustimmung');
  assert.equal(api.approveSameDayAbd(tasks,{taskId:'pick',actorId:'u1'}).changed,false,'Picken darf nicht ABD freigeben');
  const approved=api.approveSameDayAbd(tasks,{taskId:'abd',actorId:'u1',at:'2026-11-03T13:00:00+01:00'});
  assert.equal(approved.changed,true);
  assert.equal(approved.tasks.find(x=>x.id==='abd').planningSameDayAbdApproval.by,'u1');
  assert.equal(approved.tasks.find(x=>x.id==='abd').history.at(-1).action,'same_day_abd_confirmed');
  result=api.inspectOperationalPlan({tasks:approved.tasks});
  assert.equal(result.byTaskId.abd,undefined);
  assert.equal(tasks.find(x=>x.id==='abd').planningSameDayAbdApproval,undefined,'nur Kopie wird verändert');
});
test('RC1771: Bestätigung ist termin- und sendungsbezogen und bei Neuplanung ungültig',()=>{
  const api=load().ExportHUBTaskPlannerV2;
  const approved=api.approveSameDayAbd(scenario(),{taskId:'abd',actorId:'u1'}).tasks;
  const rescheduled=approved.map(t=>({...t,plannedAt:'2026-11-04T09:00:00'}));
  const result=api.inspectOperationalPlan({tasks:rescheduled});
  assert.equal(result.byTaskId.abd.type,'abd_same_day');
  assert.equal(result.byTaskId.abd.date,'2026-11-04');
  assert.equal(approved.find(t=>t.id==='abd').planningSameDayAbdApproval.by,'u1','Historie bleibt erhalten');
});
test('RC1771: Abholung wird nicht automatisch geändert; Plan erkennt Konflikt zur Spedition',()=>{
  const api=load().ExportHUBTaskPlannerV2;
  const shipments=[{id:'S123',pickupDate:'2026-11-04',customerNumber:'009900'}];
  const fixedPickups=[{id:'fix-1',weekday:3,customerNumber:'9900',active:true}];
  const clean=api.inspectOperationalPlan({tasks:scenario(),shipments,fixedPickups,fixedPickupDataLoaded:true});
  assert.equal(clean.warnings.some(w=>w.type==='pickup_notification'),false);
  const moved=scenario().map(t=>({...t,plannedAt:'2026-11-04T09:00:00'}));
  const impacted=api.inspectOperationalPlan({tasks:moved,shipments,fixedPickups,fixedPickupDataLoaded:true});
  assert.ok(impacted.warnings.some(w=>w.type==='pickup_notification'));
  assert.ok(impacted.warnings.some(w=>w.type==='fixed_pickup_conflict'));
  assert.equal(shipments[0].pickupDate,'2026-11-04','Abholkalender unverändert');
});
test('RC1771: EU-Anmeldung ohne ABD führt nicht zu einer falschen ABD-Warnung',()=>{
  const api=load().ExportHUBTaskPlannerV2;
  const tasks=[task('pick','Picken','2026-11-03'),task('avis','Anmelden','2026-11-03')];
  const result=api.inspectOperationalPlan({tasks});
  assert.equal(result.warnings.length,0);
});
test('RC1771: Mehrere ABD-Vorgänge einer Sendung werden nicht blind verknüpft',()=>{
  const api=load().ExportHUBTaskPlannerV2;
  const tasks=[task('pick','Picken','2026-11-03'),task('abd1','ABD erstellen','2026-11-03'),task('abd2','ABD erneuern','2026-11-03')];
  const result=api.inspectOperationalPlan({tasks});
  assert.equal(result.warnings[0].type,'ambiguous_link');
  assert.equal(api.approveSameDayAbd(tasks,{taskId:'abd1',actorId:'u1'}).changed,false);
});
test('RC1771: orange ABD-Karte mit Bestätigungsaktion und Abholkalenderwarnung',async()=>{
  const root=load(),state={tasks:scenario(),shipments:[{id:'S123',pickupDate:'2026-11-03'}]};
  const handlers={};let writes=0;
  const target={innerHTML:'',addEventListener(type,fn){handlers[type]=fn;},querySelector(){return null;}};
  root.ExportHUBTaskUIV2.renderPlannerPage(target,{state,weekStart:'2026-11-02',
    now:'2026-11-03T12:00:00+01:00',user:{id:'u1'},persist(next){writes++;state.tasks=next;}});
  assert.match(target.innerHTML,/is-abd-exception/);
  assert.match(target.innerHTML,/data-tpv2-abd-approve="abd"/);
  assert.match(target.innerHTML,/data-rule-type="pickup_notification"/);
  const button={getAttribute:key=>key==='data-tpv2-abd-approve'?'abd':null,
    closest:sel=>sel==='[data-tpv2-abd-approve]'?button:null};
  await handlers.click({target:button});
  assert.equal(writes,1);
  assert.ok(state.tasks.find(t=>t.id==='abd').planningSameDayAbdApproval);
  assert.doesNotMatch(target.innerHTML,/is-abd-exception/);
});

test('RC1771: feste Speditionsabholung wird auch ohne individuelle Abholbuchung geprüft',()=>{
  const api=load().ExportHUBTaskPlannerV2;
  const tasks=[task('pick','Picken','2026-11-03'),task('abd','ABD erstellen','2026-11-04')];
  const shipments=[{id:'S123',customerNumber:'00123'}];
  const fixedPickups=[{weekday:3,customerNumber:'123',active:true}];
  const result=api.inspectOperationalPlan({tasks,shipments,fixedPickups,fixedPickupDataLoaded:true});
  assert.ok(result.warnings.some(w=>w.type==='fixed_pickup_conflict'));
  assert.equal(result.warnings.some(w=>w.type==='pickup_notification'),false);
});
test('RC1771: Wochenplanentwurf warnt vor geplanter ABD-Kollision ohne vorzeitige Bestätigung',()=>{
  const root=load(),state={tasks:[
    {...task('pick','Picken','2026-11-02'),dueAt:'2026-11-03T16:00:00'},
    task('abd','ABD erstellen','2026-11-03')
  ]};
  const target={innerHTML:''};
  root.ExportHUBTaskUIV2.renderPlannerPage(target,{state,weekStart:'2026-11-02',
    weekPlanMode:'recalculate',now:'2026-11-02T10:00:00+01:00'});
  assert.match(target.innerHTML,/data-mode="recalculate"/);
  assert.match(target.innerHTML,/data-rule-type="abd_same_day"/);
  assert.doesNotMatch(target.innerHTML,/data-tpv2-abd-approve=/,'Vorschau darf nicht für noch unveränderte Daten freigeben');
  assert.equal(state.tasks[0].plannedAt,'2026-11-02T09:00:00','Vorschau darf reale Aufgabe nicht verschieben');
});

test('RC1771 Deepfix: Serienkunden Picken und ABD werden mit Kundennummer und Ursprungswoche gekoppelt',()=>{
  const api=load().ExportHUBTaskPlannerV2;
  const tasks=[
    {id:'M848:mo-p-uk:2026-W45',title:'UK',area:'Picken',status:'offen',weekKey:'2026-W45',
      customerNumber:'004711',masterTaskRC848:true,plannedAt:'2026-11-03T09:00:00'},
    {id:'M848:di-a-uk:2026-W45',title:'UK',area:'ABD erstellen',status:'offen',weekKey:'2026-W45',
      customerNumber:'4711',masterTaskRC848:true,plannedAt:'2026-11-03T10:00:00'}
  ];
  const before=api.inspectOperationalPlan({tasks});
  assert.equal(before.warnings[0].type,'abd_same_day');
  assert.equal(before.warnings[0].groupId,'CUSTOMER:4711:2026-W45');
  const approved=api.approveSameDayAbd(tasks,{taskId:tasks[1].id,actorId:'u1'});
  assert.equal(approved.changed,true);
  assert.equal(api.inspectOperationalPlan({tasks:approved.tasks}).warnings.length,0);
});
test('RC1771 Deepfix: mehrere Kundenkonten oder doppelte ABDs werden nicht blind zugeordnet',()=>{
  const api=load().ExportHUBTaskPlannerV2;
  const tasks=[
    {id:'p',title:'UK',area:'Picken',weekKey:'2026-W45',customerNumber:'4711,815',plannedAt:'2026-11-03'},
    {id:'abd1',title:'UK',area:'ABD',weekKey:'2026-W45',customerNumber:'4711',plannedAt:'2026-11-03'},
    {id:'abd2',title:'UK',area:'ABD',weekKey:'2026-W45',customerNumber:'4711',plannedAt:'2026-11-03'}
  ];
  const inspected=api.inspectOperationalPlan({tasks});
  assert.equal(inspected.unlinkedTasks,1,'mehrere Konten nicht eindeutig verknüpft');
  assert.equal(inspected.warnings[0].type,'ambiguous_link');
  assert.equal(api.approveSameDayAbd(tasks,{taskId:'abd1',actorId:'u1'}).changed,false);
});
test('RC1771 Deepfix: fester Abholtag bei Serienkunde wird ohne Sendungsanlage geprüft',()=>{
  const api=load().ExportHUBTaskPlannerV2;
  const tasks=[
    {id:'p',title:'UK',area:'Picken',weekKey:'2026-W45',customerNumber:'004711',plannedAt:'2026-11-04T09:00:00'},
    {id:'a',title:'UK',area:'ABD erstellen',weekKey:'2026-W45',customerNumber:'4711',plannedAt:'2026-11-05T10:00:00'}
  ];
  const fixedPickups=[{id:'F',active:true,weekday:3,customerNumber:'4711, 0815'}];
  const inspection=api.inspectOperationalPlan({tasks,shipments:[],fixedPickups,fixedPickupDataLoaded:true});
  assert.ok(inspection.warnings.some(w=>w.type==='fixed_pickup_conflict'));
  assert.equal(inspection.matchedPickupGroups,0,'keine Sendung wurde erfunden');
  assert.equal(inspection.hasFixedPickupData,true);
});

test('RC1771 Deepfix: Serienkunde zeigt orange ABD-Karte mit aktiver Bestätigung im Wochenplan',async()=>{
  const root=load();
  const state={tasks:[
    {id:'M848:mo-p-uk:2026-W45',title:'UK',area:'Picken',status:'open',
      masterTaskRC848:true,weekKey:'2026-W45',customerNumber:'04711',plannedAt:'2026-11-03T09:00:00'},
    {id:'M848:di-a-uk:2026-W45',title:'UK',area:'ABD erstellen',status:'open',
      masterTaskRC848:true,weekKey:'2026-W45',customerNumber:'4711',plannedAt:'2026-11-03T10:00:00'}
  ]};
  let persisted=0;const handlers={},target={innerHTML:'',querySelector:()=>null,
    addEventListener(type,fn){handlers[type]=fn;}};
  root.ExportHUBTaskUIV2.renderPlannerPage(target,{state,weekStart:'2026-11-02',now:'2026-11-03T12:00:00+01:00',
    user:{id:'u1'},persist(next){state.tasks=next;persisted++;}});
  assert.match(target.innerHTML,/is-abd-exception/);
  assert.match(target.innerHTML,/data-tpv2-abd-approve="M848:di-a-uk:2026-W45"/);
  const control={getAttribute:key=>key==='data-tpv2-abd-approve'?'M848:di-a-uk:2026-W45':null};
  control.closest=sel=>sel==='[data-tpv2-abd-approve]'?control:null;
  await handlers.click({target:control});
  assert.equal(persisted,1);
  assert.doesNotMatch(target.innerHTML,/is-abd-exception/);
  assert.equal(state.tasks[1].planningSameDayAbdApproval.by,'u1');
});

test('RC1771 Deepfix: historische überfällige Vorgänge erzeugen keine Warnungen im aktuellen Plan',()=>{
  const root=load(),state={tasks:[
    task('old-pick','Picken','2026-10-20','OLD'),
    task('old-abd','ABD erstellen','2026-10-20','OLD'),
    task('this-week','Picken','2026-11-03','NEW')
  ]};
  const target={innerHTML:''};
  root.ExportHUBTaskUIV2.renderPlannerPage(target,{state,weekStart:'2026-11-02',now:'2026-11-03T12:00:00+01:00'});
  assert.match(target.innerHTML,/this-week/);
  assert.doesNotMatch(target.innerHTML,/data-rule-type="abd_same_day"/);
  assert.doesNotMatch(target.innerHTML,/data-tpv2-overdue/);
  assert.equal(state.tasks.length,3,'historische Aufgaben bleiben gespeichert');
  const month={innerHTML:''};
  root.ExportHUBTaskUIV2.renderPlannerPage(month,{state,view:'month',year:2026,month:11,now:'2026-11-03T12:00:00+01:00'});
  assert.doesNotMatch(month.innerHTML,/data-rule-type="abd_same_day"/);
});

test('RC1771 Deepfix: ABD-Bestätigung funktioniert bei legacy Woche/Tag ohne Datumsfeld',()=>{
  const api=load().ExportHUBTaskPlannerV2;
  const tasks=[
    {id:'M848:di-p-uk:2026-W45',title:'UK',area:'Picken',customerNumber:'4711',
      weekKey:'2026-W45',day:'Dienstag',masterTaskRC848:true,status:'offen'},
    {id:'M848:di-a-uk:2026-W45',title:'UK',area:'ABD erstellen',customerNumber:'004711',
      weekKey:'2026-W45',day:'Dienstag',masterTaskRC848:true,status:'offen'}
  ];
  const check=api.inspectOperationalPlan({tasks});
  assert.equal(check.byTaskId[tasks[1].id].type,'abd_same_day');
  assert.equal(check.byTaskId[tasks[1].id].date,'2026-11-03');
  const approved=api.approveSameDayAbd(tasks,{taskId:tasks[1].id,actorId:'u1'});
  assert.equal(approved.changed,true,'Bestätigung darf nicht an fehlendem plannedAt scheitern');
  assert.ok(approved.tasks[1].planningSameDayAbdApproval);
  assert.equal(api.inspectOperationalPlan({tasks:approved.tasks}).warnings.length,0);
  assert.equal(tasks[0].plannedAt,undefined,'Altdaten bleiben unverändert');
});
test('RC1771 Deepfix: ausdrückliche ABD-Pflicht auf Pick-Aufgabe wird ohne Sendungsanlage erkannt',()=>{
  const api=load().ExportHUBTaskPlannerV2;
  const tasks=[{id:'M848:mo-p-non-eu:2026-W45',title:'Nicht-EU Kunde',
    area:'Picken',customerNumber:'4711',weekKey:'2026-W45',day:'Montag',
    masterTaskRC848:true,abdRequired:true,status:'open'}];
  const check=api.inspectOperationalPlan({tasks,shipments:[]});
  assert.equal(check.byTaskId[tasks[0].id].type,'abd_missing');
});

test('RC1771 Deepfix: erledigtes Picken bleibt eine ABD-Abhängigkeit und wird nicht als offen gezeigt',async()=>{
  const root=load(),api=root.ExportHUBTaskPlannerV2;
  const state={tasks:[
    {id:'M848:di-p-uk:2026-W45',title:'UK',area:'Picken',customerNumber:'4711',
      weekKey:'2026-W45',day:'Dienstag',masterTaskRC848:true,status:'done',done:true},
    {id:'M848:di-a-uk:2026-W45',title:'UK',area:'ABD erstellen',customerNumber:'04711',
      weekKey:'2026-W45',day:'Dienstag',masterTaskRC848:true,status:'offen'}
  ]};
  const warning=api.inspectOperationalPlan({tasks:state.tasks});
  assert.equal(warning.byTaskId[state.tasks[1].id].type,'abd_same_day');
  const target={innerHTML:'',querySelector:()=>null,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
  let saved=0;
  root.ExportHUBTaskUIV2.renderPlannerPage(target,{state,weekStart:'2026-11-02',
    now:'2026-11-03T10:00:00+01:00',user:{id:'u1'},persist(next){state.tasks=next;saved++;}});
  assert.match(target.innerHTML,/is-abd-exception/,'offenes ABD bleibt orange');
  assert.doesNotMatch(target.innerHTML,/data-task-id="M848:di-p-uk:2026-W45"/,'erledigtes Picken wird nicht als offene Karte angezeigt');
  const control={getAttribute:key=>key==='data-tpv2-abd-approve'?state.tasks[1].id:null};
  control.closest=selector=>selector==='[data-tpv2-abd-approve]'?control:null;
  await target.handlers.click({target:control});
  assert.equal(saved,1);
  assert.doesNotMatch(target.innerHTML,/is-abd-exception/);
  assert.equal(state.tasks[0].status,'done','Pick-Abschluss bleibt erhalten');
});

test('RC1771 Deepfix: Wochenwechsel bewahrt ABD-Konflikt der gleichen Ursprungswoche',()=>{
  const root=load(),state={tasks:[
    {id:'p',title:'Picken',shipmentRef:'CROSS',status:'open',plannedAt:'2026-11-09T09:00:00'},
    {id:'a',title:'ABD erstellen',shipmentRef:'CROSS',status:'open',plannedAt:'2026-11-06T10:00:00'}
  ]};
  const prev={innerHTML:''},next={innerHTML:''};
  root.ExportHUBTaskUIV2.renderPlannerPage(prev,{state,weekStart:'2026-11-02',now:'2026-11-03T10:00:00+01:00'});
  root.ExportHUBTaskUIV2.renderPlannerPage(next,{state,weekStart:'2026-11-09',now:'2026-11-03T10:00:00+01:00'});
  assert.match(prev.innerHTML,/data-rule-type="abd_before_pick"/,'ABD in Vorwoche muss warnen');
  assert.match(next.innerHTML,/data-rule-type="abd_before_pick"/,'Pick in Folgewoche muss warnen');
  assert.equal(state.tasks[0].plannedAt,'2026-11-09T09:00:00');
});
test('RC1771 Deepfix: ABD-Bestätigung wird nach Hin- und Rückverschieben wieder ungültig',()=>{
  const api=load().ExportHUBTaskPlannerV2,tasks=scenario();
  const approved=api.approveSameDayAbd(tasks,{taskId:'abd',actorId:'u1',at:'2026-11-03T09:00:00Z'}).tasks;
  assert.equal(api.inspectOperationalPlan({tasks:approved}).byTaskId.abd,undefined);
  const moved=approved.map(t=>t.id==='pick'?{
    ...t,plannedAt:'2026-11-04T09:00:00',
    history:[...(t.history||[]),{action:'manual_move',at:'2026-11-03T10:00:00Z'}]
  }:t);
  const restored=moved.map(t=>t.id==='pick'?{
    ...t,plannedAt:'2026-11-03T09:00:00',
    history:[...(t.history||[]),{action:'manual_move',at:'2026-11-03T11:00:00Z'}]
  }:t);
  const check=api.inspectOperationalPlan({tasks:restored});
  assert.equal(check.byTaskId.abd.type,'abd_same_day');
  assert.ok(check.byTaskId.abd.signature!==approved[1].planningSameDayAbdApproval.signature);
});

test('RC1771 Deepfix: abgeschlossene und archivierte Aufgaben tauchen im Plan nicht wieder auf',()=>{
  const root=load(),state={tasks:[
    {id:'old-complete',title:'Erledigte Aufgabe',status:'Abgeschlossen',plannedAt:'2026-11-03T09:00:00'},
    {id:'old-archive',title:'Archivierte Aufgabe',status:'Archiviert',plannedAt:'2026-11-04T09:00:00'},
    {id:'open',title:'Picken aktuell',status:'offen',plannedAt:'2026-11-03T09:00:00'}
  ]};
  const target={innerHTML:''};
  root.ExportHUBTaskUIV2.renderWorkweek(target,{state,weekStart:'2026-11-02',now:'2026-11-03T11:00:00+01:00'});
  assert.match(target.innerHTML,/Picken aktuell/);
  assert.doesNotMatch(target.innerHTML,/Erledigte Aufgabe/);
  assert.doesNotMatch(target.innerHTML,/Archivierte Aufgabe/);
  assert.equal(state.tasks.length,3,'Quellaufgaben bleiben unverändert');
});

test('RC1771 Deepfix: deutsches Datum 03.11.2026 bleibt November, nicht März',()=>{
  const root=load(),api=root.ExportHUBTaskPlannerV2;
  const tasks=[
    {id:'pick-de',title:'Picken',shipmentRef:'DE-DATE',status:'open',plannedAt:'03.11.2026'},
    {id:'abd-de',title:'ABD erstellen',shipmentRef:'DE-DATE',status:'open',plannedAt:'03.11.2026'}
  ];
  const warning=api.inspectOperationalPlan({tasks});
  assert.equal(warning.byTaskId['abd-de'].type,'abd_same_day');
  assert.equal(warning.byTaskId['abd-de'].date,'2026-11-03');
  const target={innerHTML:''};
  const state={tasks};
  root.ExportHUBTaskUIV2.renderWorkweek(target,{state,weekStart:'2026-11-02',now:'2026-11-03T09:00:00+01:00'});
  assert.match(target.innerHTML,/Picken/);
  assert.match(target.innerHTML,/is-abd-exception/);
  assert.equal(tasks[0].plannedAt,'03.11.2026','Quellformat unverändert');
});
test('RC1771 Deepfix: ungültiges deutsches Datum wird nicht als gültige Planung interpretiert',()=>{
  const root=load(),api=root.ExportHUBTaskPlannerV2;
  const tasks=[
    {id:'pick-invalid',title:'Picken',shipmentRef:'BAD-DATE',status:'open',plannedAt:'31.02.2026'},
    {id:'abd-invalid',title:'ABD erstellen',shipmentRef:'BAD-DATE',status:'open',plannedAt:'31.02.2026'}
  ];
  assert.equal(api.inspectOperationalPlan({tasks}).warnings.length,0);
  const target={innerHTML:''};
  root.ExportHUBTaskUIV2.renderWorkweek(target,{state:{tasks},weekStart:'2026-02-23',now:'2026-02-24T08:00:00+01:00'});
  assert.doesNotMatch(target.innerHTML,/data-task-id="pick-invalid"/);
});

test('RC1771 Deepfix: deutsche Uhrzeit bleibt beim Planen erhalten',()=>{
  const root=load(),state={tasks:[
    {id:'pick-time',title:'Picken',status:'open',shipmentRef:'S-DE-TIME',plannedAt:'03.11.2026 09:30'},
    {id:'abd-time',title:'ABD erstellen',status:'open',shipmentRef:'S-DE-TIME',plannedAt:'03.11.2026 14:45'}
  ]},target={innerHTML:''};
  root.ExportHUBTaskUIV2.renderWorkweek(target,{state,weekStart:'2026-11-02',now:'2026-11-03T08:00:00+01:00'});
  assert.match(target.innerHTML,/is-abd-exception/);
  assert.match(target.innerHTML,/09:30/);
  assert.match(target.innerHTML,/14:45/);
  assert.equal(root.ExportHUBTaskPlannerV2.inspectOperationalPlan({tasks:state.tasks}).byTaskId['abd-time'].date,'2026-11-03');
  assert.equal(state.tasks[0].plannedAt,'03.11.2026 09:30','Originalangabe bleibt unverändert');
});

test('RC1772: Speditionsmitteilung als nicht versendeten PDF-Druckentwurf anzeigen',()=>{
  const root=load(),state={tasks:scenario(),shipments:[{id:'S123',pickupDate:'2026-11-03'}]};
  const prior=JSON.stringify(state),target={innerHTML:''};
  root.ExportHUBTaskUIV2.renderPlannerPage(target,{state,weekStart:'2026-11-02',now:'2026-11-03T09:00:00+01:00'});
  assert.match(target.innerHTML,/data-tpv2-print-carrier/);
  assert.match(target.innerHTML,/data-tpv2-carrier-notice/);
  assert.match(target.innerHTML,/DRAFT.*Not sent to the carrier/);
  assert.match(target.innerHTML,/03\.11\.2026/);
  assert.match(target.innerHTML,/04\.11\.2026/);
  assert.equal(JSON.stringify(state),prior,'Druckentwurf darf keine Buchungen oder Aufgaben ändern');
});
test('RC1772: kein Speditions-Druck ohne Abholkonflikt',()=>{
  const root=load(),state={tasks:[
    task('pick','Picken','2026-11-02'),
    task('abd','ABD erstellen','2026-11-03')
  ],shipments:[{id:'S123',pickupDate:'2026-11-04'}]};
  const target={innerHTML:''};
  root.ExportHUBTaskUIV2.renderPlannerPage(target,{state,weekStart:'2026-11-02',now:'2026-11-02T09:00:00+01:00'});
  assert.doesNotMatch(target.innerHTML,/data-tpv2-print-carrier/);
  assert.doesNotMatch(target.innerHTML,/data-tpv2-carrier-notice/);
});
test('RC1772: Speditions-Druck ist eine reine Benutzeraktion, ohne Mail oder automatische Buchung',async()=>{
  const root=load(),state={tasks:scenario(),shipments:[{id:'S123',pickupDate:'2026-11-03'}]},
    before=JSON.stringify(state),events={},classes=new Set(),handlers={};
  let prints=0;
  root.document={body:{classList:{
    add(name){classes.add(name);},
    remove(name){classes.delete(name);}
  }}};
  root.print=()=>{prints++;};
  root.addEventListener=(name,fn)=>{events[name]=fn;};
  const target={innerHTML:'',querySelector(){return null;},addEventListener(name,fn){handlers[name]=fn;}};
  root.ExportHUBTaskUIV2.renderPlannerPage(target,{state,weekStart:'2026-11-02',now:'2026-11-03T09:00:00+01:00'});
  const button={closest(selector){return selector==='[data-tpv2-print-carrier]'?button:null;}};
  await handlers.click({target:button});
  assert.equal(prints,1);
  assert.equal(classes.has('tpv2-print-carrier'),true);
  events.afterprint();
  assert.equal(classes.has('tpv2-print-carrier'),false);
  assert.equal(JSON.stringify(state),before,'Druck darf keine Sendung verändern');
});
