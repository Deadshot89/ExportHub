import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {patchRc1662SavedShipmentDeltaHtml} from '../scripts/rc1662-abd-saved-shipment-delta.mjs';
const require=createRequire(import.meta.url);
const {mergeState}=require('../api/shared/merge.js');
const source=fs.readFileSync('index.html','utf8');
const patched=patchRc1662SavedShipmentDeltaHtml(source);

function runtime(html){
 const first=html.indexOf('const SYNC_COLLECTION_KEYS=');
 const end=html.indexOf('const LOCAL_UI_KEYS=',first);
 const startFunctions=html.indexOf('function recordKey(',end);
 const stopFunctions=html.indexOf('function persistentStateShapeComplete(',startFunctions);
 assert.ok(first>=0&&end>first&&startFunctions>end&&stopFunctions>startFunctions,'extract actual browser delta writer');
 const context={
  isObject:v=>v!==null&&typeof v==='object'&&!Array.isArray(v),
  lower:v=>String(v??'').trim().toLowerCase(),
  text:v=>String(v??'').trim(),
  sameValue:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
  clone:v=>v===undefined?undefined:structuredClone(v),
  compactInlineBinaryAliases:v=>v,
  isLocalOnlyStateKey:k=>k==='view',
  runtime:{deviceId:'RC1662-TEST',explicitCustomerSaveIds:[]},
  Date,Set,Map,Object,Array,String,JSON
 };
 vm.runInNewContext(html.slice(first,end)+'\n'+html.slice(startFunctions,stopFunctions)+'\nthis.testApi={stampChanges,buildAzureStateDelta}',context);
 return context.testApi;
}
function fixture(){return{
 shipments:[{id:'SHIP-1',ref:'ABC123',status:'Wartet auf ABD'}],
 savedShipments:[
  {id:'SHIP-1',ref:'ABC123',status:'Wartet auf ABD',abdRequired:true,abdFiles:[],customerName:'Customer 1'},
  {id:'SHIP-2',ref:'DEF456',status:'Erstellt',abdFiles:[],customerName:'Customer 2'},
  {id:'SHIP-3',ref:'GHI789',status:'Erstellt',abdFiles:[],customerName:'Customer 3'}
 ],
 abdRequests:[{id:'REQ-1',ref:'ABC123',status:'Angefragt',abdFiles:[]}]
}}
function changedPair(){
 const before=fixture(),after=structuredClone(before);
 after.savedShipments[0].abdFiles.push({id:'ABD-1662',name:'official.pdf',mimeType:'application/pdf',data:'data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y='});
 after.savedShipments[0].abdDone=true;after.savedShipments[0].abdStatus='Abgeschlossen';
 return{before,after};
}

test('RC1662: before patch, all saved shipments were uploaded as one massive array',()=>{
 const {before,after}=changedPair(),api=runtime(source);
 const at=api.stampChanges(before,after,[],[],'ABD als PDF dauerhaft gespeichert');
 const delta=api.buildAzureStateDelta(before,after,at,'ABD als PDF dauerhaft gespeichert');
 assert.equal(delta.savedShipments.length,3,'baseline demonstrably sends all records');
});

test('RC1662: ABD upload transmits only modified saved shipment, not other records',()=>{
 const {before,after}=changedPair(),api=runtime(patched);
 const at=api.stampChanges(before,after,[],[],'ABD als PDF dauerhaft gespeichert');
 const delta=api.buildAzureStateDelta(before,after,at,'ABD als PDF dauerhaft gespeichert');
 assert.equal(delta.savedShipments.length,1);
 assert.equal(delta.savedShipments[0].id,'SHIP-1');
 assert.equal(delta.savedShipments[0].abdDone,true);
 assert.equal(delta.savedShipments[0].abdFiles[0].id,'ABD-1662');
 assert.ok(!Object.hasOwn(delta.savedShipments[0],'customerName'),'unchanged customer master not retransmitted');
 assert.ok(!Object.hasOwn(delta,'shipments'),'unmodified live shipment not re-uploaded');
 const merged=mergeState(before,delta);
 assert.equal(merged.savedShipments.length,3,'server retains all other saved shipments');
 const one=merged.savedShipments.find(x=>x.ref==='ABC123');
 assert.equal(one.abdFiles[0].id,'ABD-1662');
 assert.equal(one.abdStatus,'Abgeschlossen');
 assert.equal(merged.savedShipments.find(x=>x.ref==='DEF456').customerName,'Customer 2');
 assert.equal(merged.shipments[0].status,'Wartet auf ABD','existing status gate untouched');
});

test('RC1662: second ABD never removes existing document or touches another shipment',()=>{
 const {before,after}=changedPair();
 before.savedShipments[0].abdFiles=[{id:'ABD-OLD',name:'old.pdf',status:'active'}];
 after.savedShipments[0].abdFiles.unshift({id:'ABD-OLD',name:'old.pdf',status:'active'});
 const api=runtime(patched),at=api.stampChanges(before,after,[],[],'ABD als PDF dauerhaft gespeichert');
 const delta=api.buildAzureStateDelta(before,after,at,'ABD als PDF dauerhaft gespeichert');
 const merged=mergeState(before,delta),one=merged.savedShipments.find(x=>x.ref==='ABC123');
 assert.deepEqual(one.abdFiles.map(x=>x.id).sort(),['ABD-1662','ABD-OLD']);
 assert.equal(merged.savedShipments.find(x=>x.ref==='DEF456').abdFiles.length,0);
});

test('RC1662: same technical ID with different refs cannot cross-update saved shipments',()=>{
 const before=fixture();
 before.savedShipments[1].id=before.savedShipments[0].id; // historic duplicate editor ID
 const after=structuredClone(before);
 after.savedShipments[0].abdFiles=[{id:'ABD-REF-SAFE',name:'original.pdf'}];
 after.savedShipments[0].abdDone=true;
 const api=runtime(patched),at=api.stampChanges(before,after,[],[],'ABD als PDF dauerhaft gespeichert');
 const delta=api.buildAzureStateDelta(before,after,at,'ABD als PDF dauerhaft gespeichert');
 assert.equal(delta.savedShipments.length,1);
 assert.equal(delta.savedShipments[0].ref,'ABC123');
 assert.equal(delta.savedShipments[0].abdFiles[0].id,'ABD-REF-SAFE');
 const merged=mergeState(before,delta);
 assert.equal(merged.savedShipments.find(x=>x.ref==='ABC123').abdFiles[0].id,'ABD-REF-SAFE');
 assert.equal(merged.savedShipments.find(x=>x.ref==='DEF456').abdFiles.length,0);
 const first=patched.indexOf('function syncRecordSameIdentity('),last=patched.indexOf('function syncFieldSame(',first);
 assert.ok(first>0&&last>first);
 const ctx={SYNC_COLLECTION_KEYS:{savedShipments:['ref','id'],shipments:['id','ref']},lower:v=>String(v??'').toLowerCase()};
 vm.runInNewContext(patched.slice(first,last)+'\nthis.same=syncRecordSameIdentity',ctx);
 assert.equal(ctx.same('savedShipments',{id:'X',ref:'ABC123'},{id:'X',ref:'DEF456'}),false,'never match mismatched refs by recycled ID');
 assert.equal(ctx.same('savedShipments',{id:'X',ref:'ABC123'},{id:'X'}),false,'ref and ID-only must not match');
 assert.equal(ctx.same('savedShipments',{id:'X'},{id:'X'}),true,'legacy ID-only records remain supported');
});

test('RC1662: builder applies the patch to each environment before the existing RC1600/1627 stack',()=>{
 const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(build,/import \{patchRc1662SavedShipmentDeltaHtml\} from '\.\.\/\.\.\/scripts\/rc1662-abd-saved-shipment-delta\.mjs'/);
 assert.match(build,/hardenCustomerSaveHtml\(patchRc1662SavedShipmentDeltaHtml\(fs\.readFileSync\(target,'utf8'\),file\)\)/);
 assert.match(build,/const paginated=patchRc1716PodBatchHtml\(patchRc1602PodBrowserHtml\(hardenAckMergeSaveHtml\(hardened\)\),file\)/);
 assert.match(build,/import \{patchRc1716PodBatchHtml\} from '\.\.\/\.\.\/scripts\/rc1716-pod-batch-completeness\.mjs'/);
 assert.equal(patchRc1662SavedShipmentDeltaHtml(patched),patched,'idempotent');
 assert.throws(()=>patchRc1662SavedShipmentDeltaHtml(source.replace("const SYNC_COLLECTION_KEYS={shipments:['id','ref'],tasks:","const SYNC_COLLECTION_KEYS={shipments:['id','ref'],savedShipments:['ref','id'],tasks:")),/partially applied/,'never ship partial identity hardening');
 assert.throws(()=>patchRc1662SavedShipmentDeltaHtml(source.replace('const SYNC_COLLECTION_KEYS=', 'const OTHER_KEYS=')),/anchor 0x/);
});
