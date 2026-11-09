import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const connection='EXPORTHUB_STORAGE_CONNECTION_STRING',secret='EXPORTHUB_PUBLIC_ACCESS_SECRET';
const oldConnection=process.env[connection],oldSecret=process.env[secret];
process.env[connection]='rc1876-memory-connection';process.env[secret]='rc1876-memory-secret';
test.after(()=>{if(oldConnection===undefined)delete process.env[connection];else process.env[connection]=oldConnection;
 if(oldSecret===undefined)delete process.env[secret];else process.env[secret]=oldSecret});
const id='SHIPMENT-UK-MAIN',reference='REF-UK-MAIN',resourceKey='a'.repeat(64),tokenHash='b'.repeat(64);
function fixture({index,record,missingIndex=false,missingRecord=false}={}){
 const source=require.resolve('../api/shared/public-access-store.js'),seen=[];
 const entry={kind:'pickup',environment:'testservice',subjectId:id,resourceKey,tokenHash,active:true,
   ...(index||{})};
 const token={kind:'pickup',environment:'testservice',subjectId:id,shipmentId:id,
   reference,tokenHash,resourceKey,createdAt:'2026-11-09T09:00:00Z',...(record||{})};
 const service={getContainerClient(){return{getBlockBlobClient(name){
   seen.push(name);
   return {async download(){
     const subject=name.includes('/subjects/'),value=subject?(missingIndex?null:entry):(missingRecord?null:token);
     if(!value)throw Object.assign(new Error('BlobNotFound'),{statusCode:404});
     return {etag:'"rc1876"',readableStreamBody:(async function*(){yield Buffer.from(JSON.stringify(value))})()};
   }};
 }}}};
 const original=Module._load;
 Module._load=function(request,parent,isMain){
   if(request==='@azure/storage-blob'&&parent&&parent.filename===source)
     return {BlobServiceClient:{fromConnectionString(){return service}}};
   return original.call(this,request,parent,isMain);
 };
 delete require.cache[source];let store;
 try{store=require(source)}finally{Module._load=original}
 return {store,seen};
}
test('a persisted subject index and matching pickup registration yield a server-only proof',async()=>{
 const {store,seen}=fixture();
 const result=await store.inspectPickupSubject('testservice',id);
 assert.deepEqual(result,{environment:'testservice',subjectId:id,shipmentId:id,reference,
   resourceKey,issuedAt:'2026-11-09T09:00:00Z'});
 assert.equal(Object.hasOwn(result,'tokenHash'),false);
 assert.equal(seen.length,2);
 assert.ok(seen[0].includes('/testservice/pickup/subjects/'));
 assert.ok(seen[1].includes('/testservice/pickup/records/'));
});
test('missing or disabled pickup subject is not registration evidence',async()=>{
 assert.equal(await fixture({missingIndex:true}).store.inspectPickupSubject('testservice',id),null);
 assert.equal(await fixture({index:{active:false}}).store.inspectPickupSubject('testservice',id),null);
 assert.equal(await fixture({index:{revokedAt:'2026-11-09T10:00:00Z'}}).store.inspectPickupSubject('testservice',id),null);
 assert.equal(await fixture({record:{revokedAt:'2026-11-09T10:00:00Z'}}).store.inspectPickupSubject('testservice',id),null);
});
test('subject and token record must match exactly, not just the customer display label',async()=>{
 for(const data of [
   {index:{subjectId:'ANOTHER'}},{index:{environment:'production'}},
   {record:{subjectId:'ANOTHER'}},{record:{environment:'production'}},
   {record:{tokenHash:'c'.repeat(64)}},{missingRecord:true}
 ]){
   const {store}=fixture(data);
   await assert.rejects(store.inspectPickupSubject('testservice',id),{code:'PICKUP_SUBJECT_MISMATCH'});
 }
});
test('malformed subject, resource key or token hash are rejected',async()=>{
 for(const index of [{tokenHash:'123'},{resourceKey:'bad'},{kind:'avis'}])
   await assert.rejects(fixture({index}).store.inspectPickupSubject('testservice',id),{code:'PICKUP_SUBJECT_MISMATCH'});
 for(const bad of ['',null,'X'.repeat(257)])
   await assert.rejects(fixture().store.inspectPickupSubject('testservice',bad),{code:'PICKUP_SUBJECT_INVALID'});
 await assert.rejects(fixture().store.inspectPickupSubject('demo',id),{code:'PICKUP_SUBJECT_INVALID'});
});
test('lookup is read-only, not a shipment association or an HTTP capability',async()=>{
 const {store}=fixture();
 const before=Object.keys(store).sort();
 const result=await store.inspectPickupSubject('testservice',id);
 assert.equal(result.shipmentId,id);
 assert.equal(typeof store.inspectPickupSubject,'function');
 assert.deepEqual(Object.keys(store).sort(),before);
 assert.equal(Object.hasOwn(result,'pickupTargetId'),false);
 assert.equal(Object.hasOwn(result,'companyKey'),false);
});
