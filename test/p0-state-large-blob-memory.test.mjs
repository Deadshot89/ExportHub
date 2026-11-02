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

test('P0 #1159: real uploadJson encodes Unicode once and keeps Azure ETag preconditions',async()=>{
  const source=fs.readFileSync(new URL('../api/exporthub-state/index.js',import.meta.url),'utf8');
  const start=source.indexOf('async function uploadJson(');
  const end=source.indexOf('function isStorageWriteConflict(',start);
  assert.ok(start>0&&end>start);
  const uploadJson=new Function('Buffer',source.slice(start,end)+'; return uploadJson;')(Buffer);
  const writes=[];
  const blob={upload:async(raw,bytes,options)=>{
    writes.push({raw,bytes,options});
    return{etag:'"new-etag"'};
  }};
  const data={schemaVersion:3,revision:7,updatedAt:'2026-11-02T15:00:00.000Z',
    clientVersion:'RC1458',state:{shipments:[{ref:'TEST01',note:'Größe – 日本語'}]}};
  const result=await uploadJson(blob,data,'"previous-etag"');
  assert.equal(writes.length,1,'one logical write');
  assert.ok(Buffer.isBuffer(writes[0].raw),'REST transport receives Buffer without another copy');
  assert.equal(writes[0].bytes,Buffer.byteLength(JSON.stringify(data),'utf8'));
  assert.deepEqual(JSON.parse(writes[0].raw.toString('utf8')),data);
  assert.equal(writes[0].options.conditions.ifMatch,'"previous-etag"');
  assert.equal(writes[0].options.metadata.revision,'7');
  assert.equal(result.etag,'"new-etag"');

  writes.length=0;
  await uploadJson(blob,data,null);
  assert.equal(writes[0].options.conditions.ifNoneMatch,'*');
});

test('P0 #1159: metadata fallback keeps conditional upload and fails closed on other errors',async()=>{
  const source=fs.readFileSync(new URL('../api/exporthub-state/index.js',import.meta.url),'utf8');
  const start=source.indexOf('async function uploadJson('),end=source.indexOf('function isStorageWriteConflict(',start);
  const uploadJson=new Function('Buffer',source.slice(start,end)+'; return uploadJson;')(Buffer);
  const calls=[];
  const blob={upload:async(raw,bytes,options)=>{
    calls.push({raw,bytes,options});
    if(calls.length===1){const error=new Error('InvalidMetadata');error.statusCode=400;throw error;}
    return{etag:'"ok"'};
  }};
  const saved=await uploadJson(blob,{schemaVersion:3,revision:1,state:{}},'"old"');
  assert.equal(saved.etag,'"ok"');
  assert.equal(calls.length,2);
  assert.strictEqual(calls[0].raw,calls[1].raw);
  assert.equal(calls[0].options.conditions.ifMatch,'"old"');
  assert.equal(calls[1].options.conditions.ifMatch,'"old"');
  const denied=Object.assign(new Error('Forbidden'),{statusCode:403});
  await assert.rejects(()=>uploadJson({upload:async()=>{throw denied;}},{state:{}},null),error=>error===denied);
});

import { RestBlobClient } from '../api/shared/blob-rest.js';

test('P0 #1159: large state upload opts out of a blind second 20-second REST PUT',async()=>{
  const source=fs.readFileSync(new URL('../api/exporthub-state/index.js',import.meta.url),'utf8');
  const begin=source.indexOf('async function uploadJson('),end=source.indexOf('function isStorageWriteConflict(',begin);
  const uploadJson=new Function('Buffer',source.slice(begin,end)+'; return uploadJson;')(Buffer);
  const args=[];
  const blob={upload:async(raw,bytes,opts)=>{args.push({bytes,opts,isBuffer:Buffer.isBuffer(raw)});return {etag:'"ok"'};}};
  await uploadJson(blob,{schemaVersion:3,revision:1,state:{big:'x'.repeat(16*1024*1024)}},'"etag-1"');
  assert.equal(args[0].opts.transportAttempts,1);
  assert.equal(args[0].opts.conditions.ifMatch,'"etag-1"');
  assert.equal(args[0].isBuffer,true);
  args.length=0;
  await uploadJson(blob,{schemaVersion:3,revision:2,state:{small:'abc'}},'"etag-2"');
  assert.equal(args[0].opts.transportAttempts,undefined,'small writes retain existing retry behavior');
});

test('P0 #1159: REST Blob PUT with transportAttempts=1 never sends a second ambiguous upload',async()=>{
  const originalFetch=globalThis.fetch;
  let count=0;
  globalThis.fetch=async()=>{count++;return{
    ok:false,status:503,headers:new Headers({'x-ms-error-code':'ServerBusy'}),
    text:async()=>'<Error><Code>ServerBusy</Code></Error>'
  };};
  try{
    const client=new RestBlobClient({sas:'sig=fake',endpoint:'https://example.invalid'},'container','state.json');
    await assert.rejects(client.upload(Buffer.from('abc'),3,{transportAttempts:1}),error=>error.statusCode===503);
    assert.equal(count,1);
  }finally{globalThis.fetch=originalFetch;}
});
