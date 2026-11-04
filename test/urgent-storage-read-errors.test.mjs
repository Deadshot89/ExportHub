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
