import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadApi(){
  const src=fs.readFileSync('assets/rc1014-task-lifecycle.js','utf8');
  const context={};
  context.globalThis=context;
  vm.runInNewContext(src,context,{filename:'assets/rc1014-task-lifecycle.js'});
  assert.ok(context.ExportHUBRC1014Tasks,'ExportHUBRC1014Tasks fehlt');
  return context.ExportHUBRC1014Tasks;
}

test('RC1014 normalisiert Pflichtfelder und bildet stabile Identität',()=>{
  const api=loadApi();
  const task=api.normalizeTask({
    id:'legacy-1',title:'POD hochladen',linkedShipmentRef:'ABC123',
    group:'Fehlende POD',owner:'tobias'
  },{companyId:'essentra',environment:'testservice',now:'2026-09-09T08:00:00+02:00'});
  assert.equal(task.sourceRef,'ABC123');
  assert.equal(task.sourceId,'ABC123');
  assert.equal(task.sourceType,'pod');
  assert.equal(task.companyId,'essentra');
  assert.equal(task.environment,'testservice');
  assert.equal(task.priority,'P4');
  assert.equal(task.originalAssignee,'tobias');
  assert.equal(task.effectiveAssignee,'tobias');
  assert.match(task.id,/legacy-1|task:/);
  assert.equal(api.identityKey(task),'essentra|testservice|Fehlende POD|pod|ABC123|');
});

test('RC1014 trennt verschiedene Aufgaben derselben Sendung',()=>{
  const api=loadApi();
  const ctx={companyId:'essentra',environment:'production'};
  const pick=api.normalizeTask({group:'Picks',sourceType:'pick',sourceId:'ABC123',sourceRef:'ABC123'},ctx);
  const pod=api.normalizeTask({group:'Fehlende POD',sourceType:'pod',sourceId:'ABC123',sourceRef:'ABC123'},ctx);
  assert.notEqual(api.identityKey(pick),api.identityKey(pod));
});

test('RC1014 klassifiziert Fälligkeit und sortiert P0 bis P4 stabil',()=>{
  const api=loadApi();
  const now='2026-09-09T08:00:00+02:00';
  assert.equal(api.dueBucket({dueAt:'2026-09-08T12:00:00+02:00'},now),'overdue');
  assert.equal(api.dueBucket({dueAt:'2026-09-09T15:00:00+02:00'},now),'today');
  assert.equal(api.dueBucket({dueAt:'2026-09-10T08:00:00+02:00'},now),'future');
  assert.equal(api.dueBucket({dueAt:''},now),'none');
  const tasks=[
    {priority:'P4',dueAt:'2026-09-09',sourceRef:'Z'},
    {priority:'P1',dueAt:'2026-09-10',sourceRef:'B'},
    {priority:'P0',dueAt:'2026-09-10',sourceRef:'C'},
    {priority:'P1',dueAt:'2026-09-08',sourceRef:'A'}
  ].map(x=>api.normalizeTask(x,{companyId:'essentra',environment:'production'}));
  tasks.sort((a,b)=>api.compareTasks(a,b,now));
  assert.deepEqual(tasks.map(t=>`${t.priority}:${t.sourceRef}`),['P0:C','P1:A','P1:B','P4:Z']);
});

test('RC1014 löst Vertretung auf und filtert Firma sowie Umgebung',()=>{
  const api=loadApi();
  const ctx={
    companyId:'essentra',environment:'production',currentUserId:'sevastian',now:'2026-09-09T08:00:00+02:00',
    absences:[{userId:'tobias',replacementUserId:'sevastian',companyId:'essentra',start:'2026-09-09',end:'2026-09-10',reason:'Urlaub'}]
  };
  const delegated=api.resolveAssignee(api.normalizeTask({id:'1',group:'Picks',owner:'tobias',companyId:'essentra',environment:'production'},ctx),ctx);
  assert.equal(delegated.originalAssignee,'tobias');
  assert.equal(delegated.effectiveAssignee,'sevastian');
  assert.match(delegated.substitutionReason,/Urlaub/);
  const visible=api.visibleTasks([
    delegated,
    api.normalizeTask({id:'2',group:'Picks',owner:'sevastian',companyId:'kontur',environment:'production'},ctx),
    api.normalizeTask({id:'3',group:'Picks',owner:'sevastian',companyId:'essentra',environment:'testservice'},ctx)
  ],ctx);
  assert.deepEqual(visible.map(t=>t.id),['1']);
});

test('RC1014 erzeugt für Wiederholung eine neue Instanz statt Status-Recycling',()=>{
  const api=loadApi();
  const original=api.normalizeTask({
    id:'weekly-1',group:'Picks',sourceType:'pick',sourceId:'P1',sourceRef:'ABC123',
    recurrence:'weekly',occurrenceKey:'2026-W37',status:'done',completedAt:'2026-09-09T15:00:00+02:00',completedBy:'tobias'
  },{companyId:'essentra',environment:'production'});
  const next=api.nextOccurrence(original,'2026-09-09T16:00:00+02:00');
  assert.notEqual(next.id,original.id);
  assert.notEqual(next.occurrenceKey,original.occurrenceKey);
  assert.equal(next.status,'open');
  assert.equal(next.completedAt,'');
  assert.equal(next.completedBy,'');
  assert.equal(original.status,'done');
  assert.equal(original.completedBy,'tobias');
});

test('RC1014 dedupliziert Reminder pro Aufgabe Tag Slot Umgebung und Benutzer',()=>{
  const api=loadApi();
  const ctx={companyId:'essentra',environment:'production',currentUserId:'tobias',now:'2026-09-09T08:00:00+02:00'};
  const p1=api.normalizeTask({id:'task-1',group:'Fehlende POD',owner:'tobias',priority:'P1',dueAt:'2026-09-09',sourceRef:'ABC123'},ctx);
  const p4=api.normalizeTask({id:'task-2',group:'Picks',owner:'tobias',priority:'P4',dueAt:'2026-09-09',sourceRef:'DEF456'},ctx);
  const other=api.normalizeTask({id:'task-3',group:'Picks',owner:'other',priority:'P0',dueAt:'2026-09-09',sourceRef:'GHI789'},ctx);
  assert.equal(api.reminderKey(p1,'2026-09-09','09','production','tobias'),'task-1|2026-09-09|09|production|tobias');
  const candidates=api.reminderCandidates([p4,other,p1],ctx);
  assert.deepEqual(candidates.map(t=>t.id),['task-1','task-2']);
});

test('RC1014 Reconcile erledigt POD exakt nach vollständiger Abholung und gültigem POD',()=>{
  const api=loadApi();
  const ctx={companyId:'essentra',environment:'production',now:'2026-09-09T10:00:00+02:00'};
  const task=api.normalizeTask({id:'pod-1',group:'Fehlende POD',sourceType:'pod',sourceId:'S1',sourceRef:'ABC123',status:'open'},ctx);
  const result=api.reconcile([task],{
    shipments:[{id:'S1',ref:'ABC123',status:'Abgeholt',podFiles:[{name:'pod.pdf'}],totalColli:2,collectedColli:2}]
  },ctx);
  assert.equal(result.tasks[0].status,'done');
  assert.equal(result.tasks[0].completedBy,'system:pod');
  assert.equal(result.tasks[0].completedAt,ctx.now);
  assert.equal(result.changed,true);
});

test('RC1014 Reconcile lässt POD bei Teilabholung offen',()=>{
  const api=loadApi();
  const ctx={companyId:'essentra',environment:'production',now:'2026-09-09T10:00:00+02:00'};
  const task=api.normalizeTask({id:'pod-partial',group:'Fehlende POD',sourceType:'pod',sourceId:'S1',status:'open'},ctx);
  const result=api.reconcile([task],{
    shipments:[{id:'S1',status:'Teilweise abgeholt',podFiles:[{name:'teil.pdf'}],totalColli:3,collectedColli:1}]
  },ctx);
  assert.equal(result.tasks[0].status,'open');
});

test('RC1014 Reconcile erledigt ABD und nur den konkreten Pick',()=>{
  const api=loadApi();
  const ctx={companyId:'essentra',environment:'production',now:'2026-09-09T10:00:00+02:00'};
  const tasks=[
    api.normalizeTask({id:'abd-1',group:'Offene ABDs',sourceType:'abd',sourceId:'S1',sourceRef:'ABC123',status:'open'},ctx),
    api.normalizeTask({id:'pick-1',group:'Picks',sourceType:'pick',sourceId:'PICK-1',sourceRef:'ABC123',status:'open'},ctx),
    api.normalizeTask({id:'pick-2',group:'Picks',sourceType:'pick',sourceId:'PICK-2',sourceRef:'ABC123',status:'open'},ctx)
  ];
  const result=api.reconcile(tasks,{
    shipments:[{id:'S1',ref:'ABC123',abdRequired:true,abdFiles:[{name:'abd.pdf'}]}],
    picks:[{id:'PICK-1',shipmentRef:'ABC123',status:'completed'},{id:'PICK-2',shipmentRef:'ABC123',status:'open'}]
  },ctx);
  assert.equal(result.tasks.find(t=>t.id==='abd-1').status,'done');
  assert.equal(result.tasks.find(t=>t.id==='abd-1').completedBy,'system:abd');
  assert.equal(result.tasks.find(t=>t.id==='pick-1').status,'done');
  assert.equal(result.tasks.find(t=>t.id==='pick-1').completedBy,'system:pick');
  assert.equal(result.tasks.find(t=>t.id==='pick-2').status,'open');
});

test('RC1014 Reconcile schließt Sendungen, storniert Storno und erzeugt Wiederholung nur einmal',()=>{
  const api=loadApi();
  const ctx={companyId:'essentra',environment:'production',now:'2026-09-09T16:00:00+02:00'};
  const tasks=[
    api.normalizeTask({id:'ship-done',group:'Offene Sendungen',sourceType:'shipment',sourceId:'S1',status:'open'},ctx),
    api.normalizeTask({id:'ship-cancel',group:'Offene Sendungen',sourceType:'shipment',sourceId:'S2',status:'open'},ctx),
    api.normalizeTask({id:'weekly',group:'Picks',sourceType:'pick',sourceId:'P9',status:'done',recurrence:'weekly',occurrenceKey:'2026-W37'},ctx)
  ];
  const domain={shipments:[{id:'S1',status:'Abgeschlossen'},{id:'S2',status:'Storniert'}],picks:[]};
  const first=api.reconcile(tasks,domain,ctx);
  assert.equal(first.tasks.find(t=>t.id==='ship-done').status,'done');
  assert.equal(first.tasks.find(t=>t.id==='ship-cancel').status,'cancelled');
  const generated=first.tasks.filter(t=>t.id.startsWith('weekly:next:'));
  assert.equal(generated.length,1);
  const second=api.reconcile(first.tasks,domain,ctx);
  assert.equal(second.tasks.filter(t=>t.id.startsWith('weekly:next:')).length,1);
});
