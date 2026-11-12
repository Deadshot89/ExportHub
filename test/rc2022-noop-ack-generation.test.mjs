import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {patchRc2022NoopAckHtml} from '../scripts/rc2022-noop-ack-generation.mjs';

const original=fs.readFileSync('index.html','utf8');
const patched=patchRc2022NoopAckHtml(original,'index.html');
const start=patched.indexOf('function finishNoChangeSave(reason,generation){');
const end=patched.indexOf('\nfunction azureNetworkFailure(',start);
assert.ok(start>=0&&end>start,'RC2022 no-op save must exist');
const functionBody=patched.slice(start,end);

function callNoChange(runtime,generation,env='testservice'){
 const sandbox={
  runtime,Number,Math,Date,String,
  lower:x=>String(x??'').toLowerCase(),
  DATA_ENVIRONMENT:env,
  by:()=>null
 };
 const fn=vm.runInNewContext(functionBody+'\nfinishNoChangeSave',sandbox);
 return fn('RC2022 no-op',generation);
}

function verifiedRuntime(){
 return {
  changeGeneration:2,lastSavedGeneration:1,lastServerSaveAckGeneration:1,
  lastServerSaveAckEnvironment:'testservice',lastServerSaveAckRevision:24,
  revision:24,pendingSave:true,dirty:true,noChangeSaveSkips:0
 };
}

test('RC2022: verified Azure ACK may follow sequential no-op generations',()=>{
 const runtime=verifiedRuntime();
 assert.equal(callNoChange(runtime,2),true);
 assert.equal(runtime.lastSavedGeneration,2);
 assert.equal(runtime.lastServerSaveAckGeneration,2);
 assert.equal(runtime.pendingSave,false);
 assert.equal(runtime.dirty,false);
 runtime.changeGeneration=3;runtime.pendingSave=true;runtime.dirty=true;
 assert.equal(callNoChange(runtime,3),true);
 assert.equal(runtime.lastSavedGeneration,3);
 assert.equal(runtime.lastServerSaveAckGeneration,3);
 assert.equal(runtime.noChangeSaveSkips,2);
});

test('RC2022: stale/missing ACK cannot be manufactured by a no-op',()=>{
 for(const props of [
  {lastSavedGeneration:2,lastServerSaveAckGeneration:1},
  {lastSavedGeneration:1,lastServerSaveAckGeneration:0},
  {lastSavedGeneration:1,lastServerSaveAckGeneration:undefined},
  {lastServerSaveAckEnvironment:'production'},
  {lastServerSaveAckRevision:23,revision:24},
  {lastServerSaveAckRevision:undefined}
 ]){
  const runtime={...verifiedRuntime(),...props};
  assert.equal(callNoChange(runtime,3),true);
  assert.equal(runtime.lastSavedGeneration,3);
  assert.equal(runtime.lastServerSaveAckGeneration,Object.prototype.hasOwnProperty.call(props,'lastServerSaveAckGeneration')?props.lastServerSaveAckGeneration:1,
    'A no-op must never manufacture an unverified server ACK');
 }
});

test('RC2022: a production ACK never authorizes a TESTSERVICE no-op, and vice versa',()=>{
 const a=verifiedRuntime();
 assert.equal(callNoChange(a,2,'production'),true);
 assert.equal(a.lastServerSaveAckGeneration,1);
});

test('RC2022: HTML patch stays idempotent and fails closed on source drift',()=>{
 assert.equal(patchRc2022NoopAckHtml(patched,'index.html'),patched);
 assert.throws(()=>patchRc2022NoopAckHtml('not an ExportHUB runtime','index.html'),/RC2022 no-op-save function missing/);
 assert.throws(()=>patchRc2022NoopAckHtml(original.replace(
  'runtime.lastSavedGeneration=Math.max(Number(runtime.lastSavedGeneration||0)',
  'runtime.lastSavedGeneration=INVALID(Math.max(Number(runtime.lastSavedGeneration||0)'
 ),'index.html'),/RC2022 unverified source contract/);
 assert.match(original,/return finishNoChangeSave\(reason,queuedGeneration\)/,
  'This helper must be called only in the no persistent changes branch');
 const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(build,/patchRc2022NoopAckHtml\(patchRc1982MetaDeltaHtml\(/);
 assert.match(build,/for\(const file of \['index.html','TESTVERSION.html','demo.html'\]\)/);
});
