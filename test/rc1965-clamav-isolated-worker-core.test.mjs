import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {scanOfflineCandidate}=require('../tools/rc1965-clamav/isolated-scan-core.cjs');
const {createQueueCandidate}=require('../tools/rc1964-clamav/cloud-job-preflight.cjs');
const {verifyCandidateAttestation}=require('../tools/rc1963-clamav/scan-candidate-attestation.cjs');
const NOW=Date.UTC(2026,10,10,14,0,0);
const payload=Buffer.from('RC1965 SYNTHETIC XLSX BYTES FOR OFFLINE TEST');
const sha=crypto.createHash('sha256').update(payload).digest('hex');
const queueKey=Buffer.alloc(32,35);
const proofKey=Buffer.alloc(32,47);
const context={
 environment:'testservice',scopeHash:'a'.repeat(64),blobKeyHash:'b'.repeat(64),
 uploadSha256:sha,uploadNonce:'c'.repeat(32),blobEtag:'"0x8DC000001"',bytes:payload.length
};
const receipt=createQueueCandidate({context,secret:queueKey,now:NOW});
const safe=async()=>({exitCode:0,timedOut:false});
function fixture(overrides={}){
 let claims=0,reads=0,scans=0;
 const settings={
  envelope:receipt,expected:context,queueSecret:queueKey,proofSecret:proofKey,
  now:NOW,
  claimJob:async({jobId,environment})=>{
   claims++;
   assert.equal(jobId,receipt.payload.jobId);
   assert.equal(environment,'testservice');
   return true;
  },
  readSnapshot:async({environment,scopeHash,blobKeyHash})=>{
   reads++;
   assert.equal(environment,'testservice');
   assert.equal(scopeHash,context.scopeHash);
   assert.equal(blobKeyHash,context.blobKeyHash);
   return{bytes:Buffer.from(payload),etag:context.blobEtag};
  },
  getDefinitionsUpdatedAt:async()=>NOW-60*1000,
  runner:async(...args)=>{scans++;return safe(...args);}
 };
 return{
  settings:{...settings,...overrides},
  counters:()=>({claims,reads,scans})
 };
}
test('RC1965: valid queue + immutable bytes yield ONLY signed candidate, never parser release',async()=>{
 const f=fixture();
 const r=await scanOfflineCandidate(f.settings);
 assert.equal(r.status,'candidate-only');
 assert.equal(r.authorizedForRelease,false);
 assert.equal(r.dispatchAuthorized,false);
 assert.equal(r.deployAuthorized,false);
 assert.equal(r.receipt.authorizedForRelease,false);
 assert.deepEqual(f.counters(),{claims:1,reads:2,scans:1});
 assert.deepEqual(verifyCandidateAttestation({
  attestation:r.receipt,expected:context,secret:proofKey,now:NOW
 }),{valid:true,authorizedForRelease:false,verdict:'candidate-clean'});
 assert.doesNotMatch(JSON.stringify(r),/candidate.bin|exporthub-rc1965-|ConnectionString|AccountKey|https?:/);
});
test('RC1965: tampered queue and production environment stop BEFORE claim, reads and scan',async()=>{
 const wrong={...receipt,payload:{...receipt.payload,blobEtag:'"0x000000002"'}};
 for(const f of [fixture({envelope:wrong}),fixture({expected:{...context,environment:'production'}})]){
  const r=await scanOfflineCandidate(f.settings);
  assert.equal(r.status,'blocked');
  assert.equal(r.authorizedForRelease,false);
  assert.deepEqual(f.counters(),{claims:0,reads:0,scans:0});
 }
});
test('RC1965: missing atomic claim adapter or duplicate job blocks without reading private blobs',async()=>{
 const f=fixture({claimJob:async()=>false});
 const r=await scanOfflineCandidate(f.settings);
 assert.equal(r.reason,'job-already-claimed');
 assert.deepEqual(f.counters(),{claims:0,reads:0,scans:0});
 const missing=fixture({claimJob:null});
 assert.equal((await scanOfflineCandidate(missing.settings)).reason,'worker-adapter-unavailable');
 assert.deepEqual(missing.counters(),{claims:0,reads:0,scans:0});
});
test('RC1965: source byte mismatch, ETag mismatch and oversized file never start scanner',async()=>{
 const cases=[
  {bytes:Buffer.from('ALTERED!'),etag:context.blobEtag},
  {bytes:Buffer.from(payload),etag:'"0x8DC000002"'},
  {bytes:Buffer.alloc(12*1024*1024+1),etag:context.blobEtag}
 ];
 for(const snapshot of cases){
  let scanned=0;
  const f=fixture({
   readSnapshot:async()=>snapshot,
   runner:async()=>{scanned++;return safe();}
  });
  const r=await scanOfflineCandidate(f.settings);
  assert.equal(r.reason,'blob-context-mismatch');
  assert.equal(r.authorizedForRelease,false);
  assert.equal(scanned,0);
 }
});
test('RC1965: changed ETag or bytes AFTER scan makes candidate invalid',async()=>{
 for(const changed of [
  {bytes:Buffer.from(payload),etag:'"0x8DC000002"'},
  {bytes:Buffer.from('malicious replacement'),etag:context.blobEtag}
 ]){
  let calls=0;
  const f=fixture({
   readSnapshot:async()=>{
    calls++;return calls===1?{bytes:Buffer.from(payload),etag:context.blobEtag}:changed;
   }
  });
  const r=await scanOfflineCandidate(f.settings);
  assert.equal(r.reason,'blob-changed-after-scan');
  assert.equal(r.receipt,undefined);
  assert.equal(r.authorizedForRelease,false);
 }
});
test('RC1965: positive malware or scanner error can never create a signed clean receipt',async()=>{
 for(const scan of [
  {exitCode:1,timedOut:false},
  {exitCode:2,timedOut:false},
  {exitCode:0,timedOut:true},
  {exitCode:null,timedOut:true}
 ]){
  const f=fixture({runner:async()=>scan});
  const r=await scanOfflineCandidate(f.settings);
  assert.equal(r.status,'blocked');
  assert.equal(r.receipt,undefined);
  assert.equal(r.authorizedForRelease,false);
  assert.equal(r.reason,scan.exitCode===1?'malware-detected':'scan-unverified');
 }
});
test('RC1965: signatures changed during scan cannot be falsely attested as updated',async()=>{
 let reads=0,scannerRan=false;
 const f=fixture({
  getDefinitionsUpdatedAt:async()=>{
   reads++;
   if(reads===1)assert.equal(scannerRan,false,'record signature state before scanning');
   if(reads===2)assert.equal(scannerRan,true,'recheck signatures only after scanning');
   return reads===1?NOW-60000:NOW-1000;
  },
  runner:async()=>{scannerRan=true;return safe();}
 });
 const r=await scanOfflineCandidate(f.settings);
 assert.equal(reads,2);
 assert.equal(r.status,'blocked');
 assert.equal(r.reason,'definitions-changed-during-scan');
 assert.equal(r.receipt,undefined);
 assert.equal(r.authorizedForRelease,false);
 assert.equal(r.dispatchAuthorized,false);
 assert.equal(r.deployAuthorized,false);
 assert.deepEqual(f.counters(),{claims:1,reads:2,scans:0});
});

test('RC1965: signature metadata disappears after scanning, no candidate receipt',async()=>{
 let reads=0;
 const f=fixture({getDefinitionsUpdatedAt:async()=>{
  reads++;
  if(reads===2)throw Error('Untrusted metadata failure');
  return NOW-60000;
 }});
 const r=await scanOfflineCandidate(f.settings);
 assert.equal(reads,2);
 assert.equal(r.status,'blocked');
 assert.equal(r.reason,'worker-error');
 assert.equal(r.receipt,undefined);
 assert.equal(r.authorizedForRelease,false);
});

test('RC1965: stale or future AV definitions are never signed',async()=>{
 for(const updatedAt of [NOW-48*3600*1000,NOW+60*1000]){
  const f=fixture({getDefinitionsUpdatedAt:async()=>updatedAt});
  const r=await scanOfflineCandidate(f.settings);
  assert.equal(r.status,'blocked');
  assert.equal(r.receipt,undefined);
  assert.equal(r.reason,'worker-error');
 }
});
test('RC1965: denied invalid-key worker and read failures do not leak customer or secret data',async()=>{
 const f=fixture({queueSecret:Buffer.from('short')});
 const invalid=await scanOfflineCandidate(f.settings);
 assert.equal(invalid.reason,'invalid-queue-proof');
 assert.deepEqual(f.counters(),{claims:0,reads:0,scans:0});
 const g=fixture({readSnapshot:async()=>{throw Error('AccountKey=FAKE_TEST_SECRET PATH=/secret');}});
 const r=await scanOfflineCandidate(g.settings);
 assert.equal(r.reason,'worker-error');
 assert.doesNotMatch(JSON.stringify(r),/AccountKey|FAKE_TEST_SECRET|secret/);
});
test('RC1965: scanner must work on a second isolated immutable copy, never the worker stage',async()=>{
 let observedStage='';
 const f=fixture({runner:async(file)=>{
  observedStage=file;
  assert.match(file,/exporthub-rc1956-scan-/);
  assert.equal((await fs.readFile(file)).toString(),payload.toString());
  const stat=await fs.stat(file);
  assert.equal(stat.mode&0o077,0);
  return safe();
 }});
 const r=await scanOfflineCandidate(f.settings);
 assert.equal(r.status,'candidate-only');
 await assert.rejects(fs.access(observedStage));
});
test('RC1965: worker is inert to Azure, browser uploads, Defender tags and production parser',async()=>{
 const api=await fs.readFile('api/abd-analysis/index.js','utf8');
 const src=await fs.readFile('tools/rc1965-clamav/isolated-scan-core.cjs','utf8');
 assert.doesNotMatch(api,/rc1965-clamav|scanOfflineCandidate/);
 assert.match(api,/scanResultFromTags/);
 assert.match(api,/scan\.status!=='clean'/);
 assert.doesNotMatch(src,/BlobServiceClient|DefaultAzureCredential|setTags\s*\(|uploadData\s*\(|createContainer/);
 assert.match(src,/authorizedForRelease:false/);
});

test('RC1965: a duplicate signed job cannot re-read files when the claim store atomically rejects replay',async()=>{
 const claimed=new Set();
 let reads=0;
 const f=fixture({
  claimJob:async({jobId})=>{
   if(claimed.has(jobId))return false;
   claimed.add(jobId);
   return true;
  },
  readSnapshot:async()=>{
   reads++;
   return{bytes:Buffer.from(payload),etag:context.blobEtag};
  }
 });
 const first=await scanOfflineCandidate(f.settings);
 const second=await scanOfflineCandidate(f.settings);
 assert.equal(first.status,'candidate-only');
 assert.equal(first.authorizedForRelease,false);
 assert.equal(second.status,'blocked');
 assert.equal(second.reason,'job-already-claimed');
 assert.equal(reads,2,'second attempt must not read any customer data');
 assert.equal(second.receipt,undefined);
});
