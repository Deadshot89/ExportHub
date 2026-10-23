'use strict';

// RC1636: off-line, TESTSERVICE-only state transport codec for a future
// transactionally verified Cosmos DB Free-Tier adapter. NO Azure I/O here.
// This is NOT a database migration and is NOT encryption.
const crypto=require('node:crypto');
const zlib=require('node:zlib');

const FORMAT='eh360-testservice-gzip-chunks-v1';
const PARTITION='testservice';
const MAX_RAW_BYTES=128*1024*1024;
const CHUNK_BYTES=384*1024; // Base64 JSON is < 1 MiB, below Cosmos NoSQL's 2 MiB/item limit.
const MAX_CHUNKS=Math.ceil((MAX_RAW_BYTES+128*1024*1024)/CHUNK_BYTES);
function failure(code){const e=new Error(code);e.code=code;e.status=422;throw e}
function digest(value){return crypto.createHash('sha256').update(value).digest('hex')}
function assertTest(environment){if(environment!=='testservice')failure('TEST_STATE_ENVIRONMENT_REQUIRED')}
function isNonNegativeSafe(value){return Number.isSafeInteger(value)&&value>=0}
function object(value){return Boolean(value)&&typeof value==='object'&&!Array.isArray(value)}
function validHex(value){return typeof value==='string'&&/^[0-9a-f]{64}$/.test(value)}
function validateManifest(manifest){
 if(!object(manifest)||manifest.format!==FORMAT||manifest.environment!=='testservice'||
  manifest.pk!==PARTITION||manifest.id!=='eh360-testservice-teamstate-manifest'||
  !validHex(manifest.sha256)||!validHex(manifest.compressedSha256)||
  !isNonNegativeSafe(manifest.rawBytes)||manifest.rawBytes>MAX_RAW_BYTES||
  !isNonNegativeSafe(manifest.compressedBytes)||
  !Number.isSafeInteger(manifest.chunkCount)||manifest.chunkCount<1||
  manifest.chunkCount>MAX_CHUNKS||!Array.isArray(manifest.chunkIds)||
  manifest.chunkIds.length!==manifest.chunkCount||
  manifest.chunkIds.some(x=>typeof x!=='string'||!/^eh360-ts-v1-[0-9a-f]{32}-[0-9]{6}$/.test(x))||
  new Set(manifest.chunkIds).size!==manifest.chunkIds.length)failure('TEST_STATE_MANIFEST_INVALID');
}
function packTestserviceState(state,{environment}={}){
 assertTest(environment);
 if(!object(state))failure('TEST_STATE_DOCUMENT_INVALID');
 let raw;
 try{raw=Buffer.from(JSON.stringify(state),'utf8')}
 catch(_){failure('TEST_STATE_SERIALIZATION_FAILED')}
 if(raw.length>MAX_RAW_BYTES)failure('TEST_STATE_TOO_LARGE');
 const compressed=zlib.gzipSync(raw,{level:6});
 const hash=digest(raw),compressedSha256=digest(compressed),version=hash.slice(0,32);
 const chunks=[];
 for(let offset=0;offset<compressed.length;offset+=CHUNK_BYTES){
  const bytes=compressed.subarray(offset,Math.min(compressed.length,offset+CHUNK_BYTES));
  const id='eh360-ts-v1-'+version+'-'+String(chunks.length).padStart(6,'0');
  const item={id,pk:PARTITION,environment,format:FORMAT,bytes:bytes.length,
   sha256:digest(bytes),payloadBase64:bytes.toString('base64')};
  if(Buffer.byteLength(JSON.stringify(item),'utf8')>=1024*1024)failure('TEST_STATE_ITEM_TOO_LARGE');
  chunks.push(item);
 }
 if(chunks.length<1||chunks.length>MAX_CHUNKS)failure('TEST_STATE_TOO_MANY_CHUNKS');
 const manifest={id:'eh360-testservice-teamstate-manifest',pk:PARTITION,environment,
  format:FORMAT,sha256:hash,compressedSha256,rawBytes:raw.length,
  compressedBytes:compressed.length,chunkCount:chunks.length,
  chunkIds:chunks.map(x=>x.id)};
 if(Buffer.byteLength(JSON.stringify(manifest),'utf8')>=1024*1024)failure('TEST_STATE_MANIFEST_TOO_LARGE');
 return {manifest,chunks};
}
function restoreTestserviceState(bundle,{environment}={}){
 assertTest(environment);
 const manifest=bundle&&bundle.manifest;validateManifest(manifest);
 const chunks=bundle&&bundle.chunks;
 if(!Array.isArray(chunks)||chunks.length!==manifest.chunkCount)failure('TEST_STATE_CHUNK_COUNT_MISMATCH');
 const map=new Map();
 for(const item of chunks){
  if(!object(item)||item.environment!=='testservice'||item.pk!==PARTITION||
   item.format!==FORMAT||typeof item.id!=='string'||
   !manifest.chunkIds.includes(item.id)||map.has(item.id)||!validHex(item.sha256)||
   !isNonNegativeSafe(item.bytes)||item.bytes>CHUNK_BYTES||
   typeof item.payloadBase64!=='string'||
   !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.payloadBase64))
   failure('TEST_STATE_CHUNK_INVALID');
  const bytes=Buffer.from(item.payloadBase64,'base64');
  if(bytes.length!==item.bytes||digest(bytes)!==item.sha256||bytes.toString('base64')!==item.payloadBase64)
   failure('TEST_STATE_CHUNK_HASH_MISMATCH');
  map.set(item.id,bytes);
 }
 const compressed=Buffer.concat(manifest.chunkIds.map(id=>map.get(id)));
 if(compressed.length!==manifest.compressedBytes||digest(compressed)!==manifest.compressedSha256)
  failure('TEST_STATE_COMPRESSED_HASH_MISMATCH');
 let raw;
 try{raw=zlib.gunzipSync(compressed,{maxOutputLength:MAX_RAW_BYTES+1})}
 catch(_){failure('TEST_STATE_DECOMPRESSION_FAILED')}
 if(raw.length!==manifest.rawBytes||digest(raw)!==manifest.sha256)failure('TEST_STATE_STATE_HASH_MISMATCH');
 let parsed;
 try{parsed=JSON.parse(raw.toString('utf8'))}catch(_){failure('TEST_STATE_JSON_INVALID')}
 if(!object(parsed))failure('TEST_STATE_DOCUMENT_INVALID');
 return parsed;
}
function summarizeTestservicePack(bundle){
 const m=bundle&&bundle.manifest;
 validateManifest(m);
 return {environment:'testservice',chunkCount:m.chunkCount,rawBytes:m.rawBytes,
  compressedBytes:m.compressedBytes,compressionPercent:m.rawBytes?
   Math.round((1-m.compressedBytes/m.rawBytes)*100):0,
  noCloudWrites:true,cosmosFreeTierVerified:false};
}
module.exports={FORMAT,CHUNK_BYTES,MAX_RAW_BYTES,packTestserviceState,restoreTestserviceState,summarizeTestservicePack};
