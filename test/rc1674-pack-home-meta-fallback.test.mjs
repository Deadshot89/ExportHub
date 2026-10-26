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

test('RC1674: QR home becomes visible even while optional draft-list and packaging reads are pending',async()=>{
 const els={home:{hidden:true},loading:{hidden:false}};
 let unblockDraft,packagingCalled=false;
 const pendingDraft=new Promise(resolve=>{unblockDraft=resolve});
 const context={
  clearError(){},state:{stationToken:''},tokenFromPath:()=> 'E2E-PACK-SAFE',
  ensureSession:async()=>{},loadPackagingMaster:async()=>{packagingCalled=true},
  showHome:async()=>{els.home.hidden=false;await pendingDraft},
  els,showError:()=>{throw Error('unexpected UI error')},tr:()=> 'error'
 };
 const start=extract(pack,'async function startPage(){','\n  async function submit(',context);
 const action=start();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(els.home.hidden,false,'Optional reads must not keep QR home hidden');
 assert.equal(els.loading.hidden,true,'Session creation finished, loading state is cleared');
 assert.equal(packagingCalled,false,'Packaging read must not block initial home render');
 unblockDraft();
 await action;
 assert.equal(packagingCalled,true,'Packaging master still loads after home appears');
});

test('RC1674: a failed mandatory Pack station session never becomes a valid home',async()=>{
 const els={home:{hidden:true},loading:{hidden:false}};
 let error='',optionalCalled=false;
 const context={
  clearError(){},state:{stationToken:''},tokenFromPath:()=> 'E2E-PACK-SAFE',
  ensureSession:async()=>{throw Error('SESSION_UNAVAILABLE')},
  loadPackagingMaster:async()=>{optionalCalled=true},
  showHome:async()=>{els.home.hidden=false},els,
  showError:value=>{error=value},tr:()=> 'error'
 };
 const start=extract(pack,'async function startPage(){','\n  async function submit(',context);
 await start();
 assert.equal(els.home.hidden,true,'Mandatory session failure must stay fail-closed');
 assert.equal(els.loading.hidden,true);
 assert.equal(optionalCalled,false);
 assert.equal(error,'SESSION_UNAVAILABLE');
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
