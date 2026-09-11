import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadLifecycle(){
  const context={globalThis:null,Date,console};
  context.globalThis=context;
  vm.runInNewContext(fs.readFileSync('assets/rc1014-task-lifecycle.js','utf8'),context,{filename:'rc1014-task-lifecycle.js'});
  return context.ExportHUBRC1014Tasks;
}

test('RC1056: Abholtag-Aufgabe wird nach vollständiger Abholung automatisch erledigt',()=>{
  const api=loadLifecycle();
  const task={id:'T1',title:'Abholtag ABC123',group:'Kunde angemeldet',status:'Offen',sourceType:'pickup',sourceId:'S1',sourceRef:'ABC123'};
  const shipment={id:'S1',ref:'ABC123',status:'Abgeholt',totalColli:4,collectedColli:4};
  const result=api.reconcile([task],{shipments:[shipment]},{now:'2026-09-11T18:15:00.000Z'});
  assert.equal(result.tasks[0].status,'done');
  assert.equal(result.tasks[0].completedBy,'system:pickup');
});

test('RC1056: Teilabholung lässt Abholtag-Aufgabe offen',()=>{
  const api=loadLifecycle();
  const task={id:'T2',title:'Abholtag XYZ789',group:'Kunde angemeldet',status:'Offen',sourceType:'pickup',sourceId:'S2',sourceRef:'XYZ789'};
  const shipment={id:'S2',ref:'XYZ789',status:'Teilweise abgeholt',totalColli:4,collectedColli:2};
  const result=api.reconcile([task],{shipments:[shipment]},{now:'2026-09-11T18:15:00.000Z'});
  assert.equal(result.tasks[0].status,'open');
});
