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

test('RC1982: diagnostic collection fails closed and never approves a save',async()=>{
  const fn=vm.runInNewContext(extracted+'\nrc1982DrainSnapshot;',{window:{}});
  const result=await fn({evaluate:()=>Promise.reject(Error('browser closed'))});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{unavailable:true});
  assert.match(source,/if\(result&&result\.timeout\)\{const snapshot=await rc1982DrainSnapshot\(page\);throw new Error\('Azure-Save Drain Timeout: '\+JSON\.stringify\(snapshot\)\);\}/);
  assert.match(source,/Promise\.resolve\(clean\.flushSave\(/);
  assert.match(source,/if\(result&&result\.ok!==true\)/);
  assert.ok(source.includes("throw new Error('Azure-Speicherung konnte vor Browser-Navigation nicht bestätigt werden: '+JSON.stringify(snapshot));"),'Rejected saves must log only sanitized state without approving persistence');
  assert.ok(!source.includes("String(r.lastSaveErrorMessage||'')"),'Free-form backend error message must never enter CI failure diagnostics');
  assert.match(source,/const finalState=await rc1982DrainSnapshot\(page\)/);
});
