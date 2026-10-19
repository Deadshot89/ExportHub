import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {patchRc1576StateBodyDeadline} from '../scripts/rc1576-state-read-body-timeout.mjs';

const canonical=fs.readFileSync('index.html','utf8');
const testCanonical=fs.readFileSync('TESTVERSION.html','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function extractedJsonFetch(){
  const html=patchRc1576StateBodyDeadline(canonical,'index.html');
  const start=html.indexOf('async function jsonFetch(url,options){');
  const end=html.indexOf('async function parseLargeJson(',start);
  assert.ok(start>=0&&end>start,'JSON transport missing');
  return html.slice(start,end);
}

function runtime(response,timeoutClamp=5){
  const source=extractedJsonFetch();
  const aborters=new WeakMap();
  let aborted=0;
  aborters.set(response,()=>{aborted++});
  const native={
    setTimeout(fn,ms){return setTimeout(fn,Math.min(ms,timeoutClamp))},
    clearTimeout(id){clearTimeout(id)}
  };
  const context={runtime:{authToken:''},native,rc1576ResponseAbort:aborters,
    resilientFetch:async()=>response,apiEndpointLabel:()=>'\/api\/exporthub-state',
    text:v=>String(v??'').trim(),console};
  vm.createContext(context);
  const jsonFetch=vm.runInContext(source+'\njsonFetch',context);
  return {jsonFetch,getAborts:()=>aborted};
}

test('RC1576: build patches exactly one streamed read in production and TESTSERVICE',()=>{
  for(const [file,html] of [['index.html',canonical],['TESTVERSION.html',testCanonical]]){
    const patched=patchRc1576StateBodyDeadline(html,file);
    assert.equal(patched.split('const rc1576Started=Date.now()').length-1,1,file);
    assert.match(patched,/rc1576ResponseAbort\.set\(res/);
    assert.match(patched,/rc1576Remaining/);
    assert.match(patched,/e\.code='API_TIMEOUT'/);
    assert.doesNotMatch(patched,/const txt=await res\.text\(\);let data=\{\}/);
  }
  assert.match(builder,/patchRc1576StateBodyDeadline\(html,file\)/,
    'all three environment builds must get the transport fix');
});

test('RC1576: a state-read body that never finishes is timed out and aborted',async()=>{
  const response={ok:true,status:200,text:()=>new Promise(()=>{})};
  const {jsonFetch,getAborts}=runtime(response);
  await assert.rejects(
    jsonFetch('/api/exporthub-state?mode=read',{timeoutMs:3000,maxAttempts:1}),
    e=>e.code==='API_TIMEOUT'&&/Azure-Teamdaten/.test(e.message)
  );
  assert.equal(getAborts(),1,'in-flight response must be aborted');
});

test('RC1576: successful state-read body returns same JSON data',async()=>{
  const response={ok:true,status:200,text:async()=>JSON.stringify({ok:true,environment:'production',revision:42})};
  const {jsonFetch,getAborts}=runtime(response);
  const result=await jsonFetch('/api/exporthub-state?mode=read',{timeoutMs:3000,maxAttempts:1});
  assert.equal(result.revision,42);
  assert.equal(getAborts(),0);
});

test('RC1576: save and auth response behavior remains unchanged',async()=>{
  const response={ok:true,status:200,text:async()=>JSON.stringify({ok:true,saved:true})};
  const {jsonFetch,getAborts}=runtime(response);
  const result=await jsonFetch('/api/exporthub-state?mode=save',{timeoutMs:50000,maxAttempts:1});
  assert.equal(result.saved,true);
  assert.equal(getAborts(),0);
});
