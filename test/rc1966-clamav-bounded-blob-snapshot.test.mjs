import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {deriveBlobName,createBoundedReadSnapshot}=
 require('../tools/rc1966-clamav/bounded-blob-snapshot.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const bytes=Buffer.from('RC1966 OFFLINE SYNTHETIC XLSX CONTENT');
const base={
 environment:'testservice',scopeHash:'a'.repeat(64),uploadSha256:hash(bytes),
 uploadNonce:'b'.repeat(32),blobEtag:'"0x8DC000001"',bytes:bytes.length
};
const name='rc1294/testservice/'+base.scopeHash+'/'+base.uploadSha256+'-'+base.uploadNonce+'.xlsx';
const expected={...base,blobKeyHash:hash(name)};
const locator={environment:'testservice',scopeHash:base.scopeHash,
 blobKeyHash:expected.blobKeyHash,jobId:'e'.repeat(32)};
function fixture(opts={}){
 let props=0,downs=0;
 const blob={
  getProperties:async o=>{
   props++;
   assert.deepEqual(o,{conditions:{ifMatch:base.blobEtag}});
   return{etag:base.blobEtag,blobType:'BlockBlob',contentLength:bytes.length,...opts.props};
  },
  download:async (offset,count,o)=>{
   downs++;
   assert.equal(offset,0);
   assert.equal(count,bytes.length);
   assert.deepEqual(o,{conditions:{ifMatch:base.blobEtag},maxRetryRequests:0});
   return{
    etag:base.blobEtag,contentLength:bytes.length,
    readableStreamBody:Readable.from([Buffer.from(bytes)]),...opts.response
   };
  }
 };
 return{
  container:{getBlobClient(n){assert.equal(n,name);return blob}},
  stats:()=>({props,downs})
 };
}

test('RC1966: fixed TESTSERVICE blob uses conditional ETag and exact byte range',async()=>{
 const f=fixture(),read=createBoundedReadSnapshot({container:f.container,expected,kind:'xlsx'});
 const r=await read(locator);
 assert.deepEqual(r.bytes,bytes);
 assert.equal(r.etag,base.blobEtag);
 assert.equal(deriveBlobName(expected,'xlsx'),name);
 assert.deepEqual(f.stats(),{props:1,downs:1});
});

test('RC1966: blob path forgery and other environments reject before SDK',async()=>{
 let called=false;
 const container={getBlobClient(){called=true;throw Error('should not happen')}};
 for(const p of [
  {...expected,environment:'production'},
  {...expected,blobKeyHash:'f'.repeat(64)},
  {...expected,uploadNonce:'../other'},
  {...expected,bytes:13*1024*1024}
 ]){
  assert.throws(()=>createBoundedReadSnapshot({container,expected:p,kind:'xlsx'}),
   /RC1966_BLOB_UNVERIFIED/);
 }
 assert.throws(()=>createBoundedReadSnapshot({container,expected,kind:'exe'}),
  /RC1966_BLOB_UNVERIFIED/);
 const read=createBoundedReadSnapshot({container,expected,kind:'xlsx'});
 await assert.rejects(read({...locator,environment:'production'}),/RC1966_BLOB_UNVERIFIED/);
 await assert.rejects(read({...locator,blobKeyHash:'f'.repeat(64)}),/RC1966_BLOB_UNVERIFIED/);
 assert.equal(called,false);
});

test('RC1966: wrong ETag, unsupported blob type and oversize stop before download',async()=>{
 for(const props of [
  {etag:'"changed"'},{blobType:'AppendBlob'},{contentLength:1000000}
 ]){
  const f=fixture({props});
  const read=createBoundedReadSnapshot({container:f.container,expected,kind:'xlsx'});
  await assert.rejects(read(locator),/RC1966_BLOB_UNVERIFIED/);
  assert.deepEqual(f.stats(),{props:1,downs:0});
 }
});

test('RC1966: altered stream metadata, bytes or excess stream length reject',async()=>{
 for(const response of [
  {etag:'"changed"'},{contentLength:123},
  {readableStreamBody:Readable.from([Buffer.from('malicious change')])},
  {readableStreamBody:Readable.from([Buffer.alloc(bytes.length+1)])},
  {readableStreamBody:Readable.from([Buffer.from('SHORT')])}
 ]){
  const f=fixture({response});
  const read=createBoundedReadSnapshot({container:f.container,expected,kind:'xlsx'});
  await assert.rejects(read(locator),/RC1966_BLOB_UNVERIFIED/);
 }
});

test('RC1966: SDK failures are sanitized without leaking account keys or paths',async()=>{
 const container={getBlobClient(){throw Error('FAKE_SECRET AccountKey=test blobName=secret')}};
 const read=createBoundedReadSnapshot({container,expected,kind:'xlsx'});
 await assert.rejects(read(locator),e=>e.message==='RC1966_BLOB_UNVERIFIED');
});

test('RC1966: helper never constructs Azure clients, writes tags or opens a parser',async()=>{
 const fs=await import('node:fs/promises');
 const src=await fs.readFile('tools/rc1966-clamav/bounded-blob-snapshot.cjs','utf8');
 const api=await fs.readFile('api/abd-analysis/index.js','utf8');
 assert.doesNotMatch(api,/rc1966-clamav|createBoundedReadSnapshot/);
 assert.match(api,/scanResultFromTags/);
 assert.match(api,/scan\.status!=='clean'/);
 assert.doesNotMatch(src,/BlobServiceClient|DefaultAzureCredential|setTags\s*\(|uploadData\s*\(|connectionString\(/);
});
