import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const store=require('../api/shared/document-blob-store.js');
const bytes=Buffer.from('%PDF-1.4\nRC1665 VERIFIED\n%%EOF');
const hash=crypto.createHash('sha256').update(bytes).digest('hex');
const file=id=>({id,name:'ABD.pdf',mimeType:'application/pdf',data:'data:application/pdf;base64,'+bytes.toString('base64')});
function fakeBlob({status=409,code='BlobAlreadyExists',meta={sha256:hash,environment:'production'},length=bytes.length,lookupError=false,allowProperties=true}={}){
 const counts={attempt:0,properties:0};
 const blob={
  async uploadData(){
   counts.attempt++;
   throw Object.assign(new Error('Azure rejected conditional PUT'),{statusCode:status,code});
  }
 };
 if(allowProperties)blob.getProperties=async()=>{
   counts.properties++;
   if(lookupError)throw Object.assign(new Error('blob not readable'),{statusCode:404,code:'BlobNotFound'});
   return{metadata:meta,contentLength:length};
 };
 return{counts,container:{getBlockBlobClient(){return blob}}};
}
function one(f,container){
 return store.storeInlineDocument(file('ABD-1'),{environment:'production',container:f.container});
}

test('RC1665: a confirmed same-hash BlobAlreadyExists is safe to reuse',async()=>{
 const f=fakeBlob();
 const result=await one(f);
 assert.equal(result.storage,'blob');
 assert.equal(result.sha256,hash);
 assert.equal(result.size,bytes.length);
 assert.equal(f.counts.attempt,1);
 assert.equal(f.counts.properties,1);
});

test('RC1665: a same-hash ConditionNotMet (HTTP 412) is safe to reuse',async()=>{
 const f=fakeBlob({status:412,code:'ConditionNotMet'});
 const result=await one(f);
 assert.equal(result.sha256,hash);
 assert.equal(f.counts.properties,1);
});

for(const [label,status,code] of [
 ['Azure lease conflict',409,'LeaseAlreadyPresent'],
 ['Azure container being deleted',409,'ContainerBeingDeleted'],
 ['Azure unrelated precondition',412,'ConditionNotSatisfied']
]){
 test('RC1665: '+label+' must fail closed instead of inventing a saved ABD',async()=>{
  const f=fakeBlob({status,code});
  await assert.rejects(()=>one(f),e=>e.code===code);
  assert.equal(f.counts.attempt,1);
  assert.equal(f.counts.properties,0);
 });
}
for(const [label,options] of [
 ['different hash',{meta:{sha256:'f'.repeat(64),environment:'production'}}],
 ['different environment',{meta:{sha256:hash,environment:'testservice'}}],
 ['wrong stored length',{length:bytes.length-1}],
 ['missing blob metadata',{meta:{}}],
]){
 test('RC1665: '+label+' cannot masquerade as the uploaded original',async()=>{
  const f=fakeBlob(options);
  await assert.rejects(()=>one(f),e=>e.code==='DOCUMENT_BLOB_CONFLICT_UNVERIFIED');
  assert.equal(f.counts.properties,1);
 });
}

test('RC1665: a failed duplicate readback cannot approve a dangling ABD pointer',async()=>{
 const f=fakeBlob({lookupError:true});
 await assert.rejects(()=>one(f),e=>e.code==='BlobAlreadyExists');
 assert.equal(f.counts.properties,1);
});
test('RC1665: a client without getProperties never treats HTTP 409 as success',async()=>{
 const f=fakeBlob({allowProperties:false});
 await assert.rejects(()=>one(f),e=>e.code==='BlobAlreadyExists');
});
test('RC1665: sharedShipments ABD externalization does not complete on an unverified blob conflict',async()=>{
 const f=fakeBlob({meta:{sha256:'f'.repeat(64),environment:'production'}});
 const input={sharedShipments:[{ref:'8BAGGQ',abdFiles:[file('ABD-1')]}],savedShipments:[{ref:'9Z7L82',abdFiles:[]}]};
 await assert.rejects(()=>store.externalizeDocumentCollections(input,{environment:'production',container:f.container}),e=>e.code==='DOCUMENT_BLOB_CONFLICT_UNVERIFIED');
 assert.equal(input.sharedShipments[0].abdFiles[0].storage,undefined,'failed save must not change the original record');
 assert.equal(input.savedShipments[0].abdFiles.length,0,'other shipment remains unchanged');
});
