import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const listeners=new Map(),forwarded=[];
  const context={console,Date,Intl,setTimeout,clearTimeout};
  context.globalThis=context;
  context.ExportHUBRC1014TaskRuntime={emitWorkflowEvent(event){forwarded.push(JSON.parse(JSON.stringify(event)));return{changed:false,status:'unmatched'};}};
  context.addEventListener=(name,fn)=>listeners.set(name,fn);
  vm.runInNewContext(fs.readFileSync('assets/taskplanner-v2-core.js','utf8'),context,{filename:'assets/taskplanner-v2-core.js'});
  vm.runInNewContext(fs.readFileSync('assets/taskplanner-v2-workflow.js','utf8'),context,{filename:'assets/taskplanner-v2-workflow.js'});
  return{listeners,forwarded,api:context.ExportHUBTaskWorkflowV2};
}

test('bestätigter neuer Shipment-Save erzeugt genau ein strukturiertes shipment.created Event',()=>{
  const {listeners,forwarded}=load(),onSaved=listeners.get('exporthub:shipment-saved');
  assert.equal(typeof onSaved,'function');
  onSaved({detail:{azureSaved:true,updated:false,id:'S1',reference:'ABC123',shipment:{id:'S1',ref:'ABC123',customerId:'C1',customerName:'Kunde Eins',salesOrder:'SO1',updatedAt:'2026-10-12T10:00:00+02:00'}}});
  assert.equal(forwarded.length,1);
  assert.deepEqual(forwarded[0],{
    eventId:'shipment.created:S1',type:'shipment.created',occurredAt:'2026-10-12T10:00:00+02:00',
    customerId:'C1',customerName:'Kunde Eins',shipmentId:'S1',shipmentRef:'ABC123',orderId:'SO1',
    processId:'',workflowId:'',taskType:'shipment'
  });
});

test('Update oder nicht bestätigter Save erzeugt kein shipment.created',()=>{
  const {listeners,forwarded}=load(),onSaved=listeners.get('exporthub:shipment-saved');
  onSaved({detail:{azureSaved:true,updated:true,shipment:{id:'S1',ref:'ABC123'}}});
  onSaved({detail:{azureSaved:false,updated:false,shipment:{id:'S2',ref:'DEF456'}}});
  onSaved({detail:{updated:false,shipment:{id:'S3',ref:'GHI789'}}});
  assert.equal(forwarded.length,0);
});

test('Shipment-Save ohne stabile ID oder Referenz bleibt fail-closed',()=>{
  const {listeners,forwarded}=load();
  listeners.get('exporthub:shipment-saved')({detail:{azureSaved:true,updated:false,shipment:{customerId:'C1'}}});
  assert.equal(forwarded.length,0);
});
