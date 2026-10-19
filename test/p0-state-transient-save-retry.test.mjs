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

function fixture(failure,{afterCommit=false}={}){
  const empty=()=>({schemaVersion:3,revision:1,users:[],state:{},recentOperations:[]});
  let document=empty(),etag='etag-1',uploads=0,reads=0;
  const error=(code,message,status,vars)=>Object.assign(new Error(message),{code,status,vars});
  const context={
    emptyTeam:empty,MAX_RETRIES:12,CONFLICT_BACKOFF_BASE_MS:12,
    MAX_TRANSIENT_SAVE_RETRIES:2,TRANSIENT_SAVE_BACKOFF_BASE_MS:150,
    sleep:async()=>{},
    clone:value=>structuredClone(value),
    readJson:async()=>{reads++;return {value:structuredClone(document),etag}},
    validateWriteUserAgainstTeam:(_current,user)=>user,
    text:value=>String(value??'').trim(),
    compactStateForStorage:value=>value,
    pruneTombstones:value=>value,
    mergeState:(_current,incoming)=>structuredClone(incoming),
    rc1080AuditCustomerChanges:()=>{},
    enrichDynamicTranslations:async()=>({}),
    normalizeDynamicLanguage:()=> 'de',
    storageStateEquivalent:isDeepStrictEqual,
    now:()=>new Date().toISOString(),
    isStorageWriteConflict:e=>[409,412].includes(Number(e&&e.statusCode)),
    isTransientStorageWriteError,
    error,
    Buffer,
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
  const save=()=>saveMerged({},{
    state:{customers:[{id:'C-1',name:'Kunde'}]},
    operationId:'op-123',baseRevision:1,deviceId:'test'
  },{id:'U-1',name:'Tester',language:'de'},empty(),'etag-1',{});
  return {save,counts:()=>({uploads,reads,document})};
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
