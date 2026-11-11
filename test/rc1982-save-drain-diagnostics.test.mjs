import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');
const fnStart=source.indexOf('async function rc1982DrainSnapshot(page){');
const fnEnd=source.indexOf('\n\nexport async function settleStateSave(',fnStart);
assert.ok(fnStart>=0&&fnEnd>fnStart,'RC1982 diagnostic function missing');
const extracted=source.slice(fnStart,fnEnd);

function diagnostic(runtime){
  const fn=vm.runInNewContext(extracted+'\nrc1982DrainSnapshot;', {
    window:{ExportHUBClean:{runtime}}
  });
  return fn({evaluate:cb=>Promise.resolve(cb())});
}

test('RC1982: saving/pending/generation evidence is returned without payload data',async()=>{
  const result=await diagnostic({
    saving:true,pendingSave:true,dirty:true,saveTimer:12,
    changeGeneration:18,lastSavedGeneration:17,activeSaveGeneration:18,
    lastServerSaveAckGeneration:17,network:{posts:5},lastSaveMs:8200,
    lastSaveErrorCode:'STATE_API_UNREACHABLE',
    token:'SHOULD_NOT_LOG',customerEmail:'private@example.test'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{
    saving:true,pending:true,dirty:true,hasTimer:true,
    changedGeneration:18,savedGeneration:17,activeSaveGeneration:18,
    serverAckGeneration:17,networkSaveRequests:5,saveElapsedMs:null,lastSaveMs:8200,
    lastErrorCode:'STATE_API_UNREACHABLE'
  });
  const output=JSON.stringify(result);
  assert.doesNotMatch(output,/SHOULD_NOT_LOG|private@example/);
});

test('RC1982: unknown, freeform and potentially sensitive error messages are not logged',async()=>{
  const result=await diagnostic({
    saving:false,pendingSave:true,dirty:false,saveTimer:null,
    changeGeneration:9,lastSavedGeneration:8,
    lastSaveErrorCode:'HTTP 500 private@example.test',
    lastSaveErrorMessage:'Password and shipment contents must never appear in test log'
  });
  assert.equal(result.lastErrorCode,'UNRECOGNIZED');
  assert.equal(result.serverAckGeneration,null);
  assert.equal(result.networkSaveRequests,null);
  assert.doesNotMatch(JSON.stringify(result),/example.test|Password|shipment contents/);
});

test('RC1982: missing counters cannot be represented as a successful zero ACK',async()=>{
  const result=await diagnostic({
    saving:true,changeGeneration:null,lastSavedGeneration:undefined,
    activeSaveGeneration:'',lastServerSaveAckGeneration:null,
    network:{posts:null},lastSaveMs:false
  });
  for(const key of ['changedGeneration','savedGeneration','activeSaveGeneration','serverAckGeneration','networkSaveRequests','lastSaveMs']){
    assert.equal(result[key],null,key+' must remain unknown');
  }
  const genuineZero=await diagnostic({lastServerSaveAckGeneration:0,network:{posts:0}});
  assert.equal(genuineZero.serverAckGeneration,0);
  assert.equal(genuineZero.networkSaveRequests,0);
});

test('RC1982: even well-formed unapproved error codes are redacted',async()=>{
  const result=await diagnostic({lastSaveErrorCode:'CUSTOMER_PRIVATE_REFERENCE'});
  assert.equal(result.lastErrorCode,'UNRECOGNIZED');
  assert.doesNotMatch(JSON.stringify(result),/CUSTOMER_PRIVATE_REFERENCE/);
});

test('RC1982: missing live runtime is an error, never a successful save',async()=>{
  const start=source.indexOf('export async function settleStateSave(');
  const end=source.indexOf('\n\n// RC1579:',start);
  assert.ok(start>=0&&end>start,'live-save helper must be present');
  const statement=source.slice(start,end).replace('export async function settleStateSave(', 'async function settleStateSave(');
  const settle=vm.runInNewContext(statement+'\nsettleStateSave',{
    process:{env:{EXPORTHUB_E2E_LIVE:'1'}},window:{},Date,Promise
  });
  await assert.rejects(settle({evaluate:cb=>Promise.resolve(cb())},{timeout:3000}),/ExportHUBClean-Runtime nicht verfügbar/);
});

test('RC1982: missing flushSave can never look like an idle successful Azure save',async()=>{
  const start=source.indexOf('export async function settleStateSave(');
  const end=source.indexOf('\n\n// RC1579:',start);
  assert.ok(start>=0&&end>start);
  const statement=source.slice(start,end).replace('export async function settleStateSave(', 'async function settleStateSave(');
  const settle=vm.runInNewContext(statement+'\nsettleStateSave',{
    process:{env:{EXPORTHUB_E2E_LIVE:'1'}},
    window:{ExportHUBClean:{runtime:{saving:false,pendingSave:false,dirty:false,saveTimer:null}}},
    Date,Promise
  });
  await assert.rejects(settle({evaluate:cb=>Promise.resolve(cb())},{timeout:3000}),/ExportHUBClean-flushSave nicht verfügbar/);
});

test('RC1982: idle flags cannot mask a locally unsaved generation or missing Azure ACK',async()=>{
  const start=source.indexOf('export async function settleStateSave(');
  const end=source.indexOf('\n\n// RC1579:',start);
  assert.ok(start>=0&&end>start);
  const statement=source.slice(start,end).replace('export async function settleStateSave(','async function settleStateSave(');
  for(const state of [
    {changeGeneration:2,lastSavedGeneration:1,lastServerSaveAckGeneration:2},
    {changeGeneration:2,lastSavedGeneration:2,lastServerSaveAckGeneration:1}
  ]){
    let clock=0;
    const FakeDate=class extends Date{static now(){clock+=1000;return clock}};
    const runtime={saving:false,pendingSave:false,dirty:false,saveTimer:null,...state};
    const context={
      process:{env:{EXPORTHUB_E2E_LIVE:'1'}},
      window:{ExportHUBClean:{runtime,flushSave:()=>true}},
      Date:FakeDate,Number,Math,JSON,Promise,pause:async()=>{}
    };
    const settle=vm.runInNewContext(extracted+'\n'+statement+'\nsettleStateSave',context);
    await assert.rejects(
      settle({evaluate:fn=>Promise.resolve(fn())},{timeout:3000,stableMs:200}),
      /Azure-Speicherung blieb vor Browser-Navigation aktiv/,
      'inconsistent generation counters must not report a successful save'
    );
  }
});

test('RC1171: idle UI with lagging Azure ACK triggers exactly one flush and requires fresh ACK',async()=>{
  const start=source.indexOf('export async function settleStateSave(');
  const end=source.indexOf('\n\n// RC1579:',start);
  const statement=source.slice(start,end).replace('export async function settleStateSave(','async function settleStateSave(');
  const runtime={saving:false,pendingSave:false,dirty:false,saveTimer:null,
    changeGeneration:3,lastSavedGeneration:3,lastServerSaveAckGeneration:1};
  let calls=0,clock=0;
  const FakeDate=class extends Date{static now(){clock+=1000;return clock}};
  const clean={runtime,flushSave:async(_reason,options)=>{
    calls++;
    assert.equal(options.force,true);
    assert.equal(options.userInitiated,true);
    runtime.lastServerSaveAckGeneration=3;
    return true;
  }};
  const context={process:{env:{EXPORTHUB_E2E_LIVE:'1'}},
    window:{ExportHUBClean:clean},Date:FakeDate,Number,Math,JSON,Promise,pause:async()=>{}};
  const settle=vm.runInNewContext(extracted+'\n'+statement+'\nsettleStateSave',context);
  const result=await settle({evaluate:fn=>Promise.resolve(fn())},{timeout:3000,stableMs:200});
  assert.equal(calls,1,'Only one controlled Azure flush is permitted');
  assert.equal(result.unconfirmedGeneration,false,'Fresh Azure ACK is required');
});

test('RC1982: diagnostic collection fails closed and never approves a save',async()=>{
  const fn=vm.runInNewContext(extracted+'\nrc1982DrainSnapshot;',{window:{}});
  const result=await fn({evaluate:()=>Promise.reject(Error('browser closed'))});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{unavailable:true});
  assert.match(source,/if\(result&&result\.timeout\)\{const snapshot=await rc1982DrainSnapshot\(page\);throw new Error\('Azure-Save Drain Timeout: '\+JSON\.stringify\(snapshot\)\);\}/);
  assert.match(source,/Promise\.resolve\(clean\.flushSave\(/);
  assert.match(source,/if\(result&&result\.ok!==true\)/);
  assert.ok(source.includes("throw new Error('Azure-Speicherung konnte vor Browser-Navigation nicht bestätigt werden: '+JSON.stringify(snapshot));"),'Rejected saves must log only sanitized state without approving persistence');
  assert.ok(!source.includes("String(r.lastSaveErrorMessage||'')"),'Free-form backend error message must never enter CI failure diagnostics');
  assert.ok(!source.includes('lastErrorMessage:String(runtime.lastSaveErrorMessage'),'No freeform error message may cross the browser boundary');
  assert.ok(!source.includes('error:String(error&&error.message||error)'),'Save exceptions must not cross the browser boundary');
  assert.match(source,/const finalState=await rc1982DrainSnapshot\(page\)/);
});
