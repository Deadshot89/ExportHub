import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const blobSource=fs.readFileSync('assets/rc1059-document-blob.js','utf8');

function collector(){
 const marker='const docHelpers=`';
 const at=build.indexOf(marker);
 assert.ok(at>=0,'active release document helper transform exists');
 const stop=build.indexOf('\n`;',at+marker.length);
 assert.ok(stop>at,'active release document helpers have a terminator');
 const source=vm.runInNewContext(build.slice(at+'const docHelpers='.length,stop+3));
 const window={location:{hostname:'exporthub360.com'}};
 vm.runInNewContext(blobSource,{window});
 const first={id:'SAME-LEGACY-ID',ref:'9WX5K6',lieferscheine:[{
   name:'SIDE_9WX5K6.pdf',storage:'blob',blobName:'rc1059/production/ab/'+'a'.repeat(64)
 }]};
 const other={id:'SAME-LEGACY-ID',ref:'OTHER1',lieferscheine:[{
   name:'NOT_THIS_SHIPMENT.pdf',storage:'blob',blobName:'rc1059/production/cd/'+'c'.repeat(64)
 }]};
 const state={shipments:[first,other]};
 const context={
   window,
   q:v=>String(v??'').trim(),
   low:v=>String(v??'').toLowerCase(),
   arr:v=>Array.isArray(v)?v:[],
   state:()=>state,
   roots:()=>[state],
   refOf:sh=>String(sh?.ref||'').toUpperCase(),
   idOf:sh=>String(sh?.id||''),
   fileName:(f,fallback)=>f?.name||fallback,
   fileUrl:f=>f?.url||'',
   normalizeFallback:d=>({...d,source:'shipmentState'}),
   collectDocs:()=>[]
 };
 vm.runInNewContext(source,context,{filename:'generated-ref-attachment-helpers.js'});
 return{first,other,context};
}

test('P0: archived blob-backed Lieferscheine are discoverable from the actual shipment state field',()=>{
 const {first,context}=collector();
 const files=context.shipmentAssociatedDocs(first,[]);
 assert.deepEqual(Array.from(files,file=>file.name),['SIDE_9WX5K6.pdf']);
 assert.equal(context.fallbackDocUsable(files[0]),true);
});

test('P0: duplicate legacy shipment ID does not leak a Lieferschein from another REF',()=>{
 const {first,context}=collector();
 const files=context.shipmentAssociatedDocs(first,[]);
 assert.ok(!files.some(file=>file.name==='NOT_THIS_SHIPMENT.pdf'));
});

test('P0: metadata-only Lieferschein is not advertised as a downloadable file',()=>{
 const {first,context}=collector();
 first.lieferscheine=[{name:'SIDE_NO_CONTENT.pdf'}];
 const files=context.shipmentAssociatedDocs(first,[]);
 assert.equal(files.length,0);
});


test('P0 RC1677: every canonical persisted shipment document collection is discoverable in the correct REF',()=>{
 const {first,other,context}=collector();
 const fields=['deliveryFiles','deliveryNotesFiles','podFiles','abdFiles','documents','generatedDocuments','files','attachments','invoiceFiles','mailAttachments','lieferscheine'];
 fields.forEach((field,i)=>{
  const hash=(i+1).toString(16).repeat(64);
  first[field]=[{name:'STORED_'+field+'.pdf',storage:'blob',blobName:'rc1059/production/ab/'+hash}];
  other[field]=[{name:'FOREIGN_'+field+'.pdf',storage:'blob',blobName:'rc1059/production/cd/'+hash}];
 });
 const docs=context.shipmentAssociatedDocs(first,[]);
 assert.deepEqual(new Set(Array.from(docs,d=>d.name)),new Set(fields.map(field=>'STORED_'+field+'.pdf')));
 assert.ok(docs.every(d=>d.file.storage==='blob'),'only stored genuine Blob documents are surfaced');
 assert.ok(!docs.some(d=>String(d.name).startsWith('FOREIGN_')),'same internal ID must not cross references');
});

test('P0 RC1677: metadata-only aliases remain hidden and the same named Blob is not shown twice',()=>{
 const {first,context}=collector();
 const shared={name:'SIDE_REAL.pdf',storage:'blob',blobName:'rc1059/production/ab/'+'e'.repeat(64)};
 first.lieferscheine=[shared];
 first.deliveryFiles=[{...shared}];
 first.generatedDocuments=[{name:'ONLY_METADATA.pdf'}];
 const docs=context.shipmentAssociatedDocs(first,[]);
 assert.equal(docs.filter(d=>d.name==='SIDE_REAL.pdf').length,1,'same Blob and filename should not duplicate');
 assert.equal(docs.some(d=>d.name==='ONLY_METADATA.pdf'),false,'empty file content is not retrievable');
});

test('P0 RC1677: persisted document fields and the UI discovery helper stay aligned',()=>{
 const store=fs.readFileSync('api/shared/document-blob-store.js','utf8');
 const fields=store.match(/const DOCUMENT_FIELDS=\[([^\]]+)\]/);
 assert.ok(fields,'server document array contract exists');
 const keys=Array.from(fields[1].matchAll(/'([^']+)'/g),m=>m[1]);
 const buildFields=build.match(/function collect\(copy\)\{[\s\S]*?addFields\(copy,\[([\s\S]*?)\]\)/);
 assert.ok(buildFields,'active RC1112 document collector exists');
 for(const key of keys)assert.ok(buildFields[1].includes("['"+key+"',"),'Missing stored field from REF document collector: '+key);
});


test('P0 RC1677: merged REF folder and saved uploads keep distinct same-name original files',()=>{
 const {context}=collector();
 const sameName='SIDE_9WX5K6.pdf';
 const graph={name:sameName,source:'referenceFolder',itemId:'graph-original-1'};
 const stored={name:sameName,source:'shipmentState',file:{
   name:sameName,storage:'blob',blobName:'rc1059/production/ab/'+'1'.repeat(64)
 }};
 const another={name:sameName,source:'shipmentState',file:{
   name:sameName,storage:'blob',blobName:'rc1059/production/ab/'+'2'.repeat(64)
 }};
 const merged=context.mergeReferenceDocs([graph],[stored,another]);
 assert.equal(merged.length,3,'different Graph and Blob originals with the same name must remain accessible');
 assert.equal(merged[0].itemId,'graph-original-1');
 assert.equal(merged[1].file.blobName,stored.file.blobName);
 assert.equal(merged[2].file.blobName,another.file.blobName);
});

test('P0 RC1677: merged documents collapse only proven same storage IDs',()=>{
 const {context}=collector();
 const name='SIDE_9WX5K6.pdf',blobName='rc1059/production/ab/'+'3'.repeat(64);
 const blob={name,source:'shipmentState',file:{name,storage:'blob',blobName}};
 const result=context.mergeReferenceDocs(
  [{name,source:'referenceFolder',itemId:'graph-1'},{name,source:'referenceFolder',itemId:'graph-1'}],
  [blob,{...blob,file:{...blob.file}}]
 );
 assert.equal(result.length,2,'same Graph ID and same Blob identity must appear once each');
 assert.equal(result[0].source,'referenceFolder');
 assert.equal(result[1].file.blobName,blobName);
});

test('P0 RC1677: same-name inline attachments are not silently discarded',()=>{
 const {context}=collector(),name='DELIVERY_NOTE.pdf';
 const first={name,source:'shipmentState',file:{name,dataUrl:'data:application/pdf;base64,JVBERi0xLjQ='}};
 const second={name,source:'shipmentState',file:{name,dataUrl:'data:application/pdf;base64,JVBERi0xLjU='}};
 const documents=context.mergeReferenceDocs([],[first,second]);
 assert.equal(documents.length,2,'without storage identity, retain both independent inline documents');
});
