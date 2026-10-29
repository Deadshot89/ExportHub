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

test('P0: stale ABD flags on Dutch EU shipment never create missing-AV upload task',()=>{
  const sh={id:'S-NL',ref:'ZVYH89',customerName:'Gebr. Kraan Rondkart. BV',
    destinationCountry:'NL',abdRequired:false,abdPresent:true,abdStatus:'Erledigt',
    abdFiles:[],documents:[]};
  const state={shipments:[sh],tasks:[]};
  assert.equal(av.shipmentHasAbd(state,sh),false);
  assert.deepEqual(av.candidates(state,new Date()),[]);
});

test('P0: an actual ABD document still requires AV even for a Dutch destination',()=>{
  const sh={id:'S-NL',ref:'ZVYH89',destinationCountry:'NL',abdFiles:[{name:'ABD_ZVYH89.pdf'}]};
  const state={shipments:[sh],tasks:[]};
  assert.equal(av.shipmentHasAbd(state,sh),true);
  assert.equal(av.candidates(state,new Date()).length,1);
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
