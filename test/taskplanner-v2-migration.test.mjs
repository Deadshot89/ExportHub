import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const context={console,Date,Intl};context.globalThis=context;
  const source=fs.readFileSync(new URL('../assets/taskplanner-v2-core.js',import.meta.url),'utf8');
  vm.runInNewContext(source,context,{filename:'taskplanner-v2-core.js'});
  return context.ExportHUBTaskCoreV2;
}

test('Migration hält gleichnamige Aufgaben unterschiedlicher Sendungen getrennt',()=>{
  const api=load();
  const state={tasks:[
    {id:'a',title:'Kunde anmelden',linkedShipmentRef:'ABC123',dueDate:'2026-10-12'},
    {id:'b',title:'Kunde anmelden',linkedShipmentRef:'XYZ789',dueDate:'2026-10-12'}
  ]};
  const out=api.migrateState(state,{now:'2026-10-12T08:00:00+02:00'});
  assert.equal(out.state.tasks.length,2);
  assert.notEqual(out.state.tasks[0].id,out.state.tasks[1].id);
  assert.equal(out.report.collisions.length,0);
  assert.equal(out.report.safe,true);
});

test('Migration ordnet alte Serienaliasfelder deterministisch zu',()=>{
  const api=load();
  const state={tasks:[
    {id:'r1',title:'Freitag',weeklySeriesId:'serie-77',occurrenceKey:'2026-10-09',status:'open'},
    {id:'r2',title:'Freitag',recurringSeriesId:'serie-77',occurrenceKey:'2026-10-16',status:'open'}
  ]};
  const out=api.migrateState(state,{});
  assert.equal(Array.from(out.state.tasks,t=>t.seriesId).join(','),'serie-77,serie-77');
  assert.equal(out.state.taskSeries.length,1);
  assert.equal(out.report.createdSeriesLinks,2);
});

test('Migration bewahrt manuelle Planung, erledigte Historie und Business-Felder',()=>{
  const api=load();
  const history=[{action:'created',at:'2026-10-01T10:00:00+02:00'}];
  const task={id:'d1',title:'Fertig',status:'done',plannedDate:'2026-10-07',manualOverride:true,history,customerName:'Kunde A',customField:{x:1}};
  const out=api.migrateState({tasks:[task]},{}).state.tasks[0];
  assert.equal(out.manualOverride,true);
  assert.equal(out.plannedDate,'2026-10-07');
  assert.equal(out.customerName,'Kunde A');
  assert.equal(JSON.stringify(out.customField),JSON.stringify({x:1}));
  assert.equal(JSON.stringify(out.history),JSON.stringify(history));
});

test('Migrationsbericht enthält Vorher/Nachher, Beziehungen und Sicherheitsstatus',()=>{
  const api=load();
  const out=api.migrateState({tasks:[{id:'x',title:'X',linkedCustomerId:'C1',linkedShipmentRef:'ABC123'}]},{});
  assert.equal(out.report.before.tasks,1);
  assert.equal(out.report.after.tasks,1);
  assert.ok(Array.isArray(out.report.collisions));
  assert.ok(Array.isArray(out.report.unresolvedRelationships));
  assert.equal(typeof out.report.createdSeriesLinks,'number');
  assert.equal(out.report.safe,true);
});

test('unaufgelöste Identitätskollision macht Migration unsicher',()=>{
  const api=load();
  const state={tasks:[
    {id:'dup',title:'A',linkedShipmentRef:'ABC123'},
    {id:'dup',title:'B',linkedShipmentRef:'XYZ789'}
  ]};
  const out=api.migrateState(state,{});
  assert.equal(out.report.safe,false);
  assert.equal(out.report.collisions.length,1);
});
