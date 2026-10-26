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
 const source=build.slice(at+marker.length,stop);
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
