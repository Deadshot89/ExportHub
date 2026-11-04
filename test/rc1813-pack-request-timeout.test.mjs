import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../assets/pack-notification.js',import.meta.url),'utf8');
const locales=fs.readFileSync(new URL('../assets/i18n/pack-notification-drafts.js',import.meta.url),'utf8');
const begin=source.indexOf('  async function api(action,payload){');
const stop=source.indexOf('\n  async function loadPackagingMaster',begin);
assert.ok(begin>=0&&stop>begin,'RC1813 API function must remain extractable');
const makeApi=new Function('fetch','AbortController','setTimeout','clearTimeout','tr',source.slice(begin,stop)+'\nreturn api;');

function harness(fn){
 const timers=[],cleared=[],calls=[];
 const api=makeApi((url,opts)=>{calls.push({url,opts});return fn(url,opts);},AbortController,
  (callback,ms)=>{timers.push({callback,ms});return timers.length;},
  id=>cleared.push(id),key=>key);
 return{api,timers,cleared,calls};
}
function abortable(){return (_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{const e=new Error('aborted');e.name='AbortError';reject(e);}));}

test('RC1813 draft-save timeout shows uncertain result and never auto-retries',async()=>{
 const h=harness(abortable()),pending=h.api('draft-save',{draft:{}});
 assert.equal(h.timers[0].ms,45000);
 h.timers[0].callback();
 await assert.rejects(pending,e=>e.code==='PACK_REQUEST_TIMEOUT'&&e.message==='pack.draft.unknownSave'&&e.httpStatus===0);
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].opts.credentials,'omit');
 assert.deepEqual(h.cleared,[1]);
});

test('RC1813 request deadline remains armed during a stalled JSON response body',async()=>{
 let signal;
 const h=harness((_url,options)=>{
  signal=options.signal;
  return Promise.resolve({ok:true,status:200,json:()=>new Promise((_resolve,reject)=>{
   signal.addEventListener('abort',()=>{const e=new Error('aborted');e.name='AbortError';reject(e);});
  })});
 });
 const pending=h.api('submit',{idempotencyKey:'test'});
 for(let i=0;i<5;i++)await Promise.resolve();
 h.timers[0].callback();
 await assert.rejects(pending,e=>e.code==='PACK_REQUEST_TIMEOUT'&&e.message==='pack.draft.unknownSave');
 assert.equal(h.calls.length,1);
 assert.deepEqual(h.cleared,[1]);
});

test('RC1813 read operations use bounded 25-second deadline',async()=>{
 const h=harness(abortable()),pending=h.api('draft-list',{stationToken:'E2E-PACK-test'});
 assert.equal(h.timers[0].ms,25000);
 h.timers[0].callback();
 await assert.rejects(pending,e=>e.code==='PACK_REQUEST_TIMEOUT'&&e.message==='pack.draft.requestTimeout');
 assert.deepEqual(h.cleared,[1]);
});

test('RC1813 preserves success, server error code and cleans up timers',async()=>{
 const ok=harness(async()=>({ok:true,status:200,json:async()=>({ok:true,draft:{id:'D1'}})}));
 assert.equal((await ok.api('draft-save',{})).draft.id,'D1');
 assert.deepEqual(ok.cleared,[1]);
 const error=harness(async()=>({ok:false,status:503,json:async()=>({ok:false,code:'PACK_CONCURRENT_UPDATE',message:'Server busy'})}));
 await assert.rejects(error.api('draft-save',{}),e=>e.code==='PACK_CONCURRENT_UPDATE'&&e.httpStatus===503&&e.message==='Server busy');
 assert.deepEqual(error.cleared,[1]);
});

test('RC1813 timeout feedback exists in all six languages and save lock is released',()=>{
 assert.equal((locales.match(/'pack\.draft\.unknownSave':/g)||[]).length,6);
 assert.equal((locales.match(/'pack\.draft\.requestTimeout':/g)||[]).length,6);
 assert.match(source,/finally\{state\.draftSaveLocked=false;els\.saveDraft\.disabled=false;/);
 assert.match(source,/catch\(err\)\{state\.submitLocked=false;els\.submit\.textContent=tr\('pack\.submit'\)/);
});

test('RC1813 unreadable write acknowledgements remain uncertain and are never retried',async()=>{
 for(const action of ['draft-save','submit'])for(const problem of [new SyntaxError('Unexpected end of JSON'),new TypeError('terminated')]){
  const h=harness(async()=>({ok:true,status:200,json:async()=>{throw problem;}}));
  await assert.rejects(h.api(action,{}),e=>e.code==='PACK_RESPONSE_INVALID'&&e.message==='pack.draft.unknownSave');
  assert.equal(h.calls.length,1);
  assert.deepEqual(h.cleared,[1]);
 }
});

test('RC1813 write success requires the actual draft ID or notification reference acknowledgement',async()=>{
 for(const action of ['draft-save','submit'])for(const payload of [null,[],{}, {ok:true},{ok:true,draft:{id:''},reference:''}]){
  const h=harness(async()=>({ok:true,status:200,json:async()=>payload}));
  await assert.rejects(h.api(action,{}),e=>e.code==='PACK_RESPONSE_INVALID'&&e.message==='pack.draft.unknownSave');
  assert.equal(h.calls.length,1);
 }
 const draft=harness(async()=>({ok:true,status:200,json:async()=>({ok:true,draft:{id:'D1'}})}));
 assert.equal((await draft.api('draft-save',{})).draft.id,'D1');
 const submit=harness(async()=>({ok:true,status:201,json:async()=>({ok:true,reference:'PK-SYNTH'} )}));
 assert.equal((await submit.api('submit',{})).reference,'PK-SYNTH');
});

test('RC1813 malformed read responses fail instead of showing an empty successful overview',async()=>{
 const h=harness(async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError('HTML instead of JSON');}}));
 await assert.rejects(h.api('draft-list',{}),e=>e.code==='PACK_RESPONSE_INVALID'&&e.message==='pack.draft.pageFailed');
 assert.equal(h.calls.length,1);
 assert.deepEqual(h.cleared,[1]);
});
