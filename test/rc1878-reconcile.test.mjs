import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {reconcile,shipmentsFromState}=require('../api/shared/pickup-transport-reconcile.js');
const rules=require('../api/shared/pickup-transport-association-rules.js');
const environment='testservice',companyKey='essentra',pickupDate='2026-11-09';
const binding={id:'MAIN-UK',shipmentId:'MAIN-UK',reference:'REF-MAIN',pickupTargetId:'FIX-UK',
 pickupDate,environment,companyKey,active:true};
const transport={id:'MAIN-UK',shipmentId:'MAIN-UK',reference:'REF-MAIN',pickupTargetId:'FIX-UK',
 pickupDate,environment,companyKey,registered:true};
const task={id:'TASK-UK',pickupTargetId:'FIX-UK',pickupTargetCompanyKey:companyKey,
 customerNumber:'00123,00045,00067',plannedDate:pickupDate};
const sh=(reference,customerNumber,extra={})=>({
 id:'ID-'+reference,reference,customerNumber,companyId:companyKey,
 plannedPickupDate:pickupDate,status:'open',...extra
});
const a=sh('REF-A','123'),b=sh('REF-B','45'),main=sh('REF-MAIN','123',{id:'MAIN-UK'});
function fixture(options={}){
 let revision=0,links=(options.existingLinks||[]).map(x=>({...x})),writes=0;
 const calls={proof:[],write:[],read:[]};
 const bindingStore={async read(scope){calls.read.push(['bindings',scope]);
   return{bindings:options.bindings||[binding]}}};
 const proof={async inspect(args){calls.proof.push(args);
   if(options.proofError)throw options.proofError;
   return {...transport,pickupDate:args.pickupDate,pickupTargetId:args.pickupTargetId}}};
 const linkStore={
  async read(scope){calls.read.push(['links',scope]);return{revision,links}},
  async applyAutomatic(args){writes++;calls.write.push(args);
   if(options.writeError)throw options.writeError;
   const res=rules.propose({...args,existingLinks:links});
   if(res.proposals.length){
    for(const p of res.proposals)links.push({...p,active:true});
    revision++;
   }
   return{revision,added:res.proposals.map(x=>x.ref),conflicts:res.conflicts};
  }
 };
 const state=options.state||{tasks:[task],shipments:[a,b,main],savedShipments:[{...a},{...b},{...main}]};
 const source={environment,companyKey,pickupDate,team:{state},actor:'PLANNER-1',
  bindingStore,linkStore,registrationProof:proof,
  accessStore:{},pickupStore:{},fixedStore:{}};
 return{source,calls,getWrites:()=>writes,getLinks:()=>links,getRevision:()=>revision};
}
test('A and B persist as distinct REF children after verified main registration; later C joins',async()=>{
 const f=fixture(),original=JSON.stringify(f.source.team.state);
 const first=await reconcile(f.source);
 assert.deepEqual(first.added,['REF-A','REF-B']);
 assert.equal(first.verifiedTransports,1);
 assert.deepEqual(f.getLinks().map(x=>x.ref),['REF-A','REF-B']);
 assert.equal(f.getRevision(),1);
 assert.equal(JSON.stringify(f.source.team.state),original);
 const nextState={...f.source.team.state,shipments:[...f.source.team.state.shipments,sh('REF-C','67')]};
 const second=await reconcile({...f.source,team:{state:nextState}});
 assert.deepEqual(second.added,['REF-C']);
 assert.deepEqual(f.getLinks().map(x=>x.ref),['REF-A','REF-B','REF-C']);
 assert.equal(f.getRevision(),2);
});
test('repeated reconciliation is idempotent and does not change original shipment records',async()=>{
 const f=fixture(),before=JSON.stringify(f.source.team);
 await reconcile(f.source);
 const same=await reconcile(f.source);
 assert.deepEqual(same.added,[]);assert.equal(same.changed,false);
 assert.equal(f.getRevision(),1);assert.equal(JSON.stringify(f.source.team),before);
});
test('shipments and identical saved copies are deduplicated before applying business rules',()=>{
 const rows=shipmentsFromState({shipments:[a,b],savedShipments:[{...a},{...b}]});
 assert.deepEqual(rows.map(x=>x.reference),['REF-A','REF-B']);
});
test('conflicting saved copy remains ambiguous and is never silently grouped',async()=>{
 const f=fixture({state:{tasks:[task],shipments:[a,b,main],
  savedShipments:[{...a,customerNumber:'9999'},{...b},{...main}]}});
 const r=await reconcile(f.source);
 assert.deepEqual(r.added,['REF-B']);
 assert.ok(r.conflicts.some(x=>x.code==='SHIPMENT_REF_AMBIGUOUS'&&x.ref==='REF-A'));
});
test('manual exclusion prevents auto-relink after refresh',async()=>{
 const f=fixture({existingLinks:[{ref:'REF-A',pickupDate,active:false,manualLock:true,mode:'manual'}]});
 const result=await reconcile(f.source);
 assert.deepEqual(result.added,['REF-B']);
 assert.ok(result.conflicts.some(x=>x.code==='MANUAL_UNLINK_PROTECTED'));
});
test('a different calendar date never borrows an earlier main pickup',async()=>{
 const f=fixture();
 const result=await reconcile({...f.source,pickupDate:'2026-11-10'});
 assert.deepEqual(result.added,[]);assert.equal(result.verifiedTransports,0);assert.equal(f.getWrites(),0);
});
test('unregistered or cancelled main pickup cannot create child links',async()=>{
 const err=Object.assign(new Error('Not registered'),{code:'TRANSPORT_NOT_REGISTERED'});
 const f=fixture({proofError:err});
 const result=await reconcile(f.source);
 assert.deepEqual(result.added,[]);assert.equal(result.verifiedTransports,0);
 assert.equal(result.conflicts[0].code,'TRANSPORT_NOT_REGISTERED');
 assert.equal(f.getWrites(),0);
});
test('an unexpected storage failure is never silently converted to a completed link',async()=>{
 const err=Object.assign(new Error('Storage unavailable'),{code:'STORAGE_INTERNAL'});
 const f=fixture({writeError:err});
 await assert.rejects(reconcile(f.source),{code:'STORAGE_INTERNAL'});
 assert.equal(f.getLinks().length,0);
});
test('optimistic concurrency conflicts propagate and never claim success',async()=>{
 const err=Object.assign(new Error('ETag changed'),{code:'LINK_CONCURRENT_UPDATE',status:409});
 const f=fixture({writeError:err});
 await assert.rejects(reconcile(f.source),{code:'LINK_CONCURRENT_UPDATE'});
 assert.equal(f.getLinks().length,0);
});
test('empty account rules produce no links and do not rewrite team data',async()=>{
 const f=fixture({state:{tasks:[{...task,customerNumber:''}],shipments:[a,b,main]}});
 const result=await reconcile(f.source);
 assert.deepEqual(result.added,[]);assert.equal(result.changed,false);
});
test('no browser supplied transport flags or shipment snapshots are accepted by server service',async()=>{
 const f=fixture();
 const res=await reconcile({...f.source,transports:[{id:'FAKE',registered:true}],
  shipments:[sh('FAKE','123')],tasks:[{...task,customerNumber:'999'}]});
 assert.deepEqual(res.added,['REF-A','REF-B']);
 assert.equal(f.calls.proof.length,1);
});
test('invalid company, date, missing actor and overlarge input are rejected',async()=>{
 const f=fixture();
 await assert.rejects(reconcile({...f.source,companyKey:''}),{code:'RECONCILE_SCOPE_INVALID'});
 await assert.rejects(reconcile({...f.source,pickupDate:'2026-11-31'}),{code:'RECONCILE_SCOPE_INVALID'});
 await assert.rejects(reconcile({...f.source,actor:''}),{code:'RECONCILE_SCOPE_INVALID'});
 assert.throws(()=>shipmentsFromState({shipments:Array.from({length:30001},()=>a)}),
  {code:'RECONCILE_TOO_MANY_SHIPMENTS'});
});
