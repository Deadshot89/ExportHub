import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const merge=require('../api/shared/merge.js');
const av=require('../api/shared/av-check.js');

const oldAt='2026-10-28T08:00:00.000Z';
const newAt='2026-10-28T11:00:00.000Z';

test('P0: yesterday completed task stays done after merging stale open ledger',()=>{
  const server={
    tasks:[{id:'managed:spanien:2026-10-26',title:'Essentra Spanien anmelden',status:'open',updatedAt:oldAt}],
    taskStatusLedger:{'id:managed:spanien:2026-10-26':{status:'offen',done:false,updatedAt:oldAt}}
  };
  const incoming={
    tasks:[{id:'managed:spanien:2026-10-26',title:'Essentra Spanien anmelden',
      status:'done',done:true,completed:true,completedAt:newAt,doneAt:newAt,
      statusUpdatedAt:newAt,updatedAt:newAt,_syncUpdatedAt:newAt}]
  };
  const state=merge.mergeState(server,incoming);
  const task=state.tasks.find(x=>x.id==='managed:spanien:2026-10-26');
  assert.ok(task);
  assert.equal(task.status,'done');
  assert.equal(task.done,true);
  assert.equal(task.completedAt,newAt);
});

test('P0: newer status-ledger entry still takes precedence over older task',()=>{
  const older={id:'task-1',title:'Aufgabe',status:'open',done:false,updatedAt:oldAt};
  const state=merge.mergeState({
    tasks:[older],
    taskStatusLedger:{'id:task-1':{status:'erledigt',done:true,doneAt:newAt,updatedAt:newAt}}
  },{tasks:[older]});
  assert.equal(state.tasks[0].status,'erledigt');
  assert.equal(state.tasks[0].done,true);
});

test('P0: in-progress remains in-progress after same-timestamp Azure ledger merge',()=>{
  const active={id:'task-2',title:'Pick-Aufgabe',status:'in_progress',done:false,
    statusUpdatedAt:newAt,updatedAt:newAt,_syncUpdatedAt:newAt};
  const state=merge.mergeState({
    tasks:[active],
    taskStatusLedger:{'id:task-2':{status:'offen',done:false,updatedAt:newAt}}
  },{tasks:[active]});
  assert.equal(state.tasks[0].status,'in_progress');
  assert.equal(state.tasks[0].done,false);
});

test('P0: strictly newer legacy ledger still overrides an older in-progress task',()=>{
  const active={id:'task-3',title:'Pick-Aufgabe',status:'in_progress',done:false,
    statusUpdatedAt:oldAt,updatedAt:oldAt};
  const state=merge.mergeState({
    tasks:[active],
    taskStatusLedger:{'id:task-3':{status:'erledigt',done:true,doneAt:newAt,updatedAt:newAt}}
  },{tasks:[active]});
  assert.equal(state.tasks[0].done,true);
});

test('P0: stale ABD flags on Dutch EU shipment never create missing-AV upload task',()=>{
  const sh={id:'S-NL',ref:'ZVYH89',customerName:'Gebr. Kraan Rondkart. BV',
    destinationCountry:'NL',abdRequired:false,abdPresent:true,abdStatus:'Erledigt',
    abdFiles:[],documents:[]};
  const state={shipments:[sh],tasks:[]};
  assert.equal(av.shipmentHasAbd(state,sh),false);
  assert.deepEqual(av.candidates(state,new Date()),[]);
});

test('P0: status words in old ABD fields are not proof of an issued document',()=>{
  const sh={id:'S-NL',ref:'ZVYH89',destinationCountry:'NL',
    abdPresent:true,abdStatus:'Erledigt',abd:'Erledigt',abdFile:'fertig',
    abdRef:'erstellt',mrn:'done',abdFiles:['vorhanden'],
    abdDocuments:[{name:'Erledigt'}],documents:[{type:'ABD',name:'fertig'}]};
  const state={shipments:[sh],tasks:[]};
  assert.equal(av.shipmentHasAbd(state,sh),false);
  assert.deepEqual(av.candidates(state,new Date()),[]);
});

test('P0: real legacy ABD filename remains valid evidence',()=>{
  const sh={id:'S-NL',ref:'ZVYH89',destinationCountry:'NL',abd:'ABD_ZVYH89.pdf'};
  const state={shipments:[sh],tasks:[]};
  assert.equal(av.shipmentHasAbd(state,sh),true);
  assert.equal(av.candidates(state,new Date()).length,1);
});

test('P0: an actual ABD document still requires AV even for a Dutch destination',()=>{
  const sh={id:'S-NL',ref:'ZVYH89',destinationCountry:'NL',abdFiles:[{name:'ABD_ZVYH89.pdf'}]};
  const state={shipments:[sh],tasks:[]};
  assert.equal(av.shipmentHasAbd(state,sh),true);
  assert.equal(av.candidates(state,new Date()).length,1);
});

test('P0: an issued ABD plus legacy status placeholders requires only one AV',()=>{
  const sh={id:'S-NL',ref:'ZVYH89',destinationCountry:'NL',
    abdFiles:[{name:'ABD_ZVYH89.pdf'},'vorhanden',{name:'Erledigt'}],
    abdDocuments:['offen',{name:'fertig'}]};
  const state={shipments:[sh],tasks:[]};
  assert.equal(av.shipmentHasAbd(state,sh),true);
  assert.equal(av.requiredAvCount(state,sh),1);
  const found=av.applyResult(state,'ZVYH89',{avFiles:[{name:'AV_ZVYH89.pdf'}]},new Date());
  assert.equal(found.status,'present');
  assert.equal(sh.avRequiredCount,1);
  assert.equal(sh.avFoundCount,1);
});

test('P0: actual ABD document stays counted when a placeholder appears first',()=>{
  const sh={id:'S-NL',ref:'ZVYH89',abdFiles:['erledigt',{name:'ABD_ZVYH89.pdf'}]};
  const state={shipments:[sh],tasks:[]};
  assert.equal(av.shipmentHasAbd(state,sh),true);
  assert.equal(av.requiredAvCount(state,sh),1);
});

test('P0: historical false AV alarm is closed when no issued ABD exists',()=>{
  const sh={id:'S-NL',ref:'ZVYH89',abdStatus:'Erledigt'};
  const task={id:av.taskId('ZVYH89'),sourceType:'av_missing',sourceRef:'ZVYH89',
    linkedShipmentRef:'ZVYH89',status:'offen'};
  const state={shipments:[sh],tasks:[task]};
  assert.equal(av.candidates(state,new Date()).length,1);
  const result=av.applyResult(state,'ZVYH89',{avFiles:[]},new Date());
  assert.equal(result.status,'not-required');
  assert.equal(state.tasks[0].status,'erledigt');
});

test('P0: direct Spain task confirmation persists into Azure before it reports success',async()=>{
  const fs=(await import('node:fs')).default;
  const vm=(await import('node:vm')).default;
  let saves=0;
  const win={
    document:null,
    ExportHUBClean:{
      queueSave:async()=>true,
      flushSave:async()=>{saves++;return true;}
    },
    addEventListener(){},dispatchEvent(){},
    setTimeout(){return 1;},clearTimeout(){},
    location:{hostname:'example.azurestaticapps.net',pathname:'/'}
  };
  vm.runInNewContext(fs.readFileSync('assets/rc1014-task-runtime.js','utf8'),
    {globalThis:win,console,Date,Intl,CustomEvent:function(){}});
  const state={tasks:[{
    id:'managed:spanien:2026-10-26',managedBy:'RC1152',managedKey:'spanien',
    title:'Essentra Spanien anmelden',status:'open'
  }]};
  const ok=await win.ExportHUBRC1014TaskRuntime.setTaskStatus(state.tasks[0],'done',{
    state,currentUserId:'test-user'
  });
  assert.equal(ok,true);
  assert.equal(saves,1);
  assert.equal(state.tasks[0].status,'done');
  assert.equal(state.tasks[0].done,true);
  assert.equal(state.taskStatusLedger['id:managed:spanien:2026-10-26'].done,true);
  assert.ok(Date.parse(state.tasks[0].statusUpdatedAt)>0);
});

test('P0: unconfirmed Azure save must roll back task and ledger',async()=>{
  const fs=(await import('node:fs')).default;
  const vm=(await import('node:vm')).default;
  const win={
    document:null,
    ExportHUBClean:{queueSave:async()=>true,flushSave:async()=>false},
    addEventListener(){},dispatchEvent(){},
    setTimeout(){return 1;},clearTimeout(){},
    location:{hostname:'example.azurestaticapps.net',pathname:'/'}
  };
  vm.runInNewContext(fs.readFileSync('assets/rc1014-task-runtime.js','utf8'),
    {globalThis:win,console,Date,Intl,CustomEvent:function(){}});
  const state={tasks:[{id:'managed:spanien:2026-10-26',
    title:'Essentra Spanien anmelden',status:'open'}]};
  await assert.rejects(win.ExportHUBRC1014TaskRuntime.setTaskStatus(state.tasks[0],'done',{
    state,currentUserId:'test-user'
  }),/TASK_STATUS_SAVE_NOT_CONFIRMED/);
  assert.equal(state.tasks[0].status,'open');
  assert.equal(state.taskStatusLedger,undefined);
});

test('P0: direct persistence callback returning false must not confirm task',async()=>{
  const fs=(await import('node:fs')).default;
  const vm=(await import('node:vm')).default;
  const win={document:null,addEventListener(){},dispatchEvent(){},
    setTimeout(){return 1;},clearTimeout(){},
    location:{hostname:'example.azurestaticapps.net',pathname:'/'}};
  vm.runInNewContext(fs.readFileSync('assets/rc1014-task-runtime.js','utf8'),
    {globalThis:win,console,Date,Intl,CustomEvent:function(){}});
  const state={tasks:[{id:'managed:spanien:2026-10-26',title:'Essentra Spanien anmelden',status:'open'}]};
  let attempts=0;
  await assert.rejects(
    win.ExportHUBRC1014TaskRuntime.setTaskStatus(state.tasks[0],'done',{
      state,currentUserId:'test-user',
      persist:async()=>{attempts++;return false;}
    }),
    /TASK_STATUS_SAVE_NOT_CONFIRMED/
  );
  assert.equal(attempts,1);
  assert.equal(state.tasks[0].status,'open');
  assert.equal(state.tasks[0].done,undefined);
  assert.equal(state.taskStatusLedger,undefined);
});

test('P0: failed task save restores pre-existing status ledger exactly',async()=>{
  const fs=(await import('node:fs')).default;
  const vm=(await import('node:vm')).default;
  const win={document:null,ExportHUBClean:{queueSave:async()=>true,flushSave:async()=>false},
    addEventListener(){},dispatchEvent(){},setTimeout(){return 1;},clearTimeout(){},
    location:{hostname:'example.azurestaticapps.net',pathname:'/'}};
  vm.runInNewContext(fs.readFileSync('assets/rc1014-task-runtime.js','utf8'),
    {globalThis:win,console,Date,Intl,CustomEvent:function(){}});
  const previous={status:'offen',done:false,updatedAt:'2026-10-27T08:00:00.000Z'};
  const state={tasks:[{id:'managed:spanien:2026-10-26',title:'Essentra Spanien anmelden',status:'open'}],
    taskStatusLedger:{'id:managed:spanien:2026-10-26':{...previous},'id:other':{status:'erledigt',done:true}}};
  await assert.rejects(win.ExportHUBRC1014TaskRuntime.setTaskStatus(state.tasks[0],'done',
    {state,currentUserId:'test-user'}),/TASK_STATUS_SAVE_NOT_CONFIRMED/);
  assert.equal(state.tasks[0].status,'open');
  // The runtime runs in vm.runInNewContext; spread into the test realm
  // before deepStrictEqual so equivalent values do not fail on VM prototypes.
  assert.deepEqual({...state.taskStatusLedger['id:managed:spanien:2026-10-26']},previous);
  assert.equal(state.taskStatusLedger['id:other'].done,true);
});
