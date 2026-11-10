import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {createQueueCandidate}=require('../tools/rc1964-clamav/cloud-job-preflight.cjs');
const {createBoundedReadSnapshot}=require('../tools/rc1966-clamav/bounded-blob-snapshot.cjs');
const {scanOfflineCandidate}=require('../tools/rc1965-clamav/isolated-scan-core.cjs');
const {verifyCandidateAttestation}=require('../tools/rc1963-clamav/scan-candidate-attestation.cjs');

const NOW=Date.UTC(2026,10,10,17,0,0);
const bytes=Buffer.from('RC1970 SYNTHETIC TESTSERVICE XLSX BYTES -- NO CUSTOMER DOCUMENT');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const queueKey=Buffer.alloc(32,0x71);
const proofKey=Buffer.alloc(32,0x72);
const scopeHash='a'.repeat(64),uploadNonce='b'.repeat(32);
const originalSha=sha(bytes);
const name='rc1294/testservice/'+scopeHash+'/'+originalSha+'-'+uploadNonce+'.xlsx';
const expected={
 environment:'testservice',scopeHash,blobKeyHash:sha(name),
 uploadSha256:originalSha,uploadNonce,blobEtag:'"0x8DC000ABCD"',
 bytes:bytes.length
};

function simulatedWork({
 mutateProps,mutateDownload,claimJob,runner,definitions
}={}){
 let gets=0,properties=0,downloads=0,scans=0;
 const container={
  getBlobClient(blobName){
   gets++;
   assert.equal(blobName,name);
   return{
    async getProperties(options){
     properties++;
     assert.equal(options.conditions.ifMatch,expected.blobEtag);
     assert.equal(options.abortSignal instanceof AbortSignal,true);
     return {etag:expected.blobEtag,blobType:'BlockBlob',
      contentLength:bytes.length,...(mutateProps?.(properties)||{})};
    },
    async download(offset,length,options){
     downloads++;
     assert.equal(offset,0);
     assert.equal(length,bytes.length);
     assert.deepEqual(options.conditions,{ifMatch:expected.blobEtag});
     assert.equal(options.maxRetryRequests,0);
     assert.equal(options.abortSignal instanceof AbortSignal,true);
     return {etag:expected.blobEtag,contentLength:bytes.length,
      readableStreamBody:Readable.from([Buffer.from(bytes)]),
      ...(mutateDownload?.(downloads)||{})};
    }
   };
  }
 };
 const jobs=new Set();
 const signing=createQueueCandidate({context:expected,secret:queueKey,now:NOW});
 const settings={
  envelope:signing,expected,queueSecret:queueKey,proofSecret:proofKey,
  claimJob:claimJob|| (async({jobId,environment})=>{
   assert.equal(environment,'testservice');
   if(jobs.has(jobId))return false;
   jobs.add(jobId);
   return true;
  }),
  readSnapshot:createBoundedReadSnapshot({container,expected,kind:'xlsx',timeoutMs:200}),
  getDefinitionsUpdatedAt:definitions|| (async()=>NOW-60*1000),
  engineCheck:async()=>({verified:true,authorizedForRelease:false}),
  runner:async(...args)=>{
   scans++;
   return (runner|| (async()=>({exitCode:0,timedOut:false})))(...args);
  },
  now:NOW
 };
 return {settings,signing,stats:()=>({gets,properties,downloads,scans})};
}

test('RC1970: queue -> ETag+range-bound snapshot -> ClamAV candidate -> HMAC proof is coherent, but NEVER releases',async()=>{
 const mock=simulatedWork();
 const result=await scanOfflineCandidate(mock.settings);
 assert.equal(result.status,'candidate-only');
 assert.equal(result.authorizedForRelease,false);
 assert.equal(result.dispatchAuthorized,false);
 assert.equal(result.deployAuthorized,false);
 assert.equal(result.receipt.authorizedForRelease,false);
 assert.deepEqual(mock.stats(),{gets:2,properties:2,downloads:2,scans:1});
 const proof=verifyCandidateAttestation({
  attestation:result.receipt,expected,secret:proofKey,now:NOW
 });
 assert.deepEqual(proof,{valid:true,authorizedForRelease:false,verdict:'candidate-clean'});
 assert.doesNotMatch(JSON.stringify(result),/AccountKey|\.xlsx|rc1294|TESTSERVICE XLSX|ConnectionString|https?:/);
});

test('RC1970: signed queue replay is stopped before a second blob download or scan',async()=>{
 const mock=simulatedWork();
 const first=await scanOfflineCandidate(mock.settings);
 assert.equal(first.status,'candidate-only');
 const before=mock.stats();
 const replay=await scanOfflineCandidate(mock.settings);
 assert.equal(replay.status,'blocked');
 assert.equal(replay.reason,'job-already-claimed');
 assert.deepEqual(mock.stats(),before);
});

test('RC1970: a different scope, nonce, or blob hash blocks before Azure snapshot reads',async()=>{
 for(const variant of [
  {scopeHash:'f'.repeat(64)},
  {uploadNonce:'f'.repeat(32)},
  {blobKeyHash:'f'.repeat(64)}
 ]){
  const mock=simulatedWork();
  const result=await scanOfflineCandidate({
   ...mock.settings,expected:{...expected,...variant}
  });
  assert.equal(result.status,'blocked');
  assert.equal(result.reason,'invalid-queue-proof');
  assert.deepEqual(mock.stats(),{gets:0,properties:0,downloads:0,scans:0});
 }
});

test('RC1970: changed Blob ETag or size before scan rejects without running ClamAV',async()=>{
 for(const mutateProps of [
  ()=>({etag:'"0xWRONG"'}),
  ()=>({contentLength:bytes.length+1})
 ]){
  const mock=simulatedWork({mutateProps});
  const result=await scanOfflineCandidate(mock.settings);
  assert.equal(result.status,'blocked');
  assert.equal(result.authorizedForRelease,false);
  assert.equal(result.receipt,undefined);
  assert.equal(mock.stats().scans,0);
  assert.equal(mock.stats().downloads,0);
 }
});

test('RC1970: changed Blob ETag after scan invalidates positive candidate',async()=>{
 const mock=simulatedWork({
  mutateProps:i=>i===2?{etag:'"0xWRONG"'}:{}
 });
 const result=await scanOfflineCandidate(mock.settings);
 assert.equal(result.status,'blocked');
 assert.equal(result.authorizedForRelease,false);
 assert.equal(result.receipt,undefined);
 assert.equal(mock.stats().scans,1);
 assert.equal(mock.stats().downloads,1);
});

test('RC1970: malware, scanner crash and signature update never sign a clean proof',async()=>{
 for(const variant of [
  {runner:async()=>({exitCode:1,timedOut:false})},
  {runner:async()=>({exitCode:2,timedOut:false})},
  {runner:async()=>({exitCode:0,timedOut:true})},
  {definitions:(()=>{let n=0;return async()=>++n===1?NOW-1000:NOW-500})()}
 ]){
  const mock=simulatedWork(variant);
  const result=await scanOfflineCandidate(mock.settings);
  assert.equal(result.status,'blocked');
  assert.equal(result.receipt,undefined);
  assert.equal(result.authorizedForRelease,false);
 }
});

test('RC1970: no runtime wire-up, queue dispatch, tags or production parser bypass',async()=>{
 const api=await fs.readFile('api/abd-analysis/index.js','utf8');
 const worker=await fs.readFile('tools/rc1965-clamav/isolated-scan-core.cjs','utf8');
 const reader=await fs.readFile('tools/rc1966-clamav/bounded-blob-snapshot.cjs','utf8');
 assert.match(api,/scanResultFromTags/);
 assert.match(api,/scan\.status!=='clean'/);
 assert.doesNotMatch(api,/rc1965-clamav|rc1966-clamav|scanOfflineCandidate/);
 assert.doesNotMatch(worker,/BlobServiceClient|setTags\s*\(|createContainer/);
 assert.doesNotMatch(reader,/BlobServiceClient|DefaultAzureCredential|uploadData\s*\(/);
});
