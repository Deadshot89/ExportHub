import test from 'node:test';
import assert from 'node:assert/strict';
import Module, {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ENV='EXPORTHUB_STORAGE_CONNECTION_STRING';
const previous=process.env[ENV];
process.env[ENV]='rc1876-in-memory-test';
test.after(()=>{if(previous===undefined)delete process.env[ENV];else process.env[ENV]=previous});

function memory(){
 const blobs=new Map();let version=0,failNextPut=false;
 const missing=()=>Object.assign(new Error('Blob missing'),{statusCode:404});
 const conflict=()=>Object.assign(new Error('Precondition failed'),{statusCode:412});
 return {
   blobs,
   conflictNextPut(){failNextPut=true},
   createBlobServiceClient(){
     return {getContainerClient(container){return {getBlockBlobClient(path){
       const key=container+'/'+path;
       return {
         async download(){const found=blobs.get(key);if(!found)throw missing();
           return {etag:found.etag,readableStreamBody:(async function*(){yield found.bytes})()}},
         async upload(raw,length,options={}){
           if(failNextPut){failNextPut=false;throw conflict()}
           const prev=blobs.get(key),conditions=options.conditions||{};
           if(conditions.ifMatch&&(!prev||prev.etag!==conditions.ifMatch))throw conflict();
           if(conditions.ifNoneMatch==='*'&&prev)throw conflict();
           assert.equal(Number(length),Buffer.byteLength(raw));
           assert.equal(options.transportAttempts,1);
           const etag='"rev-'+(++version)+'"';
           blobs.set(key,{etag,bytes:Buffer.from(raw)});
           return {etag};
         }
       };
     }}}};
   }}
 };
}
function loadStore(mem){
 const path=require.resolve('../api/shared/pickup-transport-link-store.js');
 const original=Module._load;
 Module._load=function(request,parent,isMain){if(request==='./blob-rest'&&parent&&/pickup-transport-link-store/.test(parent.filename))return mem;return original.call(this,request,parent,isMain)};
 delete require.cache[path];
 try{return require(path)}finally{Module._load=original}
}
const day='2026-11-09',scope={companyKey:'essentra',environment:'testservice'};
const transport={id:'TRANSPORT-UK-20261109',pickupTargetId:'FIX-UK',companyKey:'essentra',environment:'testservice',pickupDate:day,registered:true};
const task={id:'PICK-UK',pickupTargetId:'FIX-UK',pickupTargetCompanyKey:'essentra',customerNumber:'00123,45,67',recurrence:'weekly',weekdays:[1]};
const sh=(reference,customerNumber,additional={})=>({reference,customerNumber,companyId:'essentra',environment:'testservice',plannedPickupDate:day,pickupStatus:'open',...additional});
const auto=(store,extra={})=>store.applyAutomatic({...scope,pickupDate:day,expectedRevision:0,actor:'Planner',
  transports:[transport],tasks:[task],shipments:[sh('REF-A','123'),sh('REF-B','00045')],...extra});
const manual=(store,extra={})=>store.applyManual({...scope,pickupDate:day,expectedRevision:0,actor:'Planner',reason:'Manuelle Korrektur durch Team',
  action:'link',shipment:sh('REF-A','123'),transport,...extra});

test('ledger paths partition company and environment without exposing company name',()=>{
 const store=loadStore(memory());
 const a=store.pathFor(scope),b=store.pathFor({...scope,environment:'production'}),c=store.pathFor({...scope,companyKey:'other'});
 assert.notEqual(a,b);assert.notEqual(a,c);assert.match(a,/^testservice\/pickup-transport-links\/[0-9a-f]{24}\.json$/);
 assert.doesNotMatch(a,/essentra/);
});
test('first authenticated reader receives empty revision without writing a blob',async()=>{
 const mem=memory(),store=loadStore(mem);
 assert.deepEqual(await store.read(scope),{environment:'testservice',companyKey:'essentra',revision:0,links:[],manualExclusions:[]});
 assert.equal(mem.blobs.size,0);
});
test('automatic A/B links are durable and a later C remains independently linked',async()=>{
 const mem=memory(),store=loadStore(mem);
 const first=await auto(store);
 assert.deepEqual(first.added,['REF-A','REF-B']);assert.equal(first.revision,1);
 const second=await loadStore(mem).read(scope,{includeAudit:true});
 assert.deepEqual(second.links.map(x=>x.ref),['REF-A','REF-B']);
 assert.equal(second.audit.length,2);assert.ok(second.audit.every(x=>x.action==='automatic-link'&&x.by==='Planner'));
 const next=await auto(store,{expectedRevision:1,shipments:[sh('REF-A','123'),sh('REF-B','45'),sh('REF-C','67')]});
 assert.deepEqual(next.added,['REF-C']);assert.equal(next.revision,2);
 assert.equal((await loadStore(mem).read(scope)).links.length,3);
 const again=await auto(store,{expectedRevision:2,shipments:[sh('REF-A','123'),sh('REF-B','45'),sh('REF-C','67')]});
 assert.deepEqual(again.added,[]);assert.equal(again.revision,2);
 assert.equal((await store.read(scope,{includeAudit:true})).audit.length,3);
});
test('manually excluded REF remains excluded after automatic re-synchronization',async()=>{
 const mem=memory(),store=loadStore(mem);
 await auto(store);
 const removed=await store.applyManual({...scope,pickupDate:day,expectedRevision:1,actor:'Operator',reason:'Korrektur aufgrund Kundenauftrag',action:'unlink',shipment:sh('REF-A','123')});
 assert.equal(removed.changed,true);assert.deepEqual(removed.links.map(x=>x.ref),['REF-B']);
 assert.deepEqual(removed.manualExclusions,[{ref:'REF-A',pickupDate:day}]);
 const res=await auto(store,{expectedRevision:2});
 assert.equal(res.revision,2);assert.deepEqual(res.added,[]);assert.ok(res.conflicts.some(x=>x.code==='MANUAL_UNLINK_PROTECTED'));
 assert.equal((await store.read(scope,{includeAudit:true})).audit.at(-1).action,'manual-unlink');
});
test('manual re-link cannot overwrite an automatic link without explicit confirmation',async()=>{
 const store=loadStore(memory());await auto(store);
 await assert.rejects(manual(store,{expectedRevision:1,transport:{...transport,id:'TRANSPORT-ALT'}}),{code:'LINK_OVERRIDE_CONFIRMATION_REQUIRED'});
 const fixed=await manual(store,{expectedRevision:1,transport:{...transport,id:'TRANSPORT-ALT'},confirmOverride:true});
 assert.equal(fixed.revision,2);assert.equal(fixed.links.find(x=>x.ref==='REF-A').transportId,'TRANSPORT-ALT');
 assert.equal(fixed.links.find(x=>x.ref==='REF-A').mode,'manual');
 const next=await auto(store,{expectedRevision:2});
 assert.deepEqual(next.added,[]);assert.ok(next.conflicts.some(x=>x.code==='MANUAL_OVERRIDE_PROTECTED'));
 const audit=(await store.read(scope,{includeAudit:true})).audit;
 assert.equal(audit.at(-1).oldTransportId,transport.id);assert.equal(audit.at(-1).newTransportId,'TRANSPORT-ALT');
});
test('a stale revision cannot overwrite existing links and must not add audit entries',async()=>{
 const mem=memory(),store=loadStore(mem);await auto(store);
 await assert.rejects(manual(store,{expectedRevision:0,confirmOverride:true}),{code:'LINK_REVISION_CONFLICT'});
 assert.equal((await store.read(scope,{includeAudit:true})).audit.length,2);
});
test('ETag conflicts abort rather than retry a stale write',async()=>{
 const mem=memory(),store=loadStore(mem);mem.conflictNextPut();
 await assert.rejects(auto(store),{code:'LINK_CONCURRENT_UPDATE'});
 assert.equal(mem.blobs.size,0);
});
test('wrong company and environment are rejected, and no writes happen',async()=>{
 const mem=memory(),store=loadStore(mem);
 await assert.rejects(manual(store,{shipment:sh('REF-A','123',{companyId:'other'})}),{code:'LINK_COMPANY_MISMATCH'});
 await assert.rejects(manual(store,{transport:{...transport,environment:'production'}}),{code:'LINK_ENVIRONMENT_MISMATCH'});
 await assert.rejects(manual(store,{transport:{...transport,registered:false}}),{code:'LINK_TRANSPORT_UNVERIFIED'});
 assert.equal(mem.blobs.size,0);
});
test('completed shipments require explicit override; cancelled shipments cannot be linked',async()=>{
 const store=loadStore(memory());
 await assert.rejects(manual(store,{shipment:sh('REF-A','123',{shipmentStatus:'abgeholt'})}),{code:'LINK_SHIPMENT_LOCKED'});
 const valid=await manual(store,{shipment:sh('REF-A','123',{shipmentStatus:'abgeholt'}),confirmOverride:true});
 assert.equal(valid.changed,true);
 await assert.rejects(manual(store,{expectedRevision:1,shipment:sh('REF-C','67',{status:'Storniert'})}),{code:'LINK_SHIPMENT_CANCELLED'});
});
test('bad scope, missing actor, invalid transport ID and insufficient audit reason block saves',async()=>{
 const store=loadStore(memory());
 await assert.rejects(auto(store,{environment:'demo'}),{code:'LINK_SCOPE_INVALID'});
 await assert.rejects(auto(store,{actor:''}),{code:'LINK_ACTOR_REQUIRED'});
 await assert.rejects(manual(store,{reason:'ok'}),{code:'LINK_REASON_REQUIRED'});
 await assert.rejects(manual(store,{transport:{...transport,id:'Essentra UK'}}),{code:'LINK_ID_INVALID'});
});
test('automatic links reject mixed production and TESTSERVICE evidence',async()=>{
 const mem=memory(),store=loadStore(mem);
 await assert.rejects(auto(store,{shipments:[sh('REF-A','123',{environment:'production'})]}),
   {code:'LINK_ENVIRONMENT_MISMATCH'});
 await assert.rejects(auto(store,{transports:[{...transport,environment:'production'}]}),
   {code:'LINK_ENVIRONMENT_MISMATCH'});
 assert.equal(mem.blobs.size,0);
});
test('two active rows for the same REF on separate dates are rejected',async()=>{
 const mem=memory(),store=loadStore(mem),path='exporthub-data/'+store.pathFor(scope);
 mem.blobs.set(path,{etag:'"duplicate"',bytes:Buffer.from(JSON.stringify({
   schemaVersion:1,...scope,revision:2,updatedAt:null,audit:[],
   links:[
     {ref:'REF-A',pickupDate:'2026-11-09',transportId:'TRANSPORT-1',active:true},
     {ref:'REF-A',pickupDate:'2026-11-10',transportId:'TRANSPORT-2',active:true}
   ]
 }))});
 await assert.rejects(store.read(scope),{code:'LINK_DOCUMENT_INVALID'});
});
test('corrupt or cross-tenant existing records fail closed',async()=>{
 const mem=memory(),store=loadStore(mem);
 const blobName='exporthub-data/'+store.pathFor(scope);
 mem.blobs.set(blobName,{etag:'"bad"',bytes:Buffer.from(JSON.stringify({schemaVersion:1,environment:'production',companyKey:'essentra',revision:1,links:[],audit:[]}))});
 await assert.rejects(store.read(scope),{code:'LINK_DOCUMENT_INVALID'});
 await assert.rejects(auto(store),{code:'LINK_DOCUMENT_INVALID'});
});
test('automatic association never touches shipment QR, POD or task records',async()=>{
 const mem=memory(),store=loadStore(mem);
 const shipment=sh('REF-A','123',{qr:'QR-KEEP',pod:{signed:true},pickupHistory:[{status:'open'}]});
 const input={...scope,pickupDate:day,expectedRevision:0,actor:'Planner',transports:[transport],tasks:[task],shipments:[shipment]};
 const before=JSON.stringify(input);
 const saved=await store.applyAutomatic(input);
 assert.deepEqual(saved.added,['REF-A']);assert.equal(JSON.stringify(input),before);
 assert.equal(mem.blobs.size,1);
});
