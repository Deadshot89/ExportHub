'use strict';

// RC1641: provider-neutral, OFFLINE-first safety contract for a future
// TESTSERVICE-only Cosmos NoSQL adapter. No Azure SDK, connection, secrets,
// cloud calls, migration trigger or deletion is implemented in this module.
// A future provider must enforce all conditional writes on the server.
const {isDeepStrictEqual}=require('node:util');
const {
  packTestserviceState,restoreTestserviceState,summarizeTestservicePack
}=require('./testservice-state-chunks');

const PARTITION='testservice';
const MANIFEST_ID='eh360-testservice-teamstate-manifest';

function fail(code){const e=new Error(code);e.code=code;e.status=409;throw e}
function validEtag(v){return typeof v==='string'&&v.length>0&&v.length<=256&&!/[\r\n]/.test(v)}
function storeContract(store){
 if(!store||store.environment!=='testservice'||store.partitionKey!==PARTITION||
    typeof store.readItem!=='function'||typeof store.createImmutableItem!=='function'||
    typeof store.compareAndSwapManifest!=='function')
  fail('TEST_COSMOS_STORE_SCOPE_INVALID');
}
function itemFields(item){
 if(!item||typeof item!=='object'||Array.isArray(item))return null;
 // Compare the immutable, content-addressed fields, not provider metadata
 // such as etags, timestamps, or read-model properties.
 return {id:item.id,pk:item.pk,environment:item.environment,format:item.format,
  bytes:item.bytes,sha256:item.sha256,payloadBase64:item.payloadBase64};
}
function immutableEquals(a,b){return isDeepStrictEqual(itemFields(a),itemFields(b))}
async function readItem(store,id){
 try{return await store.readItem(id,PARTITION)}
 catch(_){fail('TEST_COSMOS_READ_FAILED')}
}
async function stageChunk(store,chunk){
 const existing=await readItem(store,chunk.id);
 if(existing!==null&&existing!==undefined){
  if(!immutableEquals(existing,chunk))fail('TEST_COSMOS_CHUNK_COLLISION');
  return false;
 }
 try{
  // Mandatory provider-side create-only / If-None-Match "*".
  await store.createImmutableItem(chunk,{ifNoneMatch:'*'});
  return true;
 }catch(_){
  // A concurrent writer may have created this deterministic chunk ID.
  // A readback with exact comparison is the only safe acceptance path.
  const raced=await readItem(store,chunk.id);
  if(raced!==null&&raced!==undefined&&immutableEquals(raced,chunk))return false;
  fail('TEST_COSMOS_CHUNK_CREATE_FAILED');
 }
}
function manifestEqual(a,b){
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 // Trust only the known codec manifest fields.
 return isDeepStrictEqual({
  id:a.id,pk:a.pk,environment:a.environment,format:a.format,
  sha256:a.sha256,compressedSha256:a.compressedSha256,
  rawBytes:a.rawBytes,compressedBytes:a.compressedBytes,
  chunkCount:a.chunkCount,chunkIds:a.chunkIds
 },{
  id:b.id,pk:b.pk,environment:b.environment,format:b.format,
  sha256:b.sha256,compressedSha256:b.compressedSha256,
  rawBytes:b.rawBytes,compressedBytes:b.compressedBytes,
  chunkCount:b.chunkCount,chunkIds:b.chunkIds
 });
}
async function readAndRestore(store,manifest){
 const chunks=[];
 for(const id of manifest.chunkIds){
  const item=await readItem(store,id);
  if(!item)fail('TEST_COSMOS_CHUNK_MISSING');
  chunks.push(item);
 }
 try{return restoreTestserviceState({manifest,chunks},{environment:'testservice'})}
 catch(_){fail('TEST_COSMOS_READBACK_INVALID')}
}
async function readPublishedTestserviceState(store,{environment}={}){
 if(environment!=='testservice')fail('TEST_COSMOS_ENVIRONMENT_REQUIRED');
 storeContract(store);
 const manifest=await readItem(store,MANIFEST_ID);
 if(!manifest)fail('TEST_COSMOS_MANIFEST_MISSING');
 const state=await readAndRestore(store,manifest);
 return {state,manifestEtag:manifest.etag||null,summary:summarizeTestservicePack({manifest})};
}

// Compare-and-swap publication: the manifest is the ONLY mutable record.
// Stage immutable chunks -> read them all back -> verify SHA-256 + JSON ->
// atomically switch the manifest with a known server ETag (or create-only).
// No old records are deleted; orphan chunks remain safe if interrupted.
async function publishTestserviceState(store,state,options={}){
 if(options.environment!=='testservice')fail('TEST_COSMOS_ENVIRONMENT_REQUIRED');
 storeContract(store);
 if(!Object.prototype.hasOwnProperty.call(options,'expectedManifestEtag')||
    !(options.expectedManifestEtag===null||validEtag(options.expectedManifestEtag)))
  fail('TEST_COSMOS_EXPECTED_ETAG_REQUIRED');
 const expected=options.expectedManifestEtag;
 const bundle=packTestserviceState(state,{environment:'testservice'});
 const previous=await readItem(store,MANIFEST_ID);
 if(expected===null&&previous)fail('TEST_COSMOS_MANIFEST_ALREADY_EXISTS');
 if(expected!==null&&(!previous||previous.etag!==expected))
  fail('TEST_COSMOS_MANIFEST_ETAG_MISMATCH');
 // Repeating an already-committed write should not create another manifest
 // version (important with Azure soft-delete and immutable change feeds).
 if(previous&&manifestEqual(previous,bundle.manifest)){
  const reread=await readAndRestore(store,bundle.manifest);
  if(!isDeepStrictEqual(reread,state))fail('TEST_COSMOS_READBACK_INVALID');
  return {...summarizeTestservicePack(bundle),committed:false,
   verifiedReadback:true,cloudCostVerified:false};
 }
 let createdChunks=0;
 for(const chunk of bundle.chunks)
  if(await stageChunk(store,chunk))createdChunks++;
 const restored=await readAndRestore(store,bundle.manifest);
 if(!isDeepStrictEqual(restored,state))fail('TEST_COSMOS_READBACK_INVALID');
 try{
  await store.compareAndSwapManifest(bundle.manifest,
   expected===null?{ifNoneMatch:'*'}:{ifMatch:expected});
 }catch(_){fail('TEST_COSMOS_MANIFEST_COMMIT_FAILED')}
 const published=await readItem(store,MANIFEST_ID);
 if(!manifestEqual(published,bundle.manifest))fail('TEST_COSMOS_POSTCOMMIT_INVALID');
 if(!isDeepStrictEqual(await readAndRestore(store,published),state))
  fail('TEST_COSMOS_POSTCOMMIT_INVALID');
 return {...summarizeTestservicePack(bundle),committed:true,createdChunks,
  verifiedReadback:true,cloudCostVerified:false};
}
module.exports={publishTestserviceState,readPublishedTestserviceState,
 MANIFEST_ID,PARTITION};
