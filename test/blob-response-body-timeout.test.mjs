import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
process.env.EXPORTHUB_STORAGE_TIMEOUT_MS='5000';
process.env.EXPORTHUB_STORAGE_ATTEMPTS='1';
const {createBlobServiceClient}=require('../api/shared/blob-rest.js');
const service=()=>createBlobServiceClient('AccountName=offline;AccountKey=b2ZmbGluZQ==;BlobEndpoint=https://storage.example.invalid');
for(const operation of ['download','list','retention','error']){
 test('storage timeout covers stalled '+operation+' response body',async t=>{
  const original=globalThis.fetch;let signal,release;
  t.mock.timers.enable({apis:['setTimeout']});
  globalThis.fetch=async(_url,options)=>{
   signal=options.signal;
   const read=()=>new Promise((resolve,reject)=>{
    release=()=>resolve(operation==='download'?new ArrayBuffer(0):'');
    signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true});
   });
   return {ok:operation!=='error',status:operation==='error'?403:200,headers:new Headers(),arrayBuffer:read,text:read};
  };
  const container=service().getContainerClient('test');
  const request=operation==='list'?(async()=>{for await(const _ of container.listBlobsFlat()){} })():operation==='retention'?service().getDeleteRetentionPolicy():container.getBlockBlobClient('sample').download();
  const result=request.then(value=>({value}),error=>({error}));
  try{
   for(let i=0;i<8;i++)await Promise.resolve();
   assert.equal(typeof release,'function','body consumption started');
   t.mock.timers.tick(5001);
   for(let i=0;i<8;i++)await Promise.resolve();
   assert.equal(signal.aborted,true,'deadline remains active after headers');
   const outcome=await result;
   assert.equal(outcome.error?.code,'STORAGE_TIMEOUT');
   assert.equal(outcome.error?.statusCode,504);
  }finally{release?.();await result;globalThis.fetch=original;t.mock.timers.reset();}
 });
}
