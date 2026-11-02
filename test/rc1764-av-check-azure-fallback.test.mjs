import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const api=require('../api/av-check/index.js');

const WHEN=new Date('2026-11-02T11:00:00.000Z');
function shipment(ref,abdCount=1){
 return{id:'shipment-'+ref,ref,abdFiles:Array.from({length:abdCount},(_,i)=>({id:'abd-'+ref+'-'+i,name:'ABD_'+ref+'_'+i+'.pdf'})),actualPickupDate:'2026-10-31'};
}
function fixture(refs,archive){
 const state={shipments:refs,tasks:refs.map(s=>({
  id:'task:av-missing:'+s.ref,sourceType:'av_missing',sourceRef:s.ref,linkedShipmentRef:s.ref,
  status:'offen',done:false,completed:false
 }))};
 let writes=0,graphReads=0;
 const handler=api.createHandler({
  authorize:async()=>true,
  graphConfigured:()=>false,
  now:()=>WHEN,
  readState:async()=>structuredClone(state),
  mutateState:async(env,fn)=>{assert.equal(env,'testservice');const result=fn(state);if(result.changed)writes++;return result},
  listArchivedFiles:async(ref,env)=>{assert.equal(env,'testservice');return archive[ref]||[]},
  listFiles:async()=>{graphReads++;throw new Error('Graph must never be read when not configured')}
 });
 return{state,run:()=>handler({method:'POST',headers:{},body:{environment:'testservice',minAgeMinutes:0}}),
  stats:()=>({writes,graphReads})};
}
test('P0: configured Graph target missing – complete Azure AV archive still closes its task',async()=>{
 const f=fixture([shipment('ABC123')],{ABC123:[{name:'AV_ABC123_verified.pdf'}]});
 const result=await f.run();
 assert.equal(result.status,200);
 assert.equal(result.body.ok,true);
 assert.equal(result.body.graphConfigured,false);
 assert.equal(result.body.present,1);
 assert.equal(result.body.closedTasks,1);
 assert.equal(f.state.tasks[0].status,'erledigt');
 assert.equal(f.state.tasks[0].done,true);
 assert.deepEqual(f.stats(),{writes:1,graphReads:0});
});
test('P0: no Graph and empty Azure archive must not create missing tasks or claim a successful scan',async()=>{
 const f=fixture([shipment('ABC123')],{});
 const result=await f.run();
 assert.equal(result.status,503);
 assert.equal(result.body.code,'GRAPH_NOT_CONFIGURED');
 assert.equal(result.body.graphConfigured,false);
 assert.equal(f.state.tasks[0].done,false);
 assert.deepEqual(f.stats(),{writes:0,graphReads:0});
});
test('P0: multiple ABDs need multiple Azure AVs; partial archive must not close the task',async()=>{
 const f=fixture([shipment('ABC123',2)],{ABC123:[{name:'AV_ABC123_only_one.pdf'}]});
 const result=await f.run();
 assert.equal(result.status,503);
 assert.equal(f.state.tasks[0].done,false);
 assert.deepEqual(f.stats(),{writes:0,graphReads:0});
});
test('P0: mixed verified and incomplete REFs only close those with full AV evidence',async()=>{
 const f=fixture([shipment('ABC123'),shipment('DEF456',2)],{
  ABC123:[{name:'AV_ABC123_proven.pdf'}],
  DEF456:[{name:'AV_DEF456_only_one.pdf'}]
 });
 const result=await f.run();
 assert.equal(result.status,200);
 assert.equal(result.body.ok,false,'partial scan must be visible as degraded');
 assert.equal(result.body.errorCount,1);
 assert.equal(result.body.closedTasks,1);
 assert.equal(f.state.tasks.find(t=>t.sourceRef==='ABC123').done,true);
 assert.equal(f.state.tasks.find(t=>t.sourceRef==='DEF456').done,false);
 assert.deepEqual(f.stats(),{writes:1,graphReads:0});
});
