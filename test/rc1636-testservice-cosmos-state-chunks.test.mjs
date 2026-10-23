import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {
 FORMAT,CHUNK_BYTES,packTestserviceState,restoreTestserviceState,summarizeTestservicePack
}=require('../api/shared/testservice-state-chunks.js');
const options={environment:'testservice'};
const base=()=>({
 dataEnvironment:'testservice',schemaVersion:3,revision:71,
 state:{shipments:[{ref:'ABC012',recipient:'Düsseldorf – Köln 🚚',deliveryFiles:[
  {name:'Frachtbrief.pdf',storage:'blob',mimeType:'application/pdf'}
 ]}],users:[{id:'E2E-USER-1',rights:{shipment:{edit:true}}}],deliveryNotes:[]},
 updatedAt:'2026-10-23T08:00:00Z'
});
function clone(o){return structuredClone(o)}
function reject(fn,code){assert.throws(fn,e=>e?.code===code)}

test('RC1636: codec is TESTSERVICE-only and rejects missing TESTSERVICE state provenance',()=>{
 reject(()=>packTestserviceState(base()),'TEST_STATE_ENVIRONMENT_REQUIRED');
 reject(()=>packTestserviceState(base(),{environment:'production'}),'TEST_STATE_ENVIRONMENT_REQUIRED');
 reject(()=>packTestserviceState({...base(),dataEnvironment:'production'},options),'TEST_STATE_DOCUMENT_INVALID');
 reject(()=>packTestserviceState({...base(),dataEnvironment:undefined},options),'TEST_STATE_DOCUMENT_INVALID');
 reject(()=>packTestserviceState([],options),'TEST_STATE_DOCUMENT_INVALID');
 reject(()=>packTestserviceState(null,options),'TEST_STATE_DOCUMENT_INVALID');
});

test('RC1636: exact UTF-8 JSON roundtrip with unicode, nested documents, refs and all fields',()=>{
 const state=base(),packed=packTestserviceState(state,options);
 assert.equal(packed.manifest.format,FORMAT);
 assert.equal(packed.manifest.pk,'testservice');
 assert.equal(packed.manifest.environment,'testservice');
 assert.equal(packed.manifest.chunkCount,packed.chunks.length);
 assert.ok(packed.chunks.length>=1);
 for(const c of packed.chunks){
  assert.equal(c.pk,'testservice');
  assert.ok(c.bytes<=CHUNK_BYTES);
  assert.ok(Buffer.byteLength(JSON.stringify(c),'utf8')<1024*1024);
 }
 assert.deepEqual(restoreTestserviceState(packed,options),state);
 assert.deepEqual(restoreTestserviceState(packed,{environment:'testservice'}),state);
 reject(()=>restoreTestserviceState(packed,{environment:'production'}),'TEST_STATE_ENVIRONMENT_REQUIRED');
 const summary=summarizeTestservicePack(packed);
 assert.equal(summary.noCloudWrites,true);
 assert.equal(summary.cosmosFreeTierVerified,false);
 assert.equal(summary.rawBytes,Buffer.byteLength(JSON.stringify(state)));
 assert.equal(JSON.stringify(summary).includes('Frachtbrief'),false);
 assert.equal(JSON.stringify(summary).includes('ABC012'),false);
});

test('RC1636: 1 MiB-plus incompressible test payload is split into deterministic immutable chunks',()=>{
 const big=crypto.randomBytes(1200*1024).toString('base64');
 const state={...base(),state:{payload:big}};
 const pack=packTestserviceState(state,options),second=packTestserviceState(state,options);
 assert.ok(pack.chunks.length>=3,'Payload should span several safe documents');
 assert.deepEqual(pack,second);
 assert.deepEqual(restoreTestserviceState({manifest:pack.manifest,chunks:pack.chunks.slice().reverse()},options),state);
 assert.ok(pack.chunks.every(c=>Buffer.byteLength(JSON.stringify(c))<1024*1024));
});

test('RC1636: any lost, duplicated, re-ordered by id, changed, or added chunk is rejected',()=>{
 const state={...base(),state:{payload:crypto.randomBytes(550*1024).toString('base64')}};
 const pack=packTestserviceState(state,options);
 assert.ok(pack.chunks.length>1);
 reject(()=>restoreTestserviceState({...pack,chunks:pack.chunks.slice(1)},options),'TEST_STATE_CHUNK_COUNT_MISMATCH');
 const duplicate=clone(pack);duplicate.chunks[1]=clone(duplicate.chunks[0]);
 reject(()=>restoreTestserviceState(duplicate,options),'TEST_STATE_CHUNK_INVALID');
 const modified=clone(pack);modified.chunks[0].payloadBase64='AA==';
 reject(()=>restoreTestserviceState(modified,options),'TEST_STATE_CHUNK_HASH_MISMATCH');
 const forged=clone(pack);forged.chunks[0].sha256='0'.repeat(64);
 reject(()=>restoreTestserviceState(forged,options),'TEST_STATE_CHUNK_HASH_MISMATCH');
 const extra=clone(pack);extra.chunks.push({id:'other',pk:'production'});
 reject(()=>restoreTestserviceState(extra,options),'TEST_STATE_CHUNK_COUNT_MISMATCH');
 const prod=clone(pack);prod.chunks[0].environment='production';
 reject(()=>restoreTestserviceState(prod,options),'TEST_STATE_CHUNK_INVALID');
 const other=clone(pack);other.manifest.chunkIds[0]='eh360-ts-v1-'+('0'.repeat(32))+'-000000';
 reject(()=>restoreTestserviceState(other,options),'TEST_STATE_CHUNK_INVALID');
 const corrupt=clone(pack);corrupt.manifest.compressedSha256='a'.repeat(64);
 reject(()=>restoreTestserviceState(corrupt,options),'TEST_STATE_COMPRESSED_HASH_MISMATCH');
 const invalid=clone(pack);invalid.manifest.rawBytes++;
 reject(()=>restoreTestserviceState(invalid,options),'TEST_STATE_STATE_HASH_MISMATCH');
});

test('RC1636: no Azure SDK, endpoints, filesystem writes, secret names or logs in transport implementation',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync('api/shared/testservice-state-chunks.js','utf8');
 assert.doesNotMatch(source,/@azure\/|console\.|process\.env|fetch\(|https?:\/\/|\.upload\(|\.delete\(|new CosmosClient/);
 assert.match(source,/maxOutputLength:MAX_RAW_BYTES\+1/);
 assert.match(source,/state\.dataEnvironment!=='testservice'/);
});
