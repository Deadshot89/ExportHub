import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {patchRc1576StateBodyDeadline} from '../scripts/rc1576-state-read-body-timeout.mjs';
import {patchRc1619LargeStateWorkerParse} from '../scripts/rc1619-large-state-worker-parse.mjs';

const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function sample(file='index.html'){
 const html=fs.readFileSync(file,'utf8');
 const rc1576=patchRc1576StateBodyDeadline(html,file);
 return patchRc1619LargeStateWorkerParse(rc1576,file);
}
function isolatedJsonFetch(response,{worker=true,brokenWorker=false,hangWorker=false}={}){
 const html=sample();
 const begin=html.indexOf('async function jsonFetch(url,options){');
 const end=html.indexOf('\nfunction setLoginEnabled(enabled){',begin);
 assert.ok(begin>0&&end>begin,'runtime jsonFetch and parser boundaries');
 const calls={worker:0,terminated:0,revoked:0};
 const dataURL={createObjectURL(){return 'blob:test';},revokeObjectURL(){calls.revoked++}};
 class MockWorker{
  constructor(){calls.worker++;if(brokenWorker)throw Error('CSP blocked worker')}
  postMessage(raw){if(!hangWorker)queueMicrotask(()=>this.onmessage({data:{ok:true,value:JSON.parse(raw)}}))}
  terminate(){calls.terminated++}
 }
 const native={setTimeout(callback){if(hangWorker)queueMicrotask(callback);return 1},clearTimeout(){}};
 const ctx={window:{Worker:worker?MockWorker:null},Worker:MockWorker,URL:dataURL,
   Blob:class{constructor(){}},native,runtime:{authToken:''},
   resilientFetch:async()=>response,apiEndpointLabel:()=>'/api/exporthub-state',
   text:v=>String(v??'').trim(),console};
 vm.createContext(ctx);
 return {fetch:vm.runInContext(html.slice(begin,end)+'\njsonFetch',ctx),calls};
}
const large=JSON.stringify({ok:true,revision:42,state:{values:['X'.repeat(1_100_000)]}});

test('RC1619: three-environment builder invokes parse optimization after RC1576 body deadline',()=>{
 assert.match(builder,/import \{patchRc1619LargeStateWorkerParse\} from '\.\.\/\.\.\/scripts\/rc1619-large-state-worker-parse.mjs'/);
 const timeout=builder.indexOf('html=patchRc1576StateBodyDeadline(html,file)');
 const worker=builder.indexOf('html=patchRc1619LargeStateWorkerParse(html,file)');
 assert.ok(timeout>=0&&worker>timeout);
 for(const file of ['index.html','TESTVERSION.html']){
  const html=sample(file);
  assert.equal(html.split('const rc1619LargeStateRead=').length-1,1,file);
  assert.match(html,/const rc1576Remaining=/,file);
 }
 assert.equal(patchRc1619LargeStateWorkerParse('<html>demo</html>','demo.html'),'<html>demo</html>');
});
test('RC1619: a 1MB+ team-state read delegates JSON parsing to a Worker without changing output',async()=>{
 const {fetch,calls}=isolatedJsonFetch({status:200,ok:true,text:async()=>large});
 const data=await fetch('/api/exporthub-state?mode=read',{maxAttempts:1});
 assert.equal(data.state.values[0].length,1_100_000);
 assert.equal(data.revision,42);
 assert.equal(calls.worker,1);
 assert.equal(calls.terminated,1);
 assert.equal(calls.revoked,1);
});
test('RC1619: normal save and small reads retain synchronous JSON parse',async()=>{
 for(const [url,payload] of [['/api/exporthub-state?mode=save',large],['/api/exporthub-state?mode=read',JSON.stringify({ok:true,revision:6})]]){
  const {fetch,calls}=isolatedJsonFetch({status:200,ok:true,text:async()=>payload});
  const data=await fetch(url,{maxAttempts:1});
  assert.equal(data.ok,true);
  assert.equal(calls.worker,0);
 }
});
test('RC1619: browser without Worker retains the original, valid JSON response',async()=>{
 const {fetch,calls}=isolatedJsonFetch({status:200,ok:true,text:async()=>large},{worker:false});
 const data=await fetch('/api/exporthub-state?mode=read',{maxAttempts:1});
 assert.equal(data.revision,42);
 assert.equal(calls.worker,0);
});
test('RC1619: worker creation failure is safe and falls back without losing state',async()=>{
 const {fetch,calls}=isolatedJsonFetch({status:200,ok:true,text:async()=>large},{brokenWorker:true});
 const data=await fetch('/api/exporthub-state?mode=read',{maxAttempts:1});
 assert.equal(data.revision,42);
 assert.equal(calls.worker,1);
 assert.equal(calls.revoked,1);
});
test('RC1619: a hung Worker times out and a valid document still parses',async()=>{
 const {fetch,calls}=isolatedJsonFetch({status:200,ok:true,text:async()=>large},{hangWorker:true});
 const data=await fetch('/api/exporthub-state?mode=read',{maxAttempts:1});
 assert.equal(data.revision,42);
 assert.equal(calls.worker,1);
 assert.equal(calls.terminated,1);
 assert.equal(calls.revoked,1);
});
test('RC1619: malformed state JSON cannot falsely report a successful read',async()=>{
 const {fetch}=isolatedJsonFetch({status:200,ok:true,text:async()=>'{broken'},{worker:false});
 await assert.rejects(()=>fetch('/api/exporthub-state?mode=read',{maxAttempts:1}),e=>e.code==='INVALID_SERVER_JSON');
});
