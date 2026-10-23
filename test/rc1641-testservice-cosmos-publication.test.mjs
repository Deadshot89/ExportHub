import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const {publishTestserviceState,readPublishedTestserviceState,MANIFEST_ID}
 =require('../api/shared/testservice-cosmos-publication.js');

function fakeCosmos(){
 const items=new Map(),events=[];
 let rev=0,failAfter=null,beforeCommit=null;
 const clone=x=>x===null||x===undefined?x:JSON.parse(JSON.stringify(x));
 const read=(id,pk)=>{assert.equal(pk,'testservice');return clone(items.get(id)||null)};
 const store={
  environment:'testservice',partitionKey:'testservice',
  async readItem(id,pk){events.push('read:'+id);return read(id,pk)},
  async createImmutableItem(item,conditions){
   assert.equal(item.environment,'testservice');assert.equal(item.pk,'testservice');
   assert.deepEqual(conditions,{ifNoneMatch:'*'});
   assert.notEqual(item.id,MANIFEST_ID);
   if(failAfter!==null&&events.filter(x=>x.startsWith('create:')).length>=failAfter)
    throw new Error('PROVIDER_SAS_SECRET_MUST_NOT_BE_LOGGED');
   if(items.has(item.id))throw new Error('PRECONDITION_FAILED');
   events.push('create:'+item.id);items.set(item.id,clone({...item,etag:'"r'+(++rev)+'"'}));
  },
  async compareAndSwapManifest(manifest,conditions){
   assert.equal(manifest.id,MANIFEST_ID);
   assert.equal(manifest.environment,'testservice');
   if(beforeCommit)beforeCommit({items,manifest});
   const current=items.get(MANIFEST_ID);
   if(!current){assert.deepEqual(conditions,{ifNoneMatch:'*'})}
   else if(conditions.ifMatch!==current.etag)throw new Error('CAS_CONFLICT_SAS_SECRET');
   events.push('commit');
   items.set(MANIFEST_ID,clone({...manifest,etag:'"r'+(++rev)+'"'}));
  }
 };
 return{store,items,events,read,failAfter(n){failAfter=n},beforeCommit(fn){beforeCommit=fn},
  put(id,item){items.set(id,clone(item))},clear(){items.clear()}};
}
function state(n=1){return{dataEnvironment:'testservice',schemaVersion:3,revision:n,
 state:{customers:[{id:'TEST-001',name:'Synthetic ÄÖ漢字',items:Array.from({length:10},(_,i)=>({id:i,count:n*i}))}],
 shipments:[{ref:'TST001',status:n===1?'Erstellt':'Bereit zur Abholung'}]}};}

test('RC1641: creates TESTSERVICE chunks immutably, verifies readback, and atomically commits manifest',async()=>{
 const db=fakeCosmos(),input=state();
 const out=await publishTestserviceState(db.store,input,{environment:'testservice',expectedManifestEtag:null});
 assert.equal(out.committed,true);assert.equal(out.verifiedReadback,true);
 assert.equal(out.cloudCostVerified,false);assert.equal(out.noCloudWrites,undefined);
 assert.equal(db.events.filter(x=>x==='commit').length,1);
 assert.equal(db.events.filter(x=>x.startsWith('create:')).length,out.chunkCount);
 const read=await readPublishedTestserviceState(db.store,{environment:'testservice'});
 assert.deepEqual(read.state,input);
 assert.ok(read.manifestEtag);
 assert.doesNotMatch(JSON.stringify(out),/Synthetic|TEST-001|TST001/);
 assert.ok(db.items.has(MANIFEST_ID));
 assert.ok([...db.items.keys()].filter(x=>x!==MANIFEST_ID).every(x=>x.startsWith('eh360-ts-v1-')));
});

test('RC1641: identical second publish is a zero-write no-op, not another soft-delete version',async()=>{
 const db=fakeCosmos(),input=state();
 await publishTestserviceState(db.store,input,{environment:'testservice',expectedManifestEtag:null});
 const etag=db.read(MANIFEST_ID,'testservice').etag,prev=db.events.filter(x=>x==='commit'||x.startsWith('create:')).length;
 const same=await publishTestserviceState(db.store,input,{environment:'testservice',expectedManifestEtag:etag});
 assert.equal(same.committed,false);assert.equal(same.verifiedReadback,true);
 assert.equal(db.events.filter(x=>x==='commit'||x.startsWith('create:')).length,prev);
});

test('RC1641: stale ETag and missing explicit write precondition fail before any writes',async()=>{
 const db=fakeCosmos();
 await publishTestserviceState(db.store,state(),{environment:'testservice',expectedManifestEtag:null});
 const count=db.events.filter(x=>x==='commit'||x.startsWith('create:')).length;
 for(const opts of [{environment:'testservice'},{environment:'testservice',expectedManifestEtag:null},
  {environment:'testservice',expectedManifestEtag:'"stale"'}]){
  await assert.rejects(()=>publishTestserviceState(db.store,state(2),opts),e=>e.code?.startsWith('TEST_COSMOS_'));
 }
 assert.equal(db.events.filter(x=>x==='commit'||x.startsWith('create:')).length,count);
});

test('RC1641: failure during staged chunk creation preserves old manifest and previous readable state',async()=>{
 const db=fakeCosmos();
 await publishTestserviceState(db.store,state(),{environment:'testservice',expectedManifestEtag:null});
 const previous=db.read(MANIFEST_ID,'testservice');
 db.failAfter(1); // this provider begins to reject new chunks; no manifest switching
 const larger={...state(2),state:{...state(2).state,randomish:'abcdef'.repeat(100000)}};
 await assert.rejects(()=>publishTestserviceState(db.store,larger,
  {environment:'testservice',expectedManifestEtag:previous.etag}),e=>e.code==='TEST_COSMOS_CHUNK_CREATE_FAILED');
 assert.equal(db.read(MANIFEST_ID,'testservice').etag,previous.etag);
 assert.deepEqual((await readPublishedTestserviceState(db.store,{environment:'testservice'})).state,state());
});

test('RC1641: first successful revision remains available after a CAS-switched second revision',async()=>{
 const db=fakeCosmos(),s1=state(),s2=state(2);
 await publishTestserviceState(db.store,s1,{environment:'testservice',expectedManifestEtag:null});
 const old=db.read(MANIFEST_ID,'testservice');
 const committed=await publishTestserviceState(db.store,s2,{environment:'testservice',expectedManifestEtag:old.etag});
 assert.equal(committed.committed,true);
 assert.deepEqual((await readPublishedTestserviceState(db.store,{environment:'testservice'})).state,s2);
 assert.ok(old.chunkIds.every(id=>db.items.has(id)),'old chunks retained for safe rollback');
 const before=db.events.filter(x=>x==='commit').length;
 await assert.rejects(()=>publishTestserviceState(db.store,s1,{environment:'testservice',
  expectedManifestEtag:old.etag}),e=>e.code==='TEST_COSMOS_MANIFEST_ETAG_MISMATCH');
 assert.equal(db.events.filter(x=>x==='commit').length,before);
});

test('RC1641: provider concurrent manifest update and corrupt chunk fail closed',async()=>{
 const db=fakeCosmos(),input=state();
 await publishTestserviceState(db.store,input,{environment:'testservice',expectedManifestEtag:null});
 const previous=db.read(MANIFEST_ID,'testservice');
 db.beforeCommit(({items})=>{const p=items.get(MANIFEST_ID);items.set(MANIFEST_ID,{...p,etag:'"concurrent-writer"'});});
 await assert.rejects(()=>publishTestserviceState(db.store,state(3),
  {environment:'testservice',expectedManifestEtag:previous.etag}),e=>e.code==='TEST_COSMOS_MANIFEST_COMMIT_FAILED');
 assert.deepEqual((await readPublishedTestserviceState(db.store,{environment:'testservice'})).state,input);
 const id=previous.chunkIds[0],chunk=db.items.get(id);
 db.items.set(id,{...chunk,payloadBase64:'YmFk'});
 await assert.rejects(()=>readPublishedTestserviceState(db.store,{environment:'testservice'}),
  e=>e.code==='TEST_COSMOS_READBACK_INVALID');
});

test('RC1641: opt-in environment, provider namespace and state marker reject PROD and unconfigured stores',async()=>{
 const db=fakeCosmos(),input=state();
 await assert.rejects(()=>publishTestserviceState(db.store,input,{environment:'production',expectedManifestEtag:null}),
  e=>e.code==='TEST_COSMOS_ENVIRONMENT_REQUIRED');
 await assert.rejects(()=>readPublishedTestserviceState(db.store,{environment:'production'}),
  e=>e.code==='TEST_COSMOS_ENVIRONMENT_REQUIRED');
 await assert.rejects(()=>publishTestserviceState({...db.store,environment:'production'},input,
  {environment:'testservice',expectedManifestEtag:null}),e=>e.code==='TEST_COSMOS_STORE_SCOPE_INVALID');
 await assert.rejects(()=>publishTestserviceState(db.store,{...input,dataEnvironment:'production'},
  {environment:'testservice',expectedManifestEtag:null}),e=>e.code==='TEST_STATE_DOCUMENT_INVALID');
 assert.equal(db.events.length,0);
});

test('RC1641: no Azure/Cosmos SDK, secrets, background scheduled writes or deletion hooks',()=>{
 const src=fs.readFileSync('api/shared/testservice-cosmos-publication.js','utf8');
 assert.doesNotMatch(src,/@azure\/cosmos|@azure\/storage-blob|https?:\/\/|process\.env|setInterval|setTimeout/);
 assert.doesNotMatch(src,/\.deleteItem\(|\.delete\(|\.upload\(/);
 assert.match(src,/ifNoneMatch:'\*'/);
 assert.match(src,/ifMatch:expected/);
 assert.match(src,/verifiedReadback:true,cloudCostVerified:false/);
});
