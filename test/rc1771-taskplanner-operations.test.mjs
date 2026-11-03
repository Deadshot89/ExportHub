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
  assert.match(target.innerHTML,/Spedition informieren/);
  const button={getAttribute:key=>key==='data-tpv2-abd-approve'?'abd':null,
    closest:sel=>sel==='[data-tpv2-abd-approve]'?button:null};
  await handlers.click({target:button});
  assert.equal(writes,1);
  assert.ok(state.tasks.find(t=>t.id==='abd').planningSameDayAbdApproval);
  assert.doesNotMatch(target.innerHTML,/is-abd-exception/);
});
