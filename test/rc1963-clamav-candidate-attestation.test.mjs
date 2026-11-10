import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {createCandidateAttestation,verifyCandidateAttestation,MAX_AGE_MS}=
 require('../tools/rc1963-clamav/scan-candidate-attestation.cjs');

const NOW=Date.UTC(2026,10,10,11,0,0);
const key=Buffer.alloc(32,17);
const hash='a'.repeat(64),scope='b'.repeat(64),blob='c'.repeat(64),nonce='d'.repeat(32);
const candidate={verdict:'candidate-clean',authorizedForRelease:false,sha256:hash,bytes:2048};
const context={environment:'testservice',scopeHash:scope,blobKeyHash:blob,
 uploadSha256:hash,uploadNonce:nonce,blobEtag:'"0x8DC000000001"',bytes:2048};
const expectContext={...context};
const options=()=>({candidate:{...candidate},context:{...context},
 secret:Buffer.from(key),definitionsUpdatedAt:NOW-3600000,now:NOW});
const check=(receipt,expected=expectContext,secret=key,now=NOW)=>
 verifyCandidateAttestation({attestation:receipt,expected,secret,now});

test('RC1963: scoped TESTSERVICE candidate has valid HMAC but NEVER authorizes parsing',()=>{
 const receipt=createCandidateAttestation(options());
 assert.equal(receipt.authorizedForRelease,false);
 assert.equal(receipt.payload.environment,'testservice');
 assert.deepEqual(check(receipt),{valid:true,authorizedForRelease:false,verdict:'candidate-clean'});
 assert.doesNotMatch(JSON.stringify(receipt),/ConnectionString|AccountKey|http:|https:|\.xlsx/);
});

test('RC1963: any mutated receipt, MAC or unknown field fails closed',()=>{
 const receipt=createCandidateAttestation(options());
 for(const patch of [
  r=>r.payload.uploadSha256='e'.repeat(64),
  r=>r.payload.bytes=2049,
  r=>r.payload.blobEtag='"0x8DC000000002"',
  r=>r.payload.environment='production',
  r=>r.payload.verdict='clean',
  r=>r.payload.engine='unknown',
  r=>r.payload.unknownField='ignored?',
  r=>r.mac='f'.repeat(64),
  r=>r.authorizedForRelease=true
 ]){
  const copy=structuredClone(receipt);
  patch(copy);
  assert.equal(check(copy).valid,false);
  assert.equal(check(copy).authorizedForRelease,false);
 }
 assert.equal(check(receipt,expectContext,Buffer.alloc(32,27)).valid,false);
});

test('RC1963: cross-ref, tenant scope, nonce, ETag, hash and size do not replay',()=>{
 const receipt=createCandidateAttestation(options());
 for(const change of [
  {scopeHash:'e'.repeat(64)},
  {blobKeyHash:'f'.repeat(64)},
  {uploadNonce:'0'.repeat(32)},
  {blobEtag:'"0xF0000000002"'},
  {uploadSha256:'1'.repeat(64)},
  {bytes:2049},
  {environment:'production'}
 ]){
  assert.deepEqual(check(receipt,{...expectContext,...change}),
   {valid:false,authorizedForRelease:false,reason:'blob-context-mismatch'});
 }
});

test('RC1963: expired scans, future timestamps and stale signatures reject',()=>{
 const receipt=createCandidateAttestation(options());
 assert.equal(check(receipt,expectContext,key,NOW+MAX_AGE_MS+1).valid,false);
 assert.throws(()=>createCandidateAttestation({...options(),now:NOW,
  definitionsUpdatedAt:NOW-48*3600*1000}),/NOT_ATTESTABLE/);
 assert.throws(()=>createCandidateAttestation({...options(),now:NOW,
  definitionsUpdatedAt:NOW+1}),/NOT_ATTESTABLE/);
 const expired=structuredClone(receipt);expired.payload.expiresAt=NOW-1;
 assert.equal(check(expired).valid,false);
});

test('RC1963: untrusted client, missing key and invalid scan never create proof',()=>{
 const clean=options();
 for(const change of [
  {candidate:{...candidate,verdict:'infected'}},
  {candidate:{...candidate,authorizedForRelease:true}},
  {candidate:{...candidate,bytes:1}},
  {context:{...context,environment:'production'}},
  {context:{...context,blobEtag:''}},
  {context:{...context,uploadNonce:'short'}},
  {secret:Buffer.from('short')}
 ]){
  assert.throws(()=>createCandidateAttestation({...clean,...change}),/NOT_ATTESTABLE/);
 }
 const receipt=createCandidateAttestation(options());
 assert.equal(check(receipt,expectContext,Buffer.from('short')).valid,false);
 assert.equal(check({...receipt,payload:{...receipt.payload},mac:'not-hex'}).valid,false);
});

test('RC1963: candidate library is NOT wired into production analysis or existing Defender tags',async()=>{
 const api=await fs.readFile('api/abd-analysis/index.js','utf8');
 const helper=await fs.readFile('tools/rc1963-clamav/scan-candidate-attestation.cjs','utf8');
 assert.doesNotMatch(api,/rc1963-clamav|createCandidateAttestation|verifyCandidateAttestation/);
 assert.match(api,/scanResultFromTags/);
 assert.match(api,/scan\.status!=='clean'/);
 assert.doesNotMatch(helper,/setTags\s*\(|deleteIfExists\s*\(|uploadData\s*\(/);
 assert.match(helper,/authorizedForRelease:false/);
});
