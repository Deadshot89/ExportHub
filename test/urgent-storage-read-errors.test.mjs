import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const internal=require('../api/urgent-orders/index.js');
const publicApi=require('../api/urgent-order-public/index.js');
function refs(code){return {environment:'testservice',blob:{name:'testservice/urgent-orders/v1.json',async download(){const e=new Error('private storage details');e.statusCode=404;if(code)e.code=code;throw e;}}};}
test('Urgent storage only treats BlobNotFound as an empty document',async()=>{
 const empty=await internal.readDocument(refs('BlobNotFound'));
 assert.deepEqual(empty.orders,[]);
 for(const code of ['ContainerNotFound','ResourceNotFound',undefined]){
  await assert.rejects(internal.readDocument(refs(code)),e=>e.status===503);
 }
});
test('Urgent public live gate rejects missing containers rather than reporting healthy 403',async()=>{
 const storage=internal.storage;
 try{
  for(const code of ['ContainerNotFound','BlobNotFound']){
   internal.storage=()=>refs(code);
   const ctx={log:{warn(){}}};
   await publicApi(ctx,{method:'POST',headers:{},body:{action:'list'}});
   const body=JSON.parse(ctx.res.body);
   assert.equal(ctx.res.status,code==='BlobNotFound'?403:503);
   assert.equal(body.ok,false);
   assert.doesNotMatch(JSON.stringify(body),/private storage details/);
  }
 }finally{internal.storage=storage;}
});
test('Urgent create never attempts a write after a container-read failure',async()=>{
 const ref=refs('ContainerNotFound');let mutations=0;
 await assert.rejects(internal.write(ref,()=>{mutations++;}),e=>e.status===503);
 assert.equal(mutations,0);
});
function flakyRefs(failures,code='ECONNRESET'){
 let calls=0;
 return {environment:'testservice',get calls(){return calls;},blob:{name:'testservice/urgent-orders/v1.json',async download(){
  calls++;
  if(calls<=failures){const e=new Error('socket hang up / private account');e.code=code;throw e;}
  const body=JSON.stringify({schemaVersion:1,orders:[]});
  return {etag:'"e1"',readableStreamBody:(async function*(){yield Buffer.from(body);})()};
 }}};
}
test('Urgent read repeats a short network failure instead of answering 500',async()=>{
 const ref=flakyRefs(2);
 const doc=await internal.readDocument(ref);
 assert.deepEqual(doc.orders,[]);
 assert.equal(ref.calls,3);
});
test('Urgent read gives up after the bounded retries and keeps the original error',async()=>{
 const ref=flakyRefs(10);
 await assert.rejects(internal.readDocument(ref),e=>e.code==='ECONNRESET');
 assert.equal(ref.calls,3);
});
test('Urgent read never repeats own problems or non-transient errors',async()=>{
 let calls=0;
 await assert.rejects(internal.withReadRetry(async()=>{calls++;const e=new Error('x');e.code='SESSION_INVALID';e.status=401;throw e;}),e=>e.status===401);
 assert.equal(calls,1);
 calls=0;
 await assert.rejects(internal.withReadRetry(async()=>{calls++;throw new TypeError('bug');}),TypeError);
 assert.equal(calls,1);
});
test('Urgent API repeats a transient session read and then answers a controlled 503, never 500',async()=>{
 const authStore=createRequire(import.meta.url)('../api/shared/auth-store.js');
 const validate=authStore.validateSession;
 const logs=[];let calls=0;
 try{
  authStore.validateSession=async()=>{calls++;const e=new Error('connect failed for private account');e.code='REQUEST_SEND_ERROR';throw e;};
  const ctx={log:{warn(...args){logs.push(args.join(' '));}}};
  await internal(ctx,{method:'POST',headers:{},body:{action:'counts'}});
  const body=JSON.parse(ctx.res.body);
  assert.equal(calls,3);
  assert.equal(ctx.res.status,503);
  assert.equal(body.code,'URGENT_STORAGE_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(body),/private account|REQUEST_SEND_ERROR/);
  assert.match(logs.join('\n'),/URGENT_STORAGE_UNAVAILABLE 503 REQUEST_SEND_ERROR/);
  assert.doesNotMatch(logs.join('\n'),/private account/);
 }finally{authStore.validateSession=validate;}
});
test('Urgent API keeps 401 for an invalid session without retrying',async()=>{
 const authStore=createRequire(import.meta.url)('../api/shared/auth-store.js');
 const validate=authStore.validateSession;let calls=0;
 try{
  authStore.validateSession=async()=>{calls++;throw authStore.error('SESSION_INVALID','invalid',401);};
  const ctx={log:{warn(){}}};
  await internal(ctx,{method:'POST',headers:{},body:{action:'counts'}});
  assert.equal(ctx.res.status,401);
  assert.equal(JSON.parse(ctx.res.body).code,'SESSION_INVALID');
  assert.equal(calls,1);
 }finally{authStore.validateSession=validate;}
});
test('Urgent API hides raw codes of unexpected server errors',async()=>{
 const authStore=createRequire(import.meta.url)('../api/shared/auth-store.js');
 const validate=authStore.validateSession;
 try{
  authStore.validateSession=async()=>{const e=new Error('boom');e.code='InternalPrivateThing';throw e;};
  const ctx={log:{warn(){}}};
  await internal(ctx,{method:'POST',headers:{},body:{action:'counts'}});
  assert.equal(ctx.res.status,500);
  assert.equal(JSON.parse(ctx.res.body).code,'URGENT_ERROR');
 }finally{authStore.validateSession=validate;}
});
test('Urgent write never repeats an upload after a transient write failure',async()=>{
 let uploads=0;
 const ref={environment:'testservice',blob:{name:'testservice/urgent-orders/v1.json',
  async download(){const e=new Error('nf');e.statusCode=404;e.code='BlobNotFound';throw e;},
  async upload(){uploads++;const e=new Error('reset');e.code='ECONNRESET';throw e;}}};
 await assert.rejects(internal.write(ref,()=>({})),e=>e.code==='ECONNRESET');
 assert.equal(uploads,1);
});
