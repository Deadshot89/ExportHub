import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createTestserviceHealthEtagCache}=require('../api/shared/testservice-health-etag-cache.js');
const key=(letter)=>letter.repeat(64);

function fixture(){
 const verify=createTestserviceHealthEtagCache();
 const state={etag:'v1',headError:false,readError:false,recovered:false,missingEtag:false,bytes:46398450};
 const calls={head:0,read:0};
 const head=async()=>{calls.head++;if(state.headError)throw Error('AZURE_HEAD_FAILED');return{etag:state.etag}};
 const read=async()=>{
  calls.read++;
  if(state.readError)throw Error('AZURE_GET_FAILED');
  return{etag:state.missingEtag?null:state.etag,cacheable:!state.recovered&&!state.missingEtag,
   summary:{teamStateBytes:state.bytes,teamStateRecoveredFromHistory:state.recovered,diagnostics:{records:123}}};
 };
 return{verify,state,calls,head,read};
}

test('RC-cost: repeated TESTSERVICE health checks use HEAD and never a second full GET when ETag is unchanged',async()=>{
 const f=fixture();
 const first=await f.verify({key:key('a'),head:f.head,read:f.read});
 const second=await f.verify({key:key('a'),head:f.head,read:f.read});
 assert.equal(first.teamStateBytes,46398450);
 assert.deepEqual(second,first);
 assert.deepEqual(f.calls,{head:1,read:1});
});

test('RC-cost: changed ETag always reloads full current data before returning any aggregate',async()=>{
 const f=fixture();
 await f.verify({key:key('a'),head:f.head,read:f.read});
 f.state.etag='v2';f.state.bytes=99;
 const summary=await f.verify({key:key('a'),head:f.head,read:f.read});
 assert.equal(summary.teamStateBytes,99);
 assert.deepEqual(f.calls,{head:1,read:2});
});

test('RC-cost: HEAD failure plus failed GET never uses stale cached health',async()=>{
 const f=fixture();await f.verify({key:key('a'),head:f.head,read:f.read});
 f.state.headError=true;f.state.readError=true;
 await assert.rejects(f.verify({key:key('a'),head:f.head,read:f.read}),/AZURE_GET_FAILED/);
 assert.equal(f.calls.read,2);
 f.state.headError=false;f.state.readError=false;f.state.bytes=88;
 const after=await f.verify({key:key('a'),head:f.head,read:f.read});
 assert.equal(after.teamStateBytes,88);
 assert.equal(f.calls.read,3);
});

test('RC-cost: missing ETag or recovery document cannot be cached as healthy',async()=>{
 for(const changed of [{missingEtag:true},{recovered:true}]){
  const f=fixture();Object.assign(f.state,changed);
  await f.verify({key:key('b'),head:f.head,read:f.read});
  await f.verify({key:key('b'),head:f.head,read:f.read});
  assert.deepEqual(f.calls,{head:0,read:2});
 }
});

test('RC-cost: different account-scoped keys never reuse each other even with matching ETags',async()=>{
 const f=fixture();
 await f.verify({key:key('a'),head:f.head,read:f.read});
 await f.verify({key:key('b'),head:f.head,read:f.read});
 assert.deepEqual(f.calls,{head:0,read:2});
});

test('RC-cost: production or invalid scope always fully reads, without HEAD or warm-cache',async()=>{
 for(const scope of [null,'production','a'.repeat(63)]){
  const f=fixture();
  await f.verify({key:scope,head:f.head,read:f.read});
  await f.verify({key:scope,head:f.head,read:f.read});
  assert.deepEqual(f.calls,{head:0,read:2});
 }
});

test('RC-cost: cache is bounded and an evicted account must be re-read',async()=>{
 const f=fixture();
 const cache=createTestserviceHealthEtagCache(2);
 for(const char of ['a','b','c','a'])await cache({key:key(char),head:f.head,read:f.read});
 assert.equal(f.calls.read,4);
});

test('RC-cost: active API preserves production full-read path and full public health response contract',()=>{
 const api=fs.readFileSync('api/exporthub-state/index.js','utf8');
 assert.match(api,/const healthScope=environment==='testservice'\?/);
 assert.match(api,/crypto\.createHash\('sha256'\)\.update\(cs\)/);
 assert.match(api,/key:c\.healthScope/);
 assert.match(api,/head:\(\)=>c\.team\.getProperties\(\)/);
 assert.match(api,/read:async\(\)=>\{\s*const teamCheck=await readTeamResilient/);
 assert.match(api,/teamStateRecoveredFromHistory:teamSummary\.teamStateRecoveredFromHistory/);
 assert.match(api,/stateDiagnostics:teamSummary\.stateDiagnostics/);
 assert.match(api,/collectionFieldBytes:teamSummary\.collectionFieldBytes/);
 // No changes to the production /api/exporthub-state?mode=health schema.
 assert.match(api,/environment:c\.environment,blob:c\.teamBlobName,authBlobBytes:Number\(authCheck\.bytes\|\|0\),teamStateBytes:teamSummary\.teamStateBytes/);
});
