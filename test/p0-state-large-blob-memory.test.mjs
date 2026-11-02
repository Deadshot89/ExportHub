import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const {collectReadableBytes}=require('../api/shared/collect-readable-bytes.js');

test('P0 #1159: a single 65 MB Azure transport Buffer is consumed without copies', async()=>{
  const source=Buffer.from('{"state":{"shipments":[{"ref":"TEST01","data":"'+
    'x'.repeat(65*1024*1024)+'"}]},"users":[]}');
  const found=await collectReadableBytes(Readable.from([source]));
  assert.strictEqual(found,source,'single-Buffer input must remain identical, not be copied');
  const document=JSON.parse(found.toString('utf8'));
  assert.equal(document.state.shipments[0].ref,'TEST01');
  assert.equal(document.state.shipments[0].data.length,65*1024*1024);
});

test('P0 #1159: segmented Blob responses assemble byte-for-byte including Unicode',async()=>{
  const expected=Buffer.from('{"text":"Größe – 中国","n":17}','utf8');
  const chunks=[expected.subarray(0,8),expected.subarray(8,11),expected.subarray(11)];
  const actual=await collectReadableBytes(Readable.from(chunks));
  assert.deepEqual(actual,expected);
  assert.equal(JSON.parse(actual.toString('utf8')).n,17);
});

test('P0 #1159: empty streams, strings and Uint8Array chunks retain their meaning',async()=>{
  assert.equal((await collectReadableBytes(Readable.from([]))).length,0);
  const actual=await collectReadableBytes(Readable.from(['abc',Uint8Array.from([0,1,255])],{objectMode:true}));
  assert.deepEqual(actual,Buffer.from([97,98,99,0,1,255]));
});

test('P0 #1159: state reader consumes the collector and writes one Buffer without byteLength scan',()=>{
  const source=fs.readFileSync(new URL('../api/exporthub-state/index.js',import.meta.url),'utf8');
  assert.match(source,/const rawBuffer=await collectReadableBytes\(r\.readableStreamBody\)/);
  assert.match(source,/const raw=Buffer\.from\(JSON\.stringify\(value\)\),bytes=raw\.length/);
  assert.match(source,/blob\.upload\(raw,bytes,/);
  assert.match(source,/ifMatch:etag/);
  assert.match(source,/ifNoneMatch:'\*'/);
  assert.match(source,/operationId&&recentOperations\.some/);
  assert.match(source,/isStorageWriteConflict\(e\)/);
});
