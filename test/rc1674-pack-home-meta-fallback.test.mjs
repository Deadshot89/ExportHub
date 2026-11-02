import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const pack=fs.readFileSync('assets/pack-notification.js','utf8');
const state=fs.readFileSync('api/exporthub-state/index.js','utf8');

function extract(source,startToken,endToken,context){
 const start=source.indexOf(startToken),end=source.indexOf(endToken,start+startToken.length);
 assert.ok(start>=0&&end>start,'RC1674 runtime function not found: '+startToken);
 return vm.runInNewContext(source.slice(start,end)+'\n'+startToken.split('(')[0].replace(/^async function /,'').replace(/^function /,''),context);
}

test('RC1674: authorized read-only QR validation opens home without waiting for optional packaging',async()=>{
 const els={home:{hidden:true},loading:{hidden:false}};
 let releasePackaging,reads=0,sessionCalls=0,packagingCalled=false;
 const pendingPackaging=new Promise(resolve=>{releasePackaging=resolve});
 const context={
  clearError(){},state:{stationToken:''},tokenFromPath:()=> 'E2E-PACK-SAFE',
  ensureSession:async()=>{sessionCalls++;throw Error('SESSION_UNAVAILABLE')},
  loadDrafts:async()=>{reads++},
  loadPackagingMaster:async()=>{packagingCalled=true;await pendingPackaging},
  showHome:async(verified)=>{assert.equal(verified,true);els.home.hidden=false},
  els,showError:()=>{throw Error('unexpected UI error')},tr:()=> 'error'
 };
 const start=extract(pack,'async function startPage(){','\n  async function submit(',context);
 const action=start();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(reads,1,'QR token is checked through the read-only draft endpoint');
 assert.equal(sessionCalls,0,'home must not attempt writing a new session');
 assert.equal(els.home.hidden,false,'authorized home appears before optional packaging finishes');
 assert.equal(els.loading.hidden,true);
 assert.equal(packagingCalled,true);
 releasePackaging();
 await action;
});

test('RC1674: failed read-only QR validation stays fail-closed even if no session has been requested',async()=>{
 const els={home:{hidden:true},loading:{hidden:false}};
 let error='',optionalCalled=false,sessionCalls=0;
 const context={
  clearError(){},state:{stationToken:''},tokenFromPath:()=> 'INVALID-PACK-QR',
  ensureSession:async()=>{sessionCalls++;throw Error('SESSION_UNAVAILABLE')},
  loadDrafts:async()=>{throw Error('PACK_STATION_INVALID')},
  loadPackagingMaster:async()=>{optionalCalled=true},
  showHome:async()=>{els.home.hidden=false},els,
  showError:value=>{error=value},tr:()=> 'error'
 };
 const start=extract(pack,'async function startPage(){','\n  async function submit(',context);
 await start();
 assert.equal(els.home.hidden,true,'invalid QR must never be shown as a valid home');
 assert.equal(els.loading.hidden,true);
 assert.equal(optionalCalled,false);
 assert.equal(sessionCalls,0,'invalid QR should not create a write session');
 assert.equal(error,'PACK_STATION_INVALID');
});

function metadata(blob){
 const context={
  readJson:async(b)=>b.read(),
  emptyTeam:()=>({schemaVersion:3,revision:0,updatedAt:null,clientVersion:null}),
  error:(code,message,status)=>Object.assign(new Error(message),{code,status})
 };
 return extract(state,'async function metadataOnly(blob){','\nfunction normalizeIncoming(',context)(blob);
}

test('RC1674: transient Azure HEAD 500 falls back to one read-only metadata GET',async()=>{
 let heads=0,gets=0;
 const result=await metadata({
  getProperties:async()=>{heads++;throw Object.assign(new Error('Azure HEAD unavailable'),{statusCode:500})},
  read:async()=>{gets++;return{value:{schemaVersion:3,revision:42,updatedAt:'2026-10-26T10:00:00Z',clientVersion:'RC1674'}}}
 });
 assert.equal(heads,1);
 assert.equal(gets,1);
 assert.equal(result.revision,42);
 assert.equal(result.clientVersion,'RC1674');
});

test('RC1674: successful metadata HEAD stays cheap with no content download',async()=>{
 let gets=0;
 const result=await metadata({
  getProperties:async()=>({metadata:{schema:'3',revision:'17',clientversion:'RC1112',updatedepoch:'1793000000000'}}),
  read:async()=>{gets++;throw Error('GET not allowed')}
 });
 assert.equal(result.revision,17);
 assert.equal(gets,0);
});

test('RC1674: auth/storage 403 and persistent read failures remain errors',async()=>{
 let gets=0;
 await assert.rejects(metadata({
  getProperties:async()=>{throw Object.assign(new Error('Forbidden'),{statusCode:403})},
  read:async()=>{gets++;return{value:{revision:99}}}
 }),err=>err.statusCode===403);
 assert.equal(gets,0,'No content fallback on permissions failure');
 await assert.rejects(metadata({
  getProperties:async()=>{throw Object.assign(new Error('HEAD broken'),{statusCode:503})},
  read:async()=>{throw Object.assign(new Error('GET broken'),{statusCode:503})}
 }),err=>err.statusCode===503,'Persistent backend failure must block release');
});


test('RC1674: HEAD 500 followed by GET 404 must not report successful revision zero',async()=>{
 let gets=0;
 await assert.rejects(metadata({
  getProperties:async()=>{throw Object.assign(new Error('HEAD unavailable'),{statusCode:500})},
  // readJson represents Azure Blob GET 404 with the empty fallback and no ETag.
  read:async()=>{gets++;return{value:{schemaVersion:3,revision:0},bytes:0,etag:null}}
 }),err=>err.code==='STATE_METADATA_READ_UNAVAILABLE'&&err.status===503);
 assert.equal(gets,1,'a missing team blob is never retried or reported as valid');
});

test('RC1674: HEAD without revision metadata performs only one GET even on a transient GET failure',async()=>{
 let gets=0;
 await assert.rejects(metadata({
  getProperties:async()=>({metadata:{},lastModified:new Date('2026-10-26T10:00:00Z')}),
  read:async()=>{gets++;throw Object.assign(new Error('Azure GET unavailable'),{statusCode:503})}
 }),err=>err.statusCode===503);
 assert.equal(gets,1,'a failed GET must not cause a second whole-blob read');
});

test('RC1674: transient HEAD failure plus persistent GET failure performs exactly one fallback',async()=>{
 let gets=0;
 await assert.rejects(metadata({
  getProperties:async()=>{throw Object.assign(new Error('Transient HEAD failure'),{statusCode:502})},
  read:async()=>{gets++;throw Object.assign(new Error('Persistent GET failure'),{statusCode:503})}
 }),err=>err.statusCode===503);
 assert.equal(gets,1);
});
