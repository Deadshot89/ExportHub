import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const events=[];
  const context={console,Date,Intl,setTimeout,clearTimeout,dispatchEvent:event=>events.push(event)};
  context.globalThis=context;
  context.CustomEvent=class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}};
  context.ExportHUBI18n={t:key=>key==='taskV2.workflow.reviewMapping'?'Zuordnung prüfen':key};
  context.ExportHUBRC1014TaskRuntime=Object.freeze({legacy:true});
  for(const file of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/taskplanner-v2-planner.js','assets/taskplanner-v2-runtime-bridge.js','assets/taskplanner-v2-workflow.js']){
    vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  }
  return {runtime:context.ExportHUBRC1014TaskRuntime,events};
}

test('Runtime-Bridge erweitert den bestehenden RC1014 Runtime-Owner statt ihn zu ersetzen',()=>{
  const {runtime}=load();
  assert.equal(runtime.legacy,true);
  assert.equal(typeof runtime.applyTaskPatch,'function');
  assert.equal(typeof runtime.applyWeekPlan,'function');
  assert.equal(typeof runtime.moveTaskOccurrence,'function');
  assert.equal(typeof runtime.emitWorkflowEvent,'function');
});

test('applyTaskPatch verändert nur die adressierte Aufgabe und persistiert exakt einmal',()=>{
  const {runtime}=load();
  const state={tasks:[{id:'A',title:'A',status:'open',priority:'P2'},{id:'B',title:'B',status:'open',priority:'P2'}]};
  const beforeB=JSON.stringify(state.tasks[1]);
  const persisted=[];
  const result=runtime.applyTaskPatch('A',{priority:'P0'},{state,persist:tasks=>persisted.push(JSON.stringify(tasks)),now:'2026-10-12T10:00:00+02:00'});
  assert.equal(result.changed,true);
  assert.equal(state.tasks[0].priority,'P0');
  assert.equal(JSON.stringify(state.tasks[1]),beforeB);
  assert.equal(persisted.length,1);
});

test('moveTaskOccurrence verschiebt nur plannedAt und lässt dueAt unverändert',()=>{
  const {runtime}=load();
  const state={tasks:[{id:'A',title:'A',status:'open',priority:'P2',plannedAt:'2026-10-12T09:00:00+02:00',dueAt:'2026-10-14T16:15:00+02:00'}]};
  let saves=0;
  runtime.moveTaskOccurrence('A','2026-10-13',{state,persist:()=>saves++,now:'2026-10-12T10:00:00+02:00'});
  assert.equal(state.tasks[0].plannedAt.startsWith('2026-10-13'),true);
  assert.equal(state.tasks[0].dueAt,'2026-10-14T16:15:00+02:00');
  assert.equal(state.tasks[0].manualOverride,true);
  assert.equal(state.tasks[0].history.at(-1).action,'manual_move');
  assert.equal(saves,1);
});

test('applyWeekPlan übernimmt mehrere Planner-Patches mit nur einem Persist-Aufruf',()=>{
  const {runtime}=load();
  const state={tasks:[
    {id:'A',title:'A',status:'open',priority:'P1',plannedAt:'2026-10-12T09:00:00+02:00'},
    {id:'B',title:'B',status:'open',priority:'P2',plannedAt:'2026-10-13T09:00:00+02:00'}
  ]};
  let saves=0;
  const draft={items:[
    {taskId:'A',plannedDate:'2026-10-14',holidayConflict:false},
    {taskId:'B',plannedDate:'2026-10-15',holidayConflict:false}
  ],conflicts:[]};
  const result=runtime.applyWeekPlan(draft,{state,persist:()=>saves++,now:'2026-10-12T10:00:00+02:00'});
  assert.equal(result.changed,true);
  assert.equal(state.tasks[0].plannedAt.startsWith('2026-10-14'),true);
  assert.equal(state.tasks[1].plannedAt.startsWith('2026-10-15'),true);
  assert.equal(saves,1);
});

test('emitWorkflowEvent führt strukturiertes Auto-Complete über den kanonischen Runtime-State aus',()=>{
  const {runtime,events}=load();
  const state={tasks:[{id:'A',title:'A',status:'open',priority:'P2',customerId:'C1',shipmentId:'S1',processId:'pick',workflowId:'shipping',taskType:'pick',workflowEvents:['shipment.picked'],dueAt:'2026-10-12T16:15:00+02:00'}]};
  let saves=0;
  const result=runtime.emitWorkflowEvent({eventId:'EVT-A',type:'shipment.picked',customerId:'C1',shipmentId:'S1',processId:'pick',workflowId:'shipping',taskType:'pick',occurredAt:'2026-10-12T10:00:00+02:00'},{state,persist:()=>saves++});
  assert.equal(result.changed,true);
  assert.equal(state.tasks[0].status,'done');
  assert.equal(saves,1);
  assert.equal(events.filter(event=>event.type==='exporthub:tasks-updated').length,1);
});
