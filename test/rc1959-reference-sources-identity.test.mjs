import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('api/reference-files/index.js','utf8');
const start=source.indexOf('function mergeReferenceFileSources(');
// Extract only the pure merge helper; the next function is the real Graph listFiles implementation.
// Including it would shadow this suite's synthetic listFiles stub and hit real Graph paths.
const end=source.indexOf('\nasync function listFiles(',start);
const handlerStart=source.indexOf('module.exports=async function(context,req){');
const handlerEnd=source.indexOf('\nmodule.exports.avUploadFile=',handlerStart);
assert.ok(start>=0&&end>start&&handlerStart>=0&&handlerEnd>handlerStart);
const mergeSource=source.slice(start,end);
const handlerSource=source.slice(handlerStart,handlerEnd);
const text=v=>String(v==null?'':v).trim();

function exercise({graph=[],azure=[],docs=[],failGraph=false,failAzure=false,failDocs=false,auth=false,gate=null}={}){
 const calls=[];
 if(gate)gate.calls=calls;
 const denied=Object.assign(new Error('Session denied'),{code:'AUTH_REQUIRED',status:401});
 const scope={
  module:{exports:{}},text,lower:v=>text(v).toLowerCase(),
  validateSession:async()=>{if(auth)throw denied;return{user:{id:'synthetic'}}},
  publicAccess:{environment:()=> 'production'},
  refValue:v=>{const ref=text(v).toUpperCase();if(!/^[A-Z0-9]{6}$/.test(ref))throw new Error('Invalid REF');return ref},
  avBlob:{list:async ref=>{calls.push('azure:'+ref);if(gate)await gate.wait;if(failAzure)throw Error('synthetic-azure-error');return azure}},
  refDocBlob:{list:async ref=>{calls.push('refdoc:'+ref);if(gate)await gate.wait;if(failDocs)throw Error('synthetic-refdoc-error');return docs}},
  listFiles:async ref=>{calls.push('graph:'+ref);if(gate)await gate.wait;if(failGraph)throw Object.assign(Error('synthetic-graph-error'),{code:'GRAPH_LIST_FAILED',status:403});return{files:graph,folderPath:'REF/'+ref,folderMissing:graph.length===0}},
  folderPath:ref=>'REF/'+ref,
  error:(code,message,status)=>Object.assign(new Error(message||code),{code,status}),
  json:(status,body)=>({status,body:JSON.stringify(body)}),
  localizedError:(_req,e)=>e.message,
  apiI18n:{t:()=> 'Synthetic error'},
  referenceFolder:{exactTarget:()=>null},
  Set,Array,Buffer
 };
 vm.runInNewContext(mergeSource,scope,{filename:'reference-merge.js'});
 vm.runInNewContext(handlerSource,scope,{filename:'reference-files-handler.js'});
 const context={log:{error:()=>{}}};
 return scope.module.exports(context,{method:'GET',query:{reference:'9WX5K6'},headers:{}})
  .then(()=>({status:context.res.status,body:JSON.parse(context.res.body),calls}));
}

const same='SIDE_9WX5K6.pdf';
const graphFile={id:'GRAPH-1',name:same,size:100};
const avFile={id:'avblob:123',name:same,size:100};
const refFile={id:'refdoc:'+'a'.repeat(32),name:same,size:100};

test('RC1959: distinct Graph, AV and REF Azure originals retain their own IDs despite matching filenames',async()=>{
 const r=await exercise({graph:[graphFile],azure:[avFile],docs:[refFile]});
 assert.equal(r.status,200);
 assert.equal(r.body.partial,false);
 assert.deepEqual(Array.from(r.body.files,f=>f.id),[graphFile.id,avFile.id,refFile.id]);
 assert.deepEqual(Array.from(r.body.files,f=>f.storage||'graph'),['graph','azure-av','azure-refdoc']);
 assert.ok(r.body.files.every(f=>f.name===same));
});

test('RC1959: duplicate source IDs collapse but independent same-name Azure originals remain',async()=>{
 const second={...refFile,id:'refdoc:'+'b'.repeat(32)};
 const r=await exercise({docs:[refFile,{...refFile},second]});
 assert.equal(r.status,200);
 assert.deepEqual(Array.from(r.body.files,f=>f.id),[refFile.id,second.id]);
});

test('RC1959: Azure AV failure does not block readable SharePoint originals',async()=>{
 const r=await exercise({graph:[graphFile],failAzure:true});
 assert.equal(r.status,200);
 assert.equal(r.body.partial,true);
 assert.deepEqual(Array.from(r.body.files,f=>f.id),[graphFile.id]);
 assert.deepEqual(r.calls,['azure:9WX5K6','refdoc:9WX5K6','graph:9WX5K6']);
});

test('RC1959: Azure REF-copy failure does not hide a readable Graph document',async()=>{
 const r=await exercise({graph:[graphFile],failDocs:true});
 assert.equal(r.status,200);
 assert.equal(r.body.partial,true);
 assert.equal(r.body.files.length,1);
});

test('RC1959: empty Graph plus failed Azure cannot masquerade as zero documents',async()=>{
 const r=await exercise({failAzure:true});
 assert.equal(r.status,503);
 assert.equal(r.body.ok,false);
 assert.equal(r.body.code,'REFERENCE_FILE_SOURCES_INCOMPLETE');
 assert.ok(!Object.hasOwn(r.body,'files'));
});

test('RC1959: Graph outage keeps stored Azure files, but reports partial coverage',async()=>{
 const r=await exercise({failGraph:true,docs:[refFile]});
 assert.equal(r.status,200);
 assert.equal(r.body.partial,true);
 assert.deepEqual(Array.from(r.body.files,f=>f.id),[refFile.id]);
});

test('RC1959: a 403 without available Azure files is never downgraded to empty success',async()=>{
 const r=await exercise({failGraph:true});
 assert.equal(r.status,403);
 assert.equal(r.body.code,'GRAPH_LIST_FAILED');
});

test('RC1959: unauthorized callers cannot enumerate any document source',async()=>{
 const r=await exercise({auth:true});
 assert.equal(r.status,401);
 assert.deepEqual(r.calls,[]);
});

test('RC1959: independent authorized Graph and Azure listings all start before the slowest source finishes',async()=>{
 let release;
 const gate={wait:new Promise(resolve=>{release=resolve})};
 const pending=exercise({graph:[graphFile],azure:[avFile],docs:[refFile],gate});
 // The old sequential implementation started only Azure AV before the gate released.
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(gate.calls,['azure:9WX5K6','refdoc:9WX5K6','graph:9WX5K6']);
 release();
 const r=await pending;
 assert.equal(r.status,200);
 assert.equal(r.body.partial,false);
 assert.deepEqual(Array.from(r.body.files,f=>f.id),[graphFile.id,avFile.id,refFile.id]);
});

test('RC1972: DNC label is canonical while original Graph/REF archive names and IDs stay unchanged',async()=>{
 const archive='Lieferschein_9WX5K6_20261113-144500_DNC3019222063.pdf';
 const r=await exercise({graph:[{id:'G-1',name:archive,size:22}],docs:[{id:'refdoc:'+'d'.repeat(32),name:archive,size:22}]});
 assert.equal(r.status,200);assert.equal(r.body.files.length,2);
 for(const file of r.body.files){
  assert.equal(file.displayName,'DNC3019222063.pdf');
  assert.equal(file.name,archive);
 }
});
test('RC1972: mismatched REF, unrecognized PDF and non-delivery archive are never guessed',async()=>{
 const graph=[
  {id:'G-1',name:'Lieferschein_ABC123_20261113-144500_DNC3019222063.pdf'},
  {id:'G-2',name:'Lieferschein_9WX5K6_20261113-144500_SalesPackingSlip-SCAN.pdf'},
  {id:'G-3',name:'Rechnung_9WX5K6_20261113-144500_DNC3019222063.pdf'}
 ];
 const r=await exercise({graph});
 assert.equal(r.status,200);
 assert.ok(r.body.files.every(file=>file.displayName===file.name));
});
