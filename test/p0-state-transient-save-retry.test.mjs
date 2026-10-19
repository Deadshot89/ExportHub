import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {isDeepStrictEqual} from 'node:util';

const require=createRequire(import.meta.url);
const {isTransientStorageWriteError}=require('../api/shared/state-save-retry.js');
const source=fs.readFileSync('api/exporthub-state/index.js','utf8');
const start=source.indexOf('async function saveMerged(');
const end=source.indexOf('/* RC614:',start);
assert.ok(start>=0&&end>start,'saveMerged is needed for this regression test');
const saveBlock=source.slice(start,end);

test('P0: only temporary Azure and network write errors qualify for retry',()=>{
  for(const statusCode of [408,429,500,502,503,504])
    assert.equal(isTransientStorageWriteError({statusCode}),true,String(statusCode));
  for(const code of ['ECONNRESET','ETIMEDOUT','EAI_AGAIN'])
    assert.equal(isTransientStorageWriteError({code}),true,code);
  for(const statusCode of [400,401,403,409,412,422])
    assert.equal(isTransientStorageWriteError({statusCode}),false,String(statusCode));
  assert.equal(isTransientStorageWriteError({statusCode:403,code:'ECONNRESET'}),false);
  assert.equal(isTransientStorageWriteError({code:'STORAGE_JSON_INVALID'}),false);
});

function fixture(failure,{afterCommit=false,alreadySaved=false,remoteChanged=false,optimistic=false,operationSeen=false,slowClock=false}={}){
  const empty=()=>({schemaVersion:3,revision:1,users:[],state:{},recentOperations:[]});
  const initial=empty();
  if(alreadySaved)initial.state={customers:[{id:'C-1',name:'Kunde'}]};
  if(operationSeen)initial.recentOperations=[{id:'op-123',revision:1}];
  let document=structuredClone(initial),etag='etag-1',uploads=0,reads=0,heads=0;
  if(remoteChanged){document.revision=2;document.state.settings={serverOnly:true};document.recentOperations=[];etag='etag-2'}
  const error=(code,message,status,vars)=>Object.assign(new Error(message),{code,status,vars});
  const context={
    emptyTeam:empty,MAX_RETRIES:12,CONFLICT_BACKOFF_BASE_MS:12,
    MAX_TRANSIENT_SAVE_RETRIES:2,MAX_TRANSIENT_SAVE_RETRY_WINDOW_MS:15000,TRANSIENT_SAVE_BACKOFF_BASE_MS:150,
    sleep:async()=>{},
    clone:value=>structuredClone(value),
    readJson:async()=>{reads++;return {value:structuredClone(document),etag}},
    validateWriteUserAgainstTeam:(_current,user)=>user,
    text:value=>String(value??'').trim(),
    compactStateForStorage:value=>value,
    pruneTombstones:value=>value,
    mergeState:(current,incoming)=>structuredClone({...current,...incoming}),
    rc1080AuditCustomerChanges:()=>{},
    enrichDynamicTranslations:async()=>({}),
    normalizeDynamicLanguage:()=> 'de',
    storageStateEquivalent:isDeepStrictEqual,
    now:()=>new Date().toISOString(),
    isStorageWriteConflict:e=>[409,412].includes(Number(e&&e.statusCode)),
    isTransientStorageWriteError,
    error,
    Buffer,
    process:{env:{}},
    Date:slowClock?{now:(()=>{let call=0;return ()=>++call===1?0:20000})()}:Date,
    uploadJson:async(_blob,next)=>{
      uploads++;
      if(uploads===1&&failure){
        if(afterCommit){document=structuredClone(next);etag='etag-2'}
        throw Object.assign(new Error('Azure write response unavailable'),failure);
      }
      if(failure&&uploads<=Number(failure.failCount||1))
        throw Object.assign(new Error('Azure still unavailable'),failure);
      document=structuredClone(next);etag='etag-'+(uploads+1);
      return {etag,bytes:256};
    }
  };
  const saveMerged=vm.runInNewContext(saveBlock+'\nsaveMerged',context);
  const blob={getProperties:async()=>{heads++;return {etag}}};
  const save=()=>saveMerged(blob,{
    state:{customers:[{id:'C-1',name:'Kunde'}]},
    operationId:'op-123',baseRevision:1,deviceId:'test'
  },{id:'U-1',name:'Tester',language:'de'},initial,'etag-1',{},optimistic);
  return {save,counts:()=>({uploads,reads,heads,document})};
}

test('P0: transient Azure 503 retries with a fresh state read, then confirms the save',async()=>{
  const f=fixture({statusCode:503});
  const saved=await f.save();
  assert.equal(saved.revision,2);
  assert.equal(f.counts().uploads,2);
  assert.equal(f.counts().reads,1,'read Azure again before repeating an ambiguous upload');
  assert.equal(f.counts().document.state.customers[0].id,'C-1');
});

test('P0: lost Azure acknowledgement does not create a second logical write',async()=>{
  const f=fixture({code:'ECONNRESET'},{afterCommit:true});
  const saved=await f.save();
  assert.equal(saved.idempotentReplay,true);
  assert.equal(saved.revision,2);
  assert.equal(f.counts().uploads,1);
  assert.equal(f.counts().reads,1);
});

test('P0: authorization errors never retry, and persistent Azure failure remains unconfirmed',async()=>{
  const denied=fixture({statusCode:403});
  await assert.rejects(denied.save(),error=>error.statusCode===403);
  assert.equal(denied.counts().uploads,1);
  assert.equal(denied.counts().reads,0);

  const down=fixture({statusCode:503,failCount:10});
  await assert.rejects(down.save(),error=>error.code==='STORAGE_UNREACHABLE'&&error.status===503);
  assert.equal(down.counts().uploads,3);
  assert.equal(down.counts().reads,2);
});

test('P0: optimistic cached no-op must check Azure ETag before claiming persistence',async()=>{
  const f=fixture(null,{alreadySaved:true,optimistic:true});
  const saved=await f.save();
  assert.equal(saved.noopSave,true);
  assert.equal(saved.revision,1);
  assert.equal(f.counts().heads,1);
  assert.equal(f.counts().uploads,0);
  assert.equal(f.counts().reads,0);
});

test('P0: stale optimistic no-op must read current Azure state, not ACK the cache',async()=>{
  const f=fixture(null,{alreadySaved:true,remoteChanged:true,optimistic:true});
  const saved=await f.save();
  assert.equal(saved.noopSave,true);
  assert.equal(saved.revision,2);
  assert.equal(saved.state.settings.serverOnly,true);
  assert.equal(f.counts().heads,1);
  assert.equal(f.counts().reads,1);
  assert.equal(f.counts().uploads,0);
});

test('P0: optimistic cache must not replay an operation absent from current Azure',async()=>{
  const f=fixture(null,{alreadySaved:true,remoteChanged:true,optimistic:true,operationSeen:true});
  const saved=await f.save();
  assert.notEqual(saved.idempotentReplay,true,'stale cache operationId must be rechecked');
  assert.equal(saved.revision,2);
  assert.equal(f.counts().heads,1);
  assert.equal(f.counts().reads,1);
  assert.equal(f.counts().uploads,0);
});
test('P0: optimistic cache may replay an operation only after matching Azure ETag',async()=>{
  const f=fixture(null,{alreadySaved:true,optimistic:true,operationSeen:true});
  const saved=await f.save();
  assert.equal(saved.idempotentReplay,true);
  assert.equal(f.counts().heads,1);
  assert.equal(f.counts().reads,0);
  assert.equal(f.counts().uploads,0);
});

test('P0: slow Azure timeout cannot trigger an additional cascade of full retries',async()=>{
  const slow=fixture({statusCode:503,failCount:10},{slowClock:true});
  await assert.rejects(slow.save(),error=>error.code==='STORAGE_UNREACHABLE'&&error.status===503);
  assert.equal(slow.counts().uploads,1,'already timed-out Azure writes must not be multiplied');
  assert.equal(slow.counts().reads,0);
});
