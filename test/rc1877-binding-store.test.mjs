import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const variable='EXPORTHUB_STORAGE_CONNECTION_STRING',previous=process.env[variable];
process.env[variable]='rc1877-memory-connection';
test.after(()=>{if(previous===undefined)delete process.env[variable];else process.env[variable]=previous});
function memory(){
 const blobs=new Map();let sequence=0,failNext=false;
 const missing=()=>Object.assign(new Error('NotFound'),{statusCode:404});
 const conflict=()=>Object.assign(new Error('ConditionNotMet'),{statusCode:412});
 return {
  blobs,
  conflictNext(){failNext=true},
  createBlobServiceClient(){
   return {
    getContainerClient(container){
     return {
      getBlockBlobClient(path){
       const id=container+'/'+path;
       return {
        async download(){
         const found=blobs.get(id);if(!found)throw missing();
         return {etag:found.etag,readableStreamBody:(async function*(){
          for(const chunk of found.chunks||[found.bytes])yield chunk;
         })()};
        },
        async upload(raw,len,options={}){
         if(failNext){failNext=false;throw conflict()}
         assert.equal(len,Buffer.byteLength(raw));
         assert.equal(options.transportAttempts,1);
         const old=blobs.get(id),conditions=options.conditions||{};
         if(conditions.ifMatch&&(!old||conditions.ifMatch!==old.etag))throw conflict();
         if(conditions.ifNoneMatch==='*'&&old)throw conflict();
         const etag='"'+(++sequence)+'"';
         blobs.set(id,{bytes:Buffer.from(raw),etag});
         return {etag};
        }
       };
      }
     };
    }
   };
  }
 };
}
function load(mem){
 const path=require.resolve('../api/shared/pickup-transport-binding-store.js'),old=Module._load;
 Module._load=function(name,parent,isMain){
  if(name==='./blob-rest'&&parent&&parent.filename===path)return mem;
  return old.call(this,name,parent,isMain);
 };
 delete require.cache[path];
 try{return require(path)}finally{Module._load=old}
}
const scope={environment:'testservice',companyKey:'essentra'};
const proof={id:'MAIN-UK',shipmentId:'MAIN-UK',reference:'REF-UK',pickupTargetId:'FIX-UK',
 pickupDate:'2026-11-09',environment:'testservice',companyKey:'essentra',registered:true};
const bind=(store,extra={})=>store.applyBinding({...scope,pickupTargetId:'FIX-UK',expectedRevision:0,
 actor:'OP1',reason:'Sammeltransport am Montag verbunden',proof,...extra});
test('separate hashed paths isolate firms and TESTSERVICE/production',()=>{
 const store=load(memory());
 const a=store.pathFor(scope);
 assert.match(a,/^testservice\/pickup-transport-bindings\/[a-f0-9]{24}\.json$/);
 assert.notEqual(a,store.pathFor({...scope,environment:'production'}));
 assert.notEqual(a,store.pathFor({...scope,companyKey:'foreign'}));
 assert.doesNotMatch(a,/essentra/);
});
test('first read does not write; authenticated two-device readback persists explicit FIX link',async()=>{
 const mem=memory(),store=load(mem);
 assert.deepEqual((await store.read(scope)).bindings,[]);
 assert.equal(mem.blobs.size,0);
 const saved=await bind(store);
 assert.equal(saved.revision,1);assert.equal(saved.changed,true);
 assert.equal(saved.bindings[0].shipmentId,'MAIN-UK');assert.equal(saved.bindings[0].pickupTargetId,'FIX-UK');
 const readBack=await load(mem).read(scope,{includeAudit:true});
 assert.equal(readBack.revision,1);assert.equal(readBack.audit.length,1);
 assert.equal(readBack.audit[0].by,'OP1');assert.equal(readBack.audit[0].action,'bind-main');
 assert.equal(readBack.bindings[0].reference,'REF-UK');
 assert.equal(mem.blobs.size,1);
});
test('duplicate binding is idempotent with no extra audit event or storage write',async()=>{
 const store=load(memory());
 await bind(store);
 const again=await bind(store,{expectedRevision:1});
 assert.equal(again.changed,false);assert.equal(again.revision,1);
 assert.equal((await store.read(scope,{includeAudit:true})).audit.length,1);
});
test('rebind requires explicit confirmation and leaves an audit trail',async()=>{
 const store=load(memory());await bind(store);
 const other={...proof,pickupTargetId:'FIX-FR'};
 await assert.rejects(bind(store,{pickupTargetId:'FIX-FR',proof:other,expectedRevision:1}),
   {code:'BINDING_OVERRIDE_CONFIRMATION_REQUIRED'});
 const result=await bind(store,{pickupTargetId:'FIX-FR',proof:other,expectedRevision:1,
   confirmOverride:true,reason:'Geänderte Sammelabholung nach Rücksprache'});
 assert.equal(result.changed,true);assert.equal(result.revision,2);
 const snapshot=await store.read(scope,{includeAudit:true});
 assert.equal(snapshot.bindings[0].pickupTargetId,'FIX-FR');
 assert.equal(snapshot.audit[1].oldPickupTargetId,'FIX-UK');
 assert.equal(snapshot.audit[1].pickupTargetId,'FIX-FR');
});
test('date-only move needs confirmation and is audited with the new calendar day',async()=>{
 const store=load(memory());await bind(store);
 const later={...proof,pickupDate:'2026-11-16'};
 await assert.rejects(bind(store,{expectedRevision:1,proof:later}),{code:'BINDING_OVERRIDE_CONFIRMATION_REQUIRED'});
 const changed=await bind(store,{expectedRevision:1,proof:later,confirmOverride:true,
   reason:'Kunde hat Abholtag auf nächste Woche verschoben'});
 assert.equal(changed.changed,true);
 assert.equal(changed.bindings[0].pickupDate,'2026-11-16');
 const snapshot=await store.read(scope,{includeAudit:true});
 assert.equal(snapshot.audit[1].action,'rebind-main');
 assert.equal(snapshot.bindings.length,1);
});
test('stale revision cannot overwrite a newly stored binding',async()=>{
 const store=load(memory());await bind(store);
 await assert.rejects(bind(store,{expectedRevision:0}),{code:'BINDING_REVISION_CONFLICT'});
 assert.equal((await store.read(scope,{includeAudit:true})).audit.length,1);
});
test('Azure ETag race fails closed without overwriting either version',async()=>{
 const mem=memory(),store=load(mem);mem.conflictNext();
 await assert.rejects(bind(store),{code:'BINDING_CONCURRENT_UPDATE'});
 assert.equal(mem.blobs.size,0);
});
test('untrusted, cross-environment and mismatched registration proofs never write',async()=>{
 const mem=memory(),store=load(mem);
 for(const bad of [{...proof,registered:false},{...proof,environment:'production'},
  {...proof,companyKey:'other'},{...proof,pickupTargetId:'FIX-FR'},
  {...proof,reference:''},{...proof,pickupDate:'2026-11-31'}]){
  await assert.rejects(bind(store,{proof:bad}),{code:'BINDING_PROOF_INVALID'});
 }
 assert.equal(mem.blobs.size,0);
});
test('missing actor and brief audit justification block a mutation',async()=>{
 const mem=memory(),store=load(mem);
 await assert.rejects(bind(store,{actor:''}),{code:'BINDING_AUDIT_REQUIRED'});
 await assert.rejects(bind(store,{reason:'yes'}),{code:'BINDING_AUDIT_REQUIRED'});
 assert.equal(mem.blobs.size,0);
});
test('corrupt and foreign firm blobs never become valid defaults',async()=>{
 const mem=memory(),store=load(mem),key='exporthub-data/'+store.pathFor(scope);
 mem.blobs.set(key,{etag:'"first"',bytes:Buffer.from('{invalid-json')});
 await assert.rejects(store.read(scope),{code:'BINDING_DOCUMENT_INVALID'});
 mem.blobs.set(key,{etag:'"second"',bytes:Buffer.from(JSON.stringify({
  schemaVersion:1,environment:'production',companyKey:'essentra',revision:0,bindings:[],audit:[]
 }))});
 await assert.rejects(store.read(scope),{code:'BINDING_DOCUMENT_INVALID'});
});
test('duplicate active main IDs or duplicate refs are never silently accepted',async()=>{
 const mem=memory(),store=load(mem),key='exporthub-data/'+store.pathFor(scope);
 const row={...scope,shipmentId:'MAIN-UK',reference:'REF-UK',pickupDate:'2026-11-09',
   pickupTargetId:'FIX-UK',active:true};
 for(const conflicting of [{...row,pickupTargetId:'FIX-FR'},
    {...row,shipmentId:'MAIN-FR'}]){
  mem.blobs.set(key,{etag:'"one"',bytes:Buffer.from(JSON.stringify({
   schemaVersion:1,...scope,revision:1,bindings:[row,conflicting],audit:[]
  }))});
  await assert.rejects(store.read(scope),{code:'BINDING_DOCUMENT_INVALID'});
 }
});
test('multibyte audit data survives split Azure UTF-8 download chunks',async()=>{
 const mem=memory(),store=load(mem);
 await bind(store,{actor:'Müller',reason:'Größe des Sammeltransportes geprüft'});
 const key='exporthub-data/'+store.pathFor(scope),item=mem.blobs.get(key);
 const at=item.bytes.indexOf(Buffer.from('ü','utf8'));
 assert.ok(at>0);item.chunks=[item.bytes.subarray(0,at+1),item.bytes.subarray(at+1)];
 const restored=await load(mem).read(scope,{includeAudit:true});
 assert.equal(restored.audit[0].by,'Müller');
 assert.equal(restored.audit[0].reason,'Größe des Sammeltransportes geprüft');
});
