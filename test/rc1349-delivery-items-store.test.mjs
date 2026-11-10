import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const parser=require('../api/shared/delivery-avis-items.js');
const source=fs.readFileSync('api/shared/delivery-avis-items-store.js','utf8');
const validText=[
 'Lieferschein', 'Kundenbestellnummer: PO-451234',
 'Kundenartikelnummer: C-1331 | Gelieferte Menge: 23 Stk'
].join('\n');

function harness(){
 const blobRecords=new Map(),documents=new Map(),scanStatuses=new Map();
 let etag=0,extractions=0;
 const az={
  BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return{
   async createIfNotExists(){},
   getBlockBlobClient(name){return{
    async download(){
     const saved=blobRecords.get(name);
     if(!saved)throw Object.assign(new Error('BlobNotFound'),{statusCode:404});
     return{etag:saved.etag,readableStreamBody:(async function*(){yield Buffer.from(saved.data)})()};
    },
    async uploadData(data,options){
     const existing=blobRecords.get(name),conditions=options.conditions||{};
     if(conditions.ifNoneMatch==='*'&&existing)throw Object.assign(new Error('ConditionNotMet'),{statusCode:412});
     if(conditions.ifMatch&&(!existing||conditions.ifMatch!==existing.etag))
      throw Object.assign(new Error('ConditionNotMet'),{statusCode:412});
     blobRecords.set(name,{data:Buffer.from(data),etag:'"v'+(++etag)+'"'});
    }
   }}
  }}}}},
 };
 const docs={
  async list(){return[...documents.values()].map(item=>item.file)},
  async read(_ref,_env,id){const found=documents.get(id);if(!found)throw Object.assign(new Error('NotFound'),{status:404});return{buffer:found.buffer,file:found.file}},
  async scanResult(_ref,_env,id){return{status:scanStatuses.get(id)||'pending'}},
 };
 const mockedRequire=id=>{
  if(id==='@azure/storage-blob')return az;
  if(id==='./delivery-avis-items')return parser;
  if(id==='./customer-avis-document-content')return{async extractPdfText(buffer){extractions++;return buffer.toString('utf8')}};
  if(id==='./ref-doc-blob-store')return docs;
  if(id==='./customer-avis-pdf-security')return{};
  throw new Error('Unexpected require '+id);
 };
 const module={exports:{}};
 vm.runInNewContext(source,{module,exports:module.exports,require:mockedRequire,process:{env:{EXPORTHUB_STORAGE_CONNECTION_STRING:'test-only'}},Buffer,Date},{timeout:2500});
 const store=module.exports;
 function add({ref='ABC123',id='a'.repeat(32),date='2026-11-10T10:00:00Z',text=validText,name='DNC3019228592.pdf',scan='clean'}={}){
  const file={id:'refdoc:'+id,name:'Lieferschein_'+ref+'_'+date.slice(0,10).replace(/-/g,'')+'-'+date.slice(11,19).replace(/:/g,'')+'_'+name,
   size:Buffer.byteLength(text),createdDateTime:date,mimeType:'application/pdf'};
  const buffer=Buffer.from(text,'utf8');
  documents.set(file.id,{file,buffer});scanStatuses.set(file.id,scan);
  return{file,hash:crypto.createHash('sha256').update(buffer).digest('hex')};
 }
 return{store,add,scanStatuses,documents,get extractions(){return extractions}};
}

test('RC1349 metadata: bei ausstehendem Defender-Scan darf keine PDF-Textextraktion stattfinden',async()=>{
 const h=harness(),source=h.add({scan:'pending'});
 await h.store.register('ABC123','testservice',source.file,source.hash);
 const docs=await h.store.processPending('ABC123','testservice');
 assert.equal(h.extractions,0);
 assert.equal(docs[0].status,'scan_pending');
 assert.deepEqual(JSON.parse(JSON.stringify(await h.store.publicRows('ABC123','testservice'))),[]);
 await assert.rejects(()=>h.store.approve('ABC123','testservice',source.file.id,source.hash,
  [{customerOrderNumber:'PO-451234',customerItemNumber:'C-1331',deliveredQuantity:'23',quantityUnit:'Stk'}],'Reviewer'),
 /nicht als schadsoftwarefrei/);
});

test('RC1349 metadata: Freigabe ist sendungs- und umgebungsspezifisch',async()=>{
 const h=harness(),source=h.add();
 await h.store.register('ABC123','testservice',source.file,source.hash);
 const docs=await h.store.processPending('ABC123','testservice');
 assert.equal(docs[0].status,'review_required');
 assert.equal(docs[0].scanStatus,'clean');
 const reviewed=parser.safeReviewRows(docs[0].rows);
 await h.store.approve('ABC123','testservice',source.file.id,source.hash,reviewed,'Reviewer');
 assert.deepEqual(JSON.parse(JSON.stringify(await h.store.publicRows('ABC123','testservice'))),reviewed);
 assert.deepEqual(JSON.parse(JSON.stringify(await h.store.publicRows('ABC123','production'))),[]);
 assert.deepEqual(JSON.parse(JSON.stringify(await h.store.publicRows('DEF456','testservice'))),[]);
});

test('RC1349 metadata: spät entdecktes Alt-PDF darf aktuelle Freigabe nicht ersetzen',async()=>{
 const h=harness();
 const newer=h.add({id:'b'.repeat(32),date:'2026-11-10T10:00:00Z'});
 const older=h.add({id:'c'.repeat(32),date:'2026-11-09T10:00:00Z',text:validText.replace('23 Stk','15 Stk')});
 await h.store.register('ABC123','testservice',newer.file,newer.hash);
 await h.store.processPending('ABC123','testservice');
 await h.store.approve('ABC123','testservice',newer.file.id,newer.hash,
  [{customerOrderNumber:'PO-451234',customerItemNumber:'C-1331',deliveredQuantity:'23',quantityUnit:'Stk'}],'Reviewer');
 await h.store.discover('ABC123','testservice');
 const snapshot=await h.store.load('ABC123','testservice');
 const records=JSON.parse(JSON.stringify(snapshot.state.documents));
 assert.equal(records.length,1);
 assert.equal(records[0].id,newer.file.id);
 assert.equal(records[0].status,'approved');
 assert.equal((await h.store.publicRows('ABC123','testservice'))[0].deliveredQuantity,'23');
 assert.ok(older);
});

test('RC1349 metadata: Ersatz eines Lieferscheins widerruft die vorherige Kundenfreigabe',async()=>{
 const h=harness(),original=h.add({id:'d'.repeat(32),date:'2026-11-09T10:00:00Z'});
 await h.store.register('ABC123','testservice',original.file,original.hash);
 await h.store.processPending('ABC123','testservice');
 await h.store.approve('ABC123','testservice',original.file.id,original.hash,
  [{customerOrderNumber:'PO-451234',customerItemNumber:'C-1331',deliveredQuantity:'23',quantityUnit:'Stk'}],'Reviewer');
 assert.equal((await h.store.publicRows('ABC123','testservice')).length,1);
 const updated=h.add({id:'e'.repeat(32),date:'2026-11-10T10:00:00Z',text:validText.replace('23 Stk','25 Stk')});
 await h.store.register('ABC123','testservice',updated.file,updated.hash);
 assert.equal((await h.store.publicRows('ABC123','testservice')).length,0);
 const state=JSON.parse(JSON.stringify((await h.store.load('ABC123','testservice')).state.documents));
 assert.equal(state.filter(d=>d.current).length,1);
 assert.equal(state.find(d=>d.id===original.file.id).status,'superseded');
 await h.store.processPending('ABC123','testservice');
 await h.store.approve('ABC123','testservice',updated.file.id,updated.hash,
  [{customerOrderNumber:'PO-451234',customerItemNumber:'C-1331',deliveredQuantity:'25',quantityUnit:'Stk'}],'Reviewer');
 assert.equal((await h.store.publicRows('ABC123','testservice'))[0].deliveredQuantity,'25');
});
