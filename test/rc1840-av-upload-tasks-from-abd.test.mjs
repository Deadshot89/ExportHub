import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const api=require('../api/av-check/index.js');

const NOW=new Date('2026-11-06T14:00:00.000Z');
function shipment(ref,count=1){
 return {id:'shipment-'+ref,ref,abdFiles:Array.from({length:count},(_,i)=>({
   id:'ABD-'+ref+'-'+i,name:'ABD_'+ref+'_'+i+'.pdf'
 }))};
}
function fixture(seed,archive={}){
 const state=structuredClone(seed),writes=[];
 const handler=api.createHandler({
  authorize:async()=>true,
  graphConfigured:()=>false,
  now:()=>NOW,
  readState:async()=>structuredClone(state),
  mutateState:async(environment,mutator)=>{
   assert.equal(environment,'testservice');
   const result=mutator(state);
   if(result.changed)writes.push(result);
   return result;
  },
  listArchivedFiles:async(ref,env)=>{
   assert.equal(env,'testservice');
   const result=archive[ref];
   if(result instanceof Error)throw result;
   return result||[];
  },
  listFiles:async()=>{throw new Error('Graph must not be required for upload tasks')}
 });
 return {state,writes,archive,run:()=>handler({
  method:'POST',headers:{},body:{
   environment:'testservice',uploadTasksOnly:true,minAgeMinutes:0
  }
 })};
}
test('P0: issued ABD creates one AV upload task even when SharePoint is offline',async()=>{
 const s=shipment('ABC123'),noAbd=shipment('NOABD1',0);
 const f=fixture({shipments:[s,noAbd],tasks:[]});
 const first=await f.run();
 assert.equal(first.status,200);
 assert.equal(first.body.mode,'upload-tasks');
 assert.equal(first.body.createdTasks,1);
 assert.equal(first.body.graphConfigured,false);
 assert.equal(f.state.tasks.length,1);
 const task=f.state.tasks[0];
 assert.equal(task.id,'task:av-missing:ABC123');
 assert.equal(task.sourceType,'av_missing');
 assert.equal(task.linkedShipmentRef,'ABC123');
 assert.equal(task.status,'offen');
 assert.match(task.title,/AV hochladen/);
 assert.equal(task.avMissingCount,1);
 assert.equal(task.avVerificationPending,true);
 assert.equal(f.state.shipments[0].avPresent,undefined,'Graph-unverified AV must not be marked absent');
 const second=await f.run();
 assert.equal(second.body.createdTasks,0);
 assert.equal(f.state.tasks.length,1,'no duplicated tasks after another scan');
});
test('P0: AVs saved in Azure close tasks only when every ABD has a matching AV',async()=>{
 const f=fixture({shipments:[shipment('ABC123',2)],tasks:[]},{
  ABC123:[{id:'avblob:one',name:'AV_ABC123_1.pdf'}]
 });
 assert.equal((await f.run()).body.createdTasks,1);
 assert.equal(f.state.tasks[0].avMissingCount,1);
 assert.equal(f.state.tasks[0].done,false);
 f.archive.ABC123.push({id:'avblob:two',name:'AV_ABC123_2.pdf'});
 const finished=await f.run();
 assert.equal(finished.status,200);
 assert.equal(finished.body.closedTasks,1);
 assert.equal(f.state.tasks[0].done,true);
 assert.equal(f.state.tasks[0].status,'erledigt');
 assert.equal(f.state.shipments[0].avPresent,true);
});
test('P0: archived ABD shipments participate in AV upload tasks',async()=>{
 const f=fixture({shipments:[],archive:[shipment('OLD777')],tasks:[]});
 const result=await f.run();
 assert.equal(result.body.createdTasks,1);
 assert.equal(f.state.tasks[0].linkedShipmentRef,'OLD777');
});
test('P0: previously Graph-verified SharePoint AV must not be falsely reported missing',async()=>{
 const sh={...shipment('ABC123'),avPresent:true,avFoundCount:1,avCheckedAt:'2026-11-05T12:00:00Z'};
 const f=fixture({shipments:[sh],tasks:[]});
 const result=await f.run();
 assert.equal(result.body.createdTasks,0);
 assert.equal(f.state.tasks.length,0);
});
test('P0: broken private archive never invents a missing AV task',async()=>{
 const f=fixture({shipments:[shipment('ABC123')],tasks:[]},{
  ABC123:Object.assign(new Error('Azure failed'),{code:'ARCHIVE_DOWN'})
 });
 const response=await f.run();
 assert.equal(response.status,503);
 assert.equal(response.body.errors[0].code,'ARCHIVE_DOWN');
 assert.equal(f.state.tasks.length,0);
});
