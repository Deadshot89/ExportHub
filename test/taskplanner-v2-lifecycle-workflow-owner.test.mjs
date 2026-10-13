import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const context={console,Date,Intl};
  context.globalThis=context;
  vm.runInNewContext(fs.readFileSync('assets/taskplanner-v2-core.js','utf8'),context,{filename:'assets/taskplanner-v2-core.js'});
  vm.runInNewContext(fs.readFileSync('assets/rc1014-task-lifecycle.js','utf8'),context,{filename:'assets/rc1014-task-lifecycle.js'});
  return context.ExportHUBRC1014Tasks;
}

test('strukturierte V2-Workflow-Aufgabe wird nicht zusätzlich durch Legacy-Snapshot-Reconcile automatisch erledigt',()=>{
  const api=load(),ctx={companyId:'essentra',environment:'production',now:'2026-10-12T10:00:00+02:00'};
  const task=api.normalizeTask({
    id:'pick-v2',title:'Pick bestätigen',group:'Picks',sourceType:'pick',sourceId:'PICK-1',status:'open',
    customerId:'C1',shipmentId:'S1',processId:'pick',workflowId:'shipping',taskType:'pick',workflowEvents:['shipment.picked']
  },ctx);
  const result=api.reconcile([task],{picks:[{id:'PICK-1',status:'completed'}]},ctx);
  assert.equal(result.tasks[0].status,'open');
  assert.equal(result.changed,false);
});

test('Legacy-Aufgabe ohne Workflow-Bindung behält vorhandene Snapshot-Automatik',()=>{
  const api=load(),ctx={companyId:'essentra',environment:'production',now:'2026-10-12T10:00:00+02:00'};
  const task=api.normalizeTask({id:'pick-legacy',title:'Pick',group:'Picks',sourceType:'pick',sourceId:'PICK-1',status:'open'},ctx);
  const result=api.reconcile([task],{picks:[{id:'PICK-1',status:'completed'}]},ctx);
  assert.equal(result.tasks[0].status,'done');
  assert.equal(result.tasks[0].completedBy,'system:pick');
});
