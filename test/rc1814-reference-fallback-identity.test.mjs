import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const page=fs.readFileSync('index.html','utf8');
function harness(mode='error'){
 const marker='const docHelpers=',begin=build.indexOf(marker),end=build.indexOf('\n`;',begin);
 assert.ok(begin>=0&&end>begin,'actual emitted REF helpers exist');
 const helpers=vm.runInNewContext(build.slice(begin+marker.length,end+3));
 const loaderStart=build.indexOf('`async function loadReferenceDocs(sh,fallback){');
 const loaderEnd=build.indexOf('\n`',loaderStart+1);
 assert.ok(loaderStart>=0&&loaderEnd>loaderStart,'actual emitted loader exists');
 const files=['a','b','c'].map(hash=>({id:'FILE-'+hash,name:'ORIGINAL_'+hash+'.pdf',
  storage:'blob',blobName:'rc1059/production/ab/'+hash.repeat(64),hash:hash.repeat(64),size:123}));
 const shipment={id:'SYNTH-SHIP',ref:'ABC123',deliveryFiles:files};
 const state={view:'shipmentview',shipmentViewId:'ABC123',shipments:[shipment]},panels=[];
 const context={window:{ExportHUBDocumentBlob1059:{isBlobDocument:f=>!!f?.blobName}},
  q:v=>String(v??'').trim(),low:v=>String(v??'').toLowerCase(),arr:v=>Array.isArray(v)?v:[],
  obj:v=>!!v&&typeof v==='object'&&!Array.isArray(v),num:v=>Number(v)||0,docType:()=> 'PDF',
  state:()=>state,roots:()=>[state],refOf:s=>s?.ref||'',idOf:s=>s?.id||'',
  find:key=>key===shipment.ref||key===shipment.id?shipment:null,
  liveDoc:f=>({...f,source:'referenceFolder'}),
  referenceList:async()=>{if(mode==='error')throw new Error('SYNTH_REF_UNAVAILABLE');
   return mode==='unavailable'?{available:false}:{available:true,files:[]}},
  setDocsPanel:(docs,source,error)=>panels.push({docs,source,error}),console:{warn(){}}};
 vm.createContext(context);
 const view=page.slice(page.indexOf('if(window.__EXPORTHUB_RC776_SHIPMENT_VIEW__)return'));
 for(const prefix of ['function fileUrl(f){','function fileName(f,fallback){','var GROUPS=',
  'function generatedType(f){','function documentFallback(field,label,index,f){',
  'function collectDocs(sh){','function normalizeFallback(d){']){
  const line=view.split(/\r?\n/).find(line=>line.startsWith(prefix));
  assert.ok(line,'actual viewer dependency '+prefix);
  vm.runInContext(line,context);
 }
 vm.runInContext(helpers,context);
 vm.runInContext(build.slice(loaderStart+1,loaderEnd),context);
 return{context,shipment,state,files,panels};
}

for(const mode of ['error','unavailable','success'])test('RC1814: '+mode+' REF result displays each stored original once',async()=>{
 const h=harness(mode);
 const initial=h.context.collectDocs(h.shipment).map(h.context.normalizeFallback);
 await h.context.loadReferenceDocs(h.shipment,initial);
 assert.equal(h.panels.length,1);
 assert.equal(h.panels[0].docs.length,3,'three stored originals must not become nine fallback rows');
 assert.equal(new Set(h.panels[0].docs.map(d=>d.file.blobName)).size,3);
});

test('RC1814: repeated collection and collection aliases are idempotent by stored Blob identity',()=>{
 const h=harness();
 h.shipment.attachments=h.files.map(f=>({...f}));
 h.state.savedShipments=[structuredClone(h.shipment)];
 let docs=h.context.collectDocs(h.shipment).map(h.context.normalizeFallback);
 for(let i=0;i<3;i++){
  docs=h.context.shipmentAssociatedDocs(h.shipment,docs);
  assert.equal(docs.length,3);
 }
});

test('RC1814: matching names, metadata and recycled file IDs never discard different stored originals',()=>{
 const h=harness(),same={name:'SAME.pdf',id:'RECYCLED-ID',size:123,uploadedAt:'2026-01-01'};
 h.shipment.deliveryFiles=h.files.map(f=>({...f,...same}));
 const docs=h.context.shipmentAssociatedDocs(h.shipment,[]);
 assert.equal(docs.length,3,'distinct Blob versions remain available');
});

test('RC1814: Graph and Blob originals and unproven inline versions remain distinct',()=>{
 const h=harness(),name='SAME.pdf';
 const inline=[{name,file:{name,id:'REUSED',dataUrl:'data:application/pdf;base64,JVBERi0xLjQ='}},
  {name,file:{name,id:'REUSED',dataUrl:'data:application/pdf;base64,JVBERi0xLjU='}}];
 const docs=h.context.mergeReferenceDocs([{name,source:'referenceFolder',itemId:'GRAPH-1'},
  {name,source:'referenceFolder',itemId:'GRAPH-2'}],
  [{name,file:h.files[0]},{name,file:h.files[1]},...inline]);
 assert.equal(docs.length,6);
});
