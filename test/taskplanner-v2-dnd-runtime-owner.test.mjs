import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const context={console,Date,Intl,setTimeout,clearTimeout};context.globalThis=context;
  for(const file of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/taskplanner-v2-planner.js','assets/taskplanner-v2-ui.js','assets/taskplanner-v2-planner-ui.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  return context.ExportHUBTaskUIV2;
}

test('Planner-DnD nutzt den echten direkten RC1014 Runtime-Owner und behält plannerV2-Kompatibilität',()=>{
  const ui=load(),state={tasks:[{id:'T1',title:'Move',status:'open',priority:'P2',plannedAt:'2026-10-12T09:00:00+02:00',dueAt:'2026-10-14T16:15:00+02:00'}]},calls=[];
  const runtime={moveTaskOccurrence(id,plannedAt,ctx){calls.push({id,plannedAt,ctx});return{changed:true}}};
  const day={closest:sel=>sel==='[data-tpv2-drop-date], [data-i218-drop-date]'?day:null,getAttribute:name=>name==='data-tpv2-drop-date'?'2026-10-15':null};
  const card={closest:sel=>sel==='[data-task-id]'?card:null,getAttribute:name=>name==='data-task-id'?'T1':null};
  const handlers={};
  const target={ownerDocument:{elementFromPoint:()=>day},addEventListener:(type,fn)=>{handlers[type]=fn}};
  ui.bindPlannerDnD(target,{state,runtime,now:'2026-10-12T08:00:00+02:00'});
  handlers.pointerup({clientX:5,clientY:5,target:card});
  assert.equal(calls.length,1,'direkt exportierter moveTaskOccurrence muss verwendet werden');
  assert.equal(calls[0].id,'T1');
  assert.equal(calls[0].plannedAt,'2026-10-15T09:00:00+02:00');
});
