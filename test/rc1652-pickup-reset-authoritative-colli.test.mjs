import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url), Module=require('node:module');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const clone=v=>JSON.parse(JSON.stringify(v));
function load(mocks){
 const file=path.resolve(ROOT,'api/pickup-init/index.js'),orig=Module._load;
 Module._load=(request,parent,isMain)=>Object.hasOwn(mocks,request)?mocks[request]:orig.call(Module,request,parent,isMain);
 delete require.cache[require.resolve(file)];
 try{return require(file)}finally{Module._load=orig}
}
function fixture(input){
 let record=input===null?null:clone(input);
 let writes=0,mutations=0;
 const key='a'.repeat(64),token='b'.repeat(48);
 const access={async issue(){return{token,resourceKey:key,tokenHash:key,environment:'production',expiresAt:'2026-10-30T00:00:00Z',reused:true}}};
 const auth={async validateSession(){return{user:{name:'Global Admin'}}},hasAnyEditRight(){return true}};
 const store={
  json:(status,payload)=>({status,body:JSON.stringify(payload)}),body:req=>req.body,
  sanitizeText:(v,n=180)=>String(v||'').slice(0,n),
  expectedCollis:s=>Number(s.expectedColliCount||0)||(Array.isArray(s.rows)?s.rows.reduce((sum,row)=>sum+Number(row.count||0),0):0),
  clone,addressFromSource:()=>'',transportModeOf:()=>'',containerDocumentationRequired:()=>false,
  abdPresent:()=>false,resolveShipmentAddress:async()=>'',resolveShipmentContainerConfig:async()=>({}),resolveShipmentAbdConfig:async()=>({}),
  clients:async()=>({records:{}}),recordBlob:()=>({}),
  async getRecord(){if(!record){const e=new Error('missing');e.code='PICKUP_NOT_FOUND';throw e}return{record:clone(record)}},
  async mutateRecord(_key,_env,fn){mutations++;record=fn(clone(record));return clone(record)},
  async writeJson(){writes++},
  pickupHistory:r=>r.pickupHistory||[],pickupComplete:r=>r.complete===true,
  now:()=> '2026-10-23T13:00:00Z',publicRecord:r=>({status:r.status,complete:r.complete,remainingPickupCollis:r.remainingPickupCollis}),
  err(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e}
 };
 const handler=load({'../shared/public-access-store':access,'../shared/pickup-store':store,'../shared/fast-auth-store':auth,'../shared/i18n':{t:()=>''}});
 return{async run(body){const ctx={log:{error(){}},res:null};await handler(ctx,{method:'POST',body});return{status:ctx.res.status,body:JSON.parse(ctx.res.body)}},
 get record(){return record},get writes(){return writes},get mutations(){return mutations}};
}
const confirmed=()=>({
 accessKey:'a'.repeat(64),environment:'production',shipmentId:'ID-1',reference:'ETJUHL',
 rows:[{count:2}],expectedColliCount:2,status:'confirmed',complete:true,
 confirmedAt:'2026-10-22T10:20:00Z',pickupHistory:[{sequence:2,confirmedAt:'2026-10-22T10:20:00Z',signatureBlobName:'original-sig.png',colliCount:2}],
 pickupSequence:2,signatureBlobName:'original-sig.png',podFiles:[{id:'pod1',blobName:'original-pod.pdf',hash:'proofhash'}],collectedPickupCollis:2
});

test('P0: locked shipment with no editor colli rows resets using stored authoritative quantity',async()=>{
 const f=fixture(confirmed());
 const result=await f.run({shipment:{id:'ID-1',reference:'ETJUHL'},resetPickup:true,resetReason:'Unbestätigter Fehlscan'});
 assert.equal(result.status,200);
 assert.equal(f.record.status,'open');
 assert.equal(f.record.remainingPickupCollis,2);
 assert.deepEqual(f.record.rows,[{count:2}]);
 assert.equal(f.record.pickupResetHistory[0].previousPickupProofs[0].signatureBlobName,'original-sig.png');
 assert.equal(f.record.pickupResetHistory[0].previousPodFiles[0].blobName,'original-pod.pdf');
 assert.equal(f.record.pickupSequence,2);
});

test('P0: missing original QR record fails closed rather than creating false successful reset',async()=>{
 const f=fixture(null);
 const result=await f.run({shipment:{id:'ID-1',reference:'ETJUHL'},resetPickup:true});
 assert.equal(result.status,409);
 assert.equal(result.body.code,'PICKUP_RESET_RECORD_NOT_FOUND');
 assert.equal(f.writes,0);assert.equal(f.mutations,0);
});

test('P0: a different QR record cannot be accidentally reset for this shipment',async()=>{
 const record=confirmed();record.reference='ANOTHER';
 const f=fixture(record);
 const result=await f.run({shipment:{id:'ID-1',reference:'ETJUHL'},resetPickup:true});
 assert.equal(result.status,409);
 assert.equal(result.body.code,'PICKUP_RESET_REFERENCE_MISMATCH');
 assert.equal(f.record.status,'confirmed');
 assert.equal(f.mutations,0);
});

test('P0: regular new QR initialization still requires colli rows',async()=>{
 const f=fixture(null);
 const result=await f.run({shipment:{id:'ID-1',reference:'ETJUHL'}});
 assert.equal(result.status,400);
 assert.equal(result.body.code,'COLLI_REQUIRED');
 assert.equal(f.writes,0);
});
