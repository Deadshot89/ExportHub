import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {verifyClamAvEngine}=require('../tools/rc1972-clamav/engine-selftest.cjs');

test('RC1972: mock clean + EICAR signature detection yields only non-releasing engine evidence',async()=>{
 const paths=[];
 const result=await verifyClamAvEngine({runner:async(file,timeout)=>{
  assert.equal(timeout,1000);
  paths.push(file);
  const body=await fs.readFile(file);
  assert.equal((await fs.stat(file)).mode&0o077,0);
  if(body.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE!'))){
   assert.equal(body.length,68);
   assert.ok(body.toString('ascii').startsWith('X5O!P%@AP[4\\PZX'));
   return{exitCode:1,timedOut:false};
  }
  assert.match(body.toString('ascii'),/clean file/);
  return{exitCode:0,timedOut:false};
 },timeoutMs:1000});
 assert.deepEqual(result,{verified:true,authorizedForRelease:false,
  engine:'clamav',evidence:'local-clean-plus-eicar-self-test'});
 assert.equal(paths.length,2);
 for(const p of paths)await assert.rejects(fs.access(p));
});
test('RC1972: EICAR not detected prevents trusting a permissive scanner',async()=>{
 let calls=0;
 const result=await verifyClamAvEngine({runner:async()=>{
  calls++;return{exitCode:0,timedOut:false};
 },timeoutMs:1000});
 assert.deepEqual(result,{verified:false,authorizedForRelease:false,reason:'eicar-not-detected'});
 assert.equal(calls,2);
});
test('RC1972: a false positive for clean probe fails closed before EICAR',async()=>{
 let calls=0;
 const r=await verifyClamAvEngine({runner:async()=>{
  calls++;return{exitCode:1,timedOut:false};
 },timeoutMs:1000});
 assert.equal(r.reason,'clean-probe-failed');
 assert.equal(r.authorizedForRelease,false);
 assert.equal(calls,1);
});
test('RC1972: nonfunctional, hung, or crashed scanner never verifies readiness',async()=>{
 for(const value of [{exitCode:2,timedOut:false},{exitCode:0,timedOut:true},
  {exitCode:null,timedOut:true},null]){
  const r=await verifyClamAvEngine({runner:async()=>value,timeoutMs:1000});
  assert.equal(r.verified,false);
  assert.equal(r.authorizedForRelease,false);
 }
 const r=await verifyClamAvEngine({runner:async()=>{throw Error('FAKE_ACCOUNT_SECRET');},timeoutMs:1000});
 assert.deepEqual(r,{verified:false,authorizedForRelease:false,reason:'engine-unavailable'});
 assert.doesNotMatch(JSON.stringify(r),/FAKE_ACCOUNT_SECRET/);
});
test('RC1972: EICAR runner failures, timeout and missing result fail closed',async()=>{
 for(const result of [{exitCode:2,timedOut:false},
  {exitCode:1,timedOut:true},{exitCode:null,timedOut:false},null]){
  let calls=0;
  const r=await verifyClamAvEngine({runner:async()=>{
   calls++;
   return calls===1?{exitCode:0,timedOut:false}:result;
  },timeoutMs:1000});
  assert.equal(calls,2);
  assert.equal(r.verified,false);
  assert.equal(r.authorizedForRelease,false);
  assert.equal(r.reason,'eicar-not-detected');
 }
});
test('RC1972: invalid caller configuration is rejected without creating any scanner probe',async()=>{
 for(const arg of [{timeoutMs:0},{timeoutMs:999},{timeoutMs:180001},
  {timeoutMs:'1000'},{runner:null},{runner:1}]){
  const r=await verifyClamAvEngine(arg);
  assert.deepEqual(r,{verified:false,authorizedForRelease:false,reason:'invalid-self-test-configuration'});
 }
});
test('RC1972: self-test remains detached from ABD parser and cloud deployment',async()=>{
 const api=await fs.readFile('api/abd-analysis/index.js','utf8');
 const src=await fs.readFile('tools/rc1972-clamav/engine-selftest.cjs','utf8');
 assert.match(api,/scanResultFromTags/);
 assert.match(api,/scan\.status!=='clean'/);
 assert.doesNotMatch(api,/rc1972-clamav|verifyClamAvEngine/);
 assert.doesNotMatch(src,/BlobServiceClient|DefaultAzureCredential|uploadData\s*\(|setTags\s*\(|createContainer/);
 assert.match(src,/authorizedForRelease:false/);
});
