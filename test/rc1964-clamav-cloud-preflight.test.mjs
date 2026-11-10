import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {FREE_GRANTS,JOB_SHAPE,estimateConsumption,createQueueCandidate,verifyQueueCandidate}=
 require('../tools/rc1964-clamav/cloud-job-preflight.cjs');
const NOW=Date.UTC(2026,10,10,13,0,0);
const key=Buffer.alloc(32,11);
const context={environment:'testservice',scopeHash:'a'.repeat(64),
 blobKeyHash:'b'.repeat(64),uploadSha256:'c'.repeat(64),
 uploadNonce:'d'.repeat(32),blobEtag:'"0x8DC000001"',bytes:4096};
const candidate=()=>createQueueCandidate({context,secret:key,now:NOW});
const verify=(envelope,expected=context,secret=key,now=NOW)=>
 verifyQueueCandidate({envelope,expected,secret,now});

test('RC1964: fixed 2 CPU / 4 GiB Consumption Job estimate never authorizes deployment',()=>{
 const preview=estimateConsumption({plannedJobs:100,secondsPerJob:240});
 assert.deepEqual(preview.projected,{vcpuSeconds:48000,giBSeconds:96000});
 assert.equal(preview.status,'subscription-usage-unknown');
 assert.equal(preview.computeFitsPublishedFreeGrant,null);
 assert.equal(preview.deployAuthorized,false);
 assert.equal(preview.releaseAuthorized,false);
 assert.equal(preview.costGuaranteedZero,false);
 assert.equal(JOB_SHAPE.maxParallel,1);
 assert.equal(JOB_SHAPE.maxRetries,0);
 assert.deepEqual(FREE_GRANTS,{vcpuSeconds:180000,giBSeconds:360000});
});

test('RC1964: even free compute allowance cannot prove zero total cost or authorize deployment',()=>{
 const preview=estimateConsumption({plannedJobs:100,secondsPerJob:240,
  otherVcpuSeconds:0,otherGiBSeconds:0});
 assert.equal(preview.computeFitsPublishedFreeGrant,true);
 assert.equal(preview.costGuaranteedZero,false);
 assert.equal(preview.otherResourceChargesUnknown,true);
 assert.equal(preview.deployAuthorized,false);
});

test('RC1964: exhausted shared grants, invalid input, or unknown usage cannot pass',()=>{
 const exhausted=estimateConsumption({plannedJobs:5,secondsPerJob:100,
  otherVcpuSeconds:FREE_GRANTS.vcpuSeconds-100,
  otherGiBSeconds:FREE_GRANTS.giBSeconds-100});
 assert.equal(exhausted.computeFitsPublishedFreeGrant,false);
 assert.equal(exhausted.deployAuthorized,false);
 for(const input of [{plannedJobs:-1,secondsPerJob:60},
  {plannedJobs:1,secondsPerJob:241},
  {plannedJobs:10001,secondsPerJob:1},
  {plannedJobs:1,secondsPerJob:60,otherVcpuSeconds:-1,otherGiBSeconds:0},
  {plannedJobs:1,secondsPerJob:1.5}]){
  const out=estimateConsumption(input);
  assert.equal(out.status,'invalid-input');
  assert.equal(out.deployAuthorized,false);
 }
});

test('RC1964: opaque signed TESTSERVICE queue candidate contains no URL or customer filename',()=>{
 const q=candidate();
 assert.equal(q.payload.purpose,'abd-quarantine-scan');
 assert.match(q.payload.jobId,/^[a-f0-9]{32}$/);
 assert.equal(q.dispatchAuthorized,false);
 assert.equal(q.releaseAuthorized,false);
 assert.deepEqual(verify(q),{valid:true,dispatchAuthorized:false,releaseAuthorized:false});
 assert.doesNotMatch(JSON.stringify(q),/https?:|\.xlsx|AccountKey|signature=|\.blob\./);
});

test('RC1964: every changed queue field, MAC, and unknown field is rejected',()=>{
 const q=candidate();
 for(const mutate of [
  p=>p.payload.scopeHash='e'.repeat(64),
  p=>p.payload.uploadSha256='f'.repeat(64),
  p=>p.payload.uploadNonce='0'.repeat(32),
  p=>p.payload.blobEtag='"0x8DC000002"',
  p=>p.payload.environment='production',
  p=>p.payload.bytes=90000,
  p=>p.payload.jobId='bad',
  p=>p.payload.url='https://evil.example',
  p=>p.mac='9'.repeat(64),
  p=>p.releaseAuthorized=true,
  p=>p.dispatchAuthorized=true
 ]){
  const tampered=structuredClone(q);mutate(tampered);
  const r=verify(tampered);
  assert.equal(r.valid,false);
  assert.equal(r.dispatchAuthorized,false);
  assert.equal(r.releaseAuthorized,false);
 }
 assert.equal(verify(q,context,Buffer.alloc(32,22)).valid,false);
});

test('RC1964: different blob/tenant/nonce/ETag/version/size is never accepted',()=>{
 const q=candidate();
 for(const changed of [{scopeHash:'0'.repeat(64)},{blobKeyHash:'0'.repeat(64)},
  {uploadSha256:'0'.repeat(64)},{uploadNonce:'0'.repeat(32)},
  {blobEtag:'"0x8DC000002"'},{bytes:1},{environment:'production'}]){
  assert.deepEqual(verify(q,{...context,...changed}),
   {valid:false,dispatchAuthorized:false,releaseAuthorized:false,reason:'blob-context-mismatch'});
 }
});

test('RC1964: expired queue candidates and malformed keys fail closed',()=>{
 const q=candidate();
 assert.equal(verify(q,context,key,NOW+5*60*1000+1).valid,false);
 assert.equal(verify(q,context,Buffer.from('short')).valid,false);
 assert.throws(()=>createQueueCandidate({context,secret:Buffer.from('short'),now:NOW}),
  /NOT_ATTESTABLE/);
 assert.throws(()=>createQueueCandidate({context:{...context,environment:'production'},secret:key,now:NOW}),
  /NOT_ATTESTABLE/);
 assert.throws(()=>createQueueCandidate({context:{...context,blobEtag:'https://evil'},secret:key,now:NOW}),
  /NOT_ATTESTABLE/);
});

test('RC1964: no runtime integration, Azure SDK, parser bypass or provisioning',async()=>{
 const fs=await import('node:fs/promises');
 const api=await fs.readFile('api/abd-analysis/index.js','utf8');
 const src=await fs.readFile('tools/rc1964-clamav/cloud-job-preflight.cjs','utf8');
 assert.doesNotMatch(api,/rc1964-clamav|verifyQueueCandidate|createQueueCandidate/);
 assert.match(api,/scanResultFromTags/);
 assert.match(api,/scan\.status!=='clean'/);
 assert.doesNotMatch(src,/BlobServiceClient|AzureWebJobsStorage|setTags\s*\(|uploadData\s*\(|createContainer|createResource/);
 assert.match(src,/deployAuthorized:false/);
 assert.match(src,/dispatchAuthorized:false/);
});
