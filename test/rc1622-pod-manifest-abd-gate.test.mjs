import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const resolverSource=fs.readFileSync(new URL('../api/shared/pickup-store.js',import.meta.url),'utf8');
const confirmSource=fs.readFileSync(new URL('../api/pickup-confirm-v2/index.js',import.meta.url),'utf8');
const podSource=fs.readFileSync(new URL('../api/pickup-pod/index.js',import.meta.url),'utf8');

function resolver(state,record,verifiedBlobs={}){
 const start=resolverSource.indexOf('function rc1622PdfBytes('),end=resolverSource.indexOf('function mergeContainerPhotos(',start);
 assert.ok(start>=0&&end>start);
 // Only named, readable PDF bytes in the correct TEST/PRODUCTION container may release a pickup.
 const pdf=Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
 const blobs=Object.assign({'rc1059/production/a.pdf':pdf},verifiedBlobs);
 const sandbox={
  Buffer,crypto,process:{env:{}},
  clients:async()=>({environment:'production',team:{getBlockBlobClient:()=>({})},
   service:{getContainerClient:container=>{
    assert.equal(container,'exporthub-documents');
    return {getBlockBlobClient:name=>({
      getProperties:async()=>{
       if(!Object.hasOwn(blobs,name))throw Object.assign(Error('Blob missing'),{statusCode:404});
       if(blobs[name] instanceof Error)throw blobs[name];
       return {contentLength:blobs[name].length};
      },
      downloadToBuffer:async()=>{
       if(!Object.hasOwn(blobs,name))throw Object.assign(Error('Blob missing'),{statusCode:404});
       if(blobs[name] instanceof Error)throw blobs[name];
       return blobs[name];
      }
    })};
   }}}),
  teamBlobName:()=> 'team-state.json',
  readJson:async()=>({value:{state}}),
  sanitizeText:x=>String(x==null?'':x).trim(),
  first:(o,keys)=>keys.map(k=>o&&o[k]).find(Boolean)||''
 };
 vm.runInNewContext(resolverSource.slice(start,end),sandbox);
 return sandbox.resolveShipmentAbdConfig(record,'production');
}
test('RC1622: mandatory open ABD blocks pickup, even if status falsely says complete',async()=>{
 const ref='X64RY9';
 const state={shipments:[{id:'s1',ref,abdRequired:true,abdStatus:'Offen',abdFiles:[]}],
  abdRequests:[{linkedShipmentId:'s1',ref,status:'Abgeschlossen',done:true,abdFiles:[]}]};
 const cfg=await resolver(state,{shipmentId:'s1',reference:ref,abdPresent:true});
 assert.equal(cfg.abdRequired,true);
 assert.equal(cfg.abdPresent,false,'Neither stale boolean nor done status qualifies as stored customs PDF');
});
test('RC1622: valid persisted ABD in savedShipments satisfies required gate without losing file',async()=>{
 const state={shipments:[{id:'s1',ref:'X64RY9',abdRequired:true,abdFiles:[]}],
  savedShipments:[{id:'s1',ref:'X64RY9',abdFiles:[{name:'ABD.pdf',blobName:'rc1059/production/a.pdf',status:'active'}]}]};
 const cfg=await resolver(state,{shipmentId:'s1',reference:'X64RY9'});
 assert.equal(cfg.abdRequired,true);
 assert.equal(cfg.abdPresent,true);
});
test('RC1622: expired/replaced ABD or unrelated request cannot release another shipment',async()=>{
 const state={shipments:[{id:'s1',ref:'X64RY9',abdRequired:true,abdFiles:[{blobName:'old.pdf',status:'replaced'}]}],
  abdRequests:[{id:'req-other',linkedShipmentId:'s2',ref:'QW1234',abdFiles:[{blobName:'other.pdf'}]}]};
 const cfg=await resolver(state,{shipmentId:'s1',reference:'X64RY9'});
 assert.equal(cfg.abdRequired,true);
 assert.equal(cfg.abdPresent,false);
});
test('RC1622: non-ABD shipment remains eligible for normal pickup',async()=>{
 const cfg=await resolver({shipments:[{id:'s1',ref:'DE0001',abdRequired:false}]},{shipmentId:'s1',reference:'DE0001'});
 assert.equal(cfg.abdRequired,false);
 assert.equal(cfg.abdPresent,false);
});
function runConfirm(cfg,fail=false){
 const record={status:'open',reference:'X64RY9'};
 let mutated=0;
 const store={
  body:req=>req.body, json:(status,body)=>({status,body}),
  pickupHistory:()=>[],pickupComplete:()=>false,
  getRecord:async()=>({record}),
  first:(obj,keys)=>keys.map(key=>obj[key]).find(Boolean)||'',
  abdPresent:()=>false,
  resolveShipmentAbdConfig:async()=>{if(fail)throw Error('Azure unavailable');return cfg},
  mutateRecord:async()=>{mutated++;throw Error('must never mutate on open ABD')},
  err:(code,message,status)=>Object.assign(new Error(message),{code,status})
 };
 const access={resolve:async()=>({resourceKey:'accesskey',environment:'production',tokenHash:'token',record:{}})};
 const pins={text:v=>v,validPin:()=>true,findByPin:async()=>({id:'loader',name:'Loader'})};
 const apiI18n={t:()=> 'translated'};
 const mod={exports:{}};
 vm.runInNewContext(confirmSource,{module:mod,exports:mod.exports,require:name=>
  name==='crypto'?{}:name==='../shared/public-access-store'?access:
  name==='../shared/loader-pin-store'?pins:
  name==='../shared/pickup-store'?store:
  name==='../shared/container-document-store'?{}:
  name==='../shared/i18n'?apiI18n:(()=>{throw Error('unexpected require '+name)})(),
  console
 });
 const context={res:null,log:{error(){},warn(){}}};
 return mod.exports(context,{method:'POST',body:{token:'token',pin:'1234',driverSignature:'signature',reference:'X64RY9'}})
  .then(()=>({response:context.res,mutated}));
}
test('RC1622: server stops pickup before writing driver signature when ABD is missing',async()=>{
 const {response,mutated}=await runConfirm({abdRequired:true,abdPresent:false});
 assert.equal(response.status,409);
 assert.equal(response.body.code,'ABD_DOCUMENT_REQUIRED');
 assert.equal(mutated,0);
});
test('RC1622: failed authoritative ABD check cannot silently release QR pickup',async()=>{
 const {response,mutated}=await runConfirm({},true);
 assert.equal(response.status,503);
 assert.equal(response.body.code,'ABD_CHECK_UNAVAILABLE');
 assert.equal(mutated,0);
});
test('RC1622: authenticated POD manifest is read-only and only exposes immutable current layouts',async()=>{
 const mod={exports:{}},files=[
  {id:'auto-current-001',kind:'automatic-pod',renderLayout:'RC1595',blobName:'archived.pdf',uploadedAt:'2026-10-22'},
  {id:'automatic-pod-'+('b'.repeat(16)),kind:'automatic-pod',layoutVersion:'RC1600-SIGNED-LOADING-LIST-V4',source:'pickup-confirm-v3',hash:'b'.repeat(64),blobName:'rc995/production/original.pdf'},
  {id:'automatic-pod-'+('c'.repeat(16)),kind:'automatic-pod',layoutVersion:'RC1600-SIGNED-LOADING-LIST-V4',source:'pickup-confirm-v3',hash:'incorrect',blobName:'unverified.pdf'},
  {id:'auto-old-002',kind:'automatic-pod',renderLayout:'RC1530',blobName:'old.pdf'},
  {id:'unverified-001',kind:'signed-loadlist',blobName:'other.pdf'}
 ];
 const store={json:(status,body)=>({status,body}),pickupHistory:()=>[],
  pickupComplete:()=>true,getRecord:async()=>({record:{podFiles:files}})};
 const access={resolve:async()=>({resourceKey:'accesskey',environment:'production',tokenHash:'token'})};
 vm.runInNewContext(podSource,{module:mod,exports:mod.exports,require:name=>
  name==='../shared/public-access-store'?access:name==='../shared/pickup-store'?store:
  name==='../shared/i18n'?{t:()=>''}:name==='../shared/pod-archive'?{}:
  (()=>{throw Error('Unexpected require '+name)})(),
  console
 });
 const context={res:null,log:{error(){}}};
 await mod.exports(context,{method:'GET',query:{token:'authorized-token',manifest:'1'}});
 assert.equal(context.res.status,200);
 assert.equal(context.res.body.files.length,2);
 assert.equal(context.res.body.files[0].id,'auto-current-001');
 assert.equal(context.res.body.files[0].blobName,undefined);
 assert.equal(context.res.body.files[1].id,'automatic-pod-'+('b'.repeat(16)));
 assert.equal(context.res.body.files[1].layoutVersion,'RC1600-SIGNED-LOADING-LIST-V4');
 assert.equal(context.res.body.files[1].hash,'b'.repeat(64));
 assert.equal(context.res.body.files[1].blobName,undefined);
 assert.equal(context.res.body.files.some(f=>f.id==='auto-old-002'),false);
});


test('RC1622 P0: orphaned Azure ABD blob name must never release pickup',async()=>{
 const state={shipments:[{id:'s1',ref:'X64RY9',abdRequired:true,
  abdFiles:[{status:'active',storage:'blob',blobName:'rc1059/production/missing/abd.pdf'}]}]};
 const cfg=await resolver(state,{shipmentId:'s1',reference:'X64RY9'});
 assert.equal(cfg.abdRequired,true);
 assert.equal(cfg.abdPresent,false,'Azure path without readable PDF is not a customs document');
 const {response,mutated}=await runConfirm(cfg);
 assert.equal(response.status,409);
 assert.equal(response.body.code,'ABD_DOCUMENT_REQUIRED');
 assert.equal(mutated,0);
});

test('RC1622 P0: unreadable or invalid PDFs never satisfy required ABD gate',async()=>{
 const path='rc1059/production/aa/invalid.pdf';
 const state={savedShipments:[{id:'s1',ref:'X64RY9',abdRequired:true,
  abdFiles:[{status:'active',storage:'blob',blobName:path}]}]};
 const cfg=await resolver(state,{shipmentId:'s1',reference:'X64RY9'},
  {[path]:Buffer.from('Not a real PDF; forged filename with fake blob')});
 assert.equal(cfg.abdRequired,true);
 assert.equal(cfg.abdPresent,false);
});

test('RC1622 P0: production ABD evidence cannot come from a testservice blob',async()=>{
 const path='rc1059/testservice/aa/present.pdf';
 const state={shipments:[{id:'s1',ref:'X64RY9',abdRequired:true,
  abdFiles:[{status:'active',storage:'blob',blobName:path}]}]};
 const cfg=await resolver(state,{shipmentId:'s1',reference:'X64RY9'},
  {[path]:Buffer.from('%PDF-1.7\nThis is a different environment.\n%%EOF')});
 assert.equal(cfg.abdPresent,false);
});

test('RC1622 P0: Azure ABD read failure is surfaced, never converted into a release',async()=>{
 const path='rc1059/production/aa/unavailable.pdf';
 const state={shipments:[{id:'s1',ref:'X64RY9',abdRequired:true,abdFiles:[{storage:'blob',blobName:path}]}]};
 await assert.rejects(
  resolver(state,{shipmentId:'s1',reference:'X64RY9'},{[path]:Object.assign(Error('Azure unavailable'),{statusCode:503})}),
  /Azure unavailable/
 );
 const {response,mutated}=await runConfirm({},true);
 assert.equal(response.status,503);
 assert.equal(response.body.code,'ABD_CHECK_UNAVAILABLE');
 assert.equal(mutated,0);
});


test('RC1622 P0: malformed declared ABD SHA-256 cannot authorize pickup',async()=>{
 const path='rc1059/production/aa/hash-metadata.pdf';
 const pdf=Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
 const state={shipments:[{id:'s1',ref:'X64RY9',abdRequired:true,
  abdFiles:[{storage:'blob',status:'active',blobName:path,sha256:'not-a-valid-sha256'}]}]};
 const cfg=await resolver(state,{shipmentId:'s1',reference:'X64RY9'},{[path]:pdf});
 assert.equal(cfg.abdRequired,true);
 assert.equal(cfg.abdPresent,false,'A corrupt declared document checksum is not valid proof');
});
