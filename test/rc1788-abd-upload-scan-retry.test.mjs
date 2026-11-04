import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const api=fs.readFileSync('api/abd-analysis/index.js','utf8');
const start=api.indexOf('function uploadId('),end=api.indexOf('async function readBuffer(',start);
const uploadStart=api.indexOf('async function upload('),uploadEnd=api.indexOf('function reanalyze(',uploadStart);
assert.ok(start>=0&&end>start&&uploadStart>=0&&uploadEnd>uploadStart,'ABD upload implementation not found');

function harness({conflict=false}={}){
 const names=[],written=[];
 const buffer=Buffer.from('invoice for synthetic testing');
 const file={name:'invoice.csv',kind:'csv',buffer,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),mimeType:'text/csv',size:buffer.length};
 const store={
  getBlockBlobClient(name){
   names.push(name);
   return{async uploadData(bytes,options){
    written.push({name,bytes,options});
    if(conflict){const e=new Error('blob exists');e.statusCode=412;throw e}
   }}
  }
 };
 const context={
  Buffer,
  crypto,
  scope:()=> 'safe-owner',
  text:value=>String(value==null?'':value).trim(),
  genericFile:()=>file,
  quarantine:async()=>store,
  error:(code,message,status)=>Object.assign(new Error(message),{code,status})
 };
 vm.runInNewContext(api.slice(start,end)+'\n'+api.slice(uploadStart,uploadEnd)+'\nthis.testHooks={upload,parseUploadId,uploadId,blobName};',context);
 return{...context.testHooks,file,names,written};
}

test('RC1788: uploading the same content twice creates distinct Defender scan objects',async()=>{
 const h=harness();
 const a=await h.upload({}, {user:{id:'test'}},'testservice',{file:{}});
 const b=await h.upload({}, {user:{id:'test'}},'testservice',{file:{}});
 assert.equal(a.status,'scanning');
 assert.equal(b.status,'scanning');
 assert.notEqual(a.upload.id,b.upload.id);
 assert.notEqual(h.names[0],h.names[1]);
 assert.equal(h.written.length,2);
 for(let i=0;i<2;i++){
  assert.equal(h.written[i].options.conditions.ifNoneMatch,'*','A scan blob must never replace an existing quarantine object');
  assert.ok(h.written[i].name.startsWith('rc1294/testservice/safe-owner/'));
  assert.equal(h.parseUploadId(i===0?a.upload.id:b.upload.id).sha256,h.file.sha256);
  assert.equal(h.blobName('testservice',{},h.parseUploadId(i===0?a.upload.id:b.upload.id)),h.names[i]);
 }
});

test('RC1788: existing hash:kind upload IDs remain readable after deployment',()=>{
 const h=harness();
 const hash='a'.repeat(64);
 const old=h.parseUploadId(hash+':pdf');
 assert.equal(old.sha256,hash);
 assert.equal(old.kind,'pdf');
 assert.equal(old.nonce,'');
 assert.equal(h.blobName('production',{},old),'rc1294/production/safe-owner/'+hash+'.pdf');
 assert.equal(h.parseUploadId(hash+':pdf:'+('0'.repeat(32))).nonce,'0'.repeat(32));
 assert.equal(h.parseUploadId(hash+':pdf:../../x'),null,'Path traversal is never valid');
});

test('RC1788: conflict does not silently reuse an old quarantine blob or old Defender tags',async()=>{
 const h=harness({conflict:true});
 await assert.rejects(()=>h.upload({}, {},'production',{file:{}}),e=>e.code==='ABD_UPLOAD_CONFLICT'&&e.status===409);
 assert.equal(h.names.length,1);
 assert.equal(h.written.length,1);
});
