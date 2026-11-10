import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const nativeRequire=createRequire(import.meta.url);
const SOURCE=fs.readFileSync('api/shared/ref-doc-blob-store.js','utf8');
const avis=nativeRequire('../api/shared/customer-avis-reference-docs.js');
const REF='AB12CD';
const INVOICE='Rechnung_AB12CD_20261110-071411_SIDE250075003.pdf';

function fixture(){
 const blobs=new Map();
 const container={
  async createIfNotExists(){},
  async *listBlobsFlat({prefix}){
   for(const [name,b] of blobs){
    if(name.startsWith(prefix))yield {name,properties:{
      contentLength:b.bytes.length,contentType:b.contentType,createdOn:b.createdOn,lastModified:b.createdOn
    }};
   }
  },
  getBlockBlobClient(name){
   return {
    async uploadData(buffer,options={}){
     if(options.conditions?.ifNoneMatch==='*'&&blobs.has(name)){const e=new Error('AlreadyExists');e.statusCode=412;throw e}
     blobs.set(name,{bytes:Buffer.from(buffer),contentType:options.blobHTTPHeaders?.blobContentType||'application/octet-stream',createdOn:new Date()});
    },
    async downloadToBuffer(){
     if(!blobs.has(name)){const e=new Error('BlobNotFound');e.code='BlobNotFound';e.statusCode=404;throw e}
     return Buffer.from(blobs.get(name).bytes);
    }
   };
  }
 };
 const fakeRequire=id=>{
  if(id==='crypto')return crypto;
  if(id==='@azure/storage-blob')return {BlobServiceClient:{fromConnectionString:()=>({getContainerClient:()=>container})}};
  if(id==='./testservice-auth-isolation')return {isolationConfig:()=>({enabled:false})};
  if(id==='./av-blob-store')return {
    refValue:v=>{const r=String(v||'').toUpperCase();if(!/^[A-Z0-9]{6}$/.test(r))throw Error('Ungültige Sendungsreferenz');return r},
    connectionString:()=>'UseDevelopmentStorage=true'
  };
  throw new Error('Unexpected require '+id);
 };
 const module={exports:{}};
 vm.runInNewContext(SOURCE,{module,exports:module.exports,require:fakeRequire,Buffer,process:{env:{}},Date},{filename:'ref-doc-blob-store.js'});
 return {store:module.exports,blobs};
}

test('Roundtrip: Rechnung SIDE wird bytegleich gespeichert, gelesen, gelistet und archiviert',async()=>{
 const {store,blobs}=fixture(),bytes=Buffer.from('%PDF-1.7\nSIDE invoice sample\n');
 const saved=await store.save(REF,'production',INVOICE,bytes,'application/pdf');
 assert.match(saved.id,/^refdoc:[0-9a-f]{32}$/);
 assert.equal(saved.name,INVOICE);
 const listed=await store.list(REF,'production');
 assert.equal(listed.length,1);
 assert.equal(listed[0].name,INVOICE);
 const read=await store.read(REF,'production',saved.id);
 assert.equal(read.file.name,INVOICE);
 assert.equal(Buffer.compare(read.buffer,bytes),0);
 const removed=await store.softDelete(REF,'production',saved.id,'test-operator');
 assert.equal(removed.archiveRetained,true);
 assert.deepEqual((await store.list(REF,'production')).map(f=>f.id),[]);
 await assert.rejects(()=>store.read(REF,'production',saved.id),e=>e.code==='REFDOC_NOT_FOUND');
 assert.equal((await store.hiddenNames(REF,'production')).has(INVOICE.toLowerCase()),true);
 assert.equal(blobs.has(saved.blobName),true,'Actual original bytes stay archived');
 assert.ok([...blobs.keys()].some(name=>name.includes('refdoc-removed-v1/production/'+REF+'/')),'Deletion audit exists');
});

test('Protected POD/AV are never eligible, other REF and TESTSERVICE stay isolated',async()=>{
 const {store}=fixture();
 const original=await store.save(REF,'production','POD_Signed_Original.pdf',Buffer.from('signed'),'application/pdf');
 await assert.rejects(()=>store.softDelete(REF,'production',original.id,'operator'),e=>e.code==='REFDOC_DELETE_FORBIDDEN');
 const allowed=await store.save(REF,'testservice',INVOICE,Buffer.from('TESTSERVICE'),'application/pdf');
 await assert.rejects(()=>store.softDelete(REF,'production',allowed.id,'operator'),e=>e.code==='REFDOC_NOT_FOUND');
 assert.equal((await store.list(REF,'testservice')).length,1);
 const different=await store.save('ZXCV12','production','Rechnung_ZXCV12_20261110-071411_SIDE.pdf',Buffer.from('separate'),'application/pdf');
 await assert.rejects(()=>store.softDelete(REF,'production',different.id,'operator'),e=>e.code==='REFDOC_NOT_FOUND');
});

test('Customer AVIS hides archived Graph copy but shows a fresh Azure re-upload',async()=>{
 const {store}=fixture(),file=await store.save(REF,'production',INVOICE,Buffer.from('OLD'),'application/pdf');
 await store.softDelete(REF,'production',file.id,'operator');
 const graph={listFiles:async()=>[{id:'graph-old',name:INVOICE,size:3}]};
 let out=await avis.load(graph,REF,'production',null,store);
 assert.equal(out.length,0,'Archived Graph duplicate must not appear on customer AVIS');
 const newFile=await store.save(REF,'production',INVOICE,Buffer.from('NEW'),'application/pdf');
 out=await avis.load(graph,REF,'production',null,store);
 assert.equal(out.length,1,'New Azure upload must remain visible');
 assert.equal(out[0].refSource,'azure');
 assert.equal(out[0].refItemId,newFile.id);
});

test('SharePoint-only invoice can be removed without deleting its physical Graph copy',async()=>{
 const {store,blobs}=fixture();
 const copy={id:'graph-invoice-item-1',name:INVOICE};
 const removed=await store.hideSharePoint(REF,'production',copy,'operator');
 assert.equal(removed.deleted,true);
 assert.equal(removed.name,INVOICE);
 assert.equal((await store.hiddenNames(REF,'production')).has(INVOICE.toLowerCase()),true);
 assert.ok([...blobs.keys()].some(n=>n.startsWith('refdoc-removed-v1/production/'+REF+'/')));
 await assert.rejects(()=>store.hideSharePoint(REF,'production',{id:'graph-signed',name:'POD_Signed_Original.pdf'},'operator'),e=>e.code==='REFDOC_DELETE_FORBIDDEN');
 await assert.rejects(()=>store.hideSharePoint(REF,'production',{id:'graph-wrong-ref',name:'Rechnung_ZZ99YY_20261110-071411_SIDE.pdf'},'operator'),e=>e.code==='REFDOC_DELETE_FORBIDDEN');
});
