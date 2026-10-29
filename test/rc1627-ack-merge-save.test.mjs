import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hardenCustomerSaveHtml} from '../scripts/rc1600-customer-save-readback.mjs';
import {hardenAckMergeSaveHtml,RC1627_PATCH_COUNT} from '../scripts/rc1627-ack-merge-save.mjs';

const html=hardenAckMergeSaveHtml(hardenCustomerSaveHtml(fs.readFileSync('index.html','utf8')));

function confirmCatch(){
  const start=html.indexOf('catch(error){postVerifyError=error;const customerDelta=');
  assert.ok(start>0,'RC1627 confirmation catch is built');
  let depth=0,end=start+'catch(error)'.length;
  for(;end<html.length;end++){if(html[end]==='{')depth++;else if(html[end]==='}'&&--depth===0)break}
  const body=html.slice(start,end+1);
  return new Function('d','stateDelta','runtime','sentState','sentUsers','serverAck',
    'const clone=x=>JSON.parse(JSON.stringify(x));let postVerifyError=null,authoritative=null;try{throw new Error("read timeout")}'+body+'return authoritative');
}

test('RC1627: all patches apply once to the RC1600-hardened build',()=>{
  assert.equal(RC1627_PATCH_COUNT,5);
  assert.ok(html.includes('const newerAfterConfirm=newer||Number(runtime.changeGeneration||0)>generation;'));
  assert.ok(html.includes('if(newerAfterConfirm){rebaseLiveStateFromRemote('));
  assert.ok(html.includes('if(newerAfterConfirm)runtime.followupSaveNeeded=true'));
  assert.ok(html.includes('authoritative.remoteRefreshPending'));
});

test('RC1627: a merged save ack stays durable when the confirmation read times out',()=>{
  const run=confirmCatch();
  const result=run({ok:true,ackOnly:true,concurrentMerge:true,revision:503},{shipments:[{ref:'9Z7L82'}]},{revision:502},{shipments:[{ref:'9Z7L82',abdFiles:[{id:'ABD-1'}]}]},[],true);
  assert.equal(result.serverSaveAck,true);
  assert.equal(result.remoteRefreshPending,true);
  assert.equal(result.revision,502,'keep the old revision so the next poll loads the other writers');
  assert.equal(result.state.shipments[0].abdFiles[0].id,'ABD-1');
});

test('RC1627: customer deltas and unacknowledged merges still require the readback',()=>{
  const run=confirmCatch();
  assert.throws(()=>run({ok:true,ackOnly:true,concurrentMerge:true,revision:503},{customers:[{id:'C1'}]},{revision:502},{},[],true),/read timeout/);
  assert.throws(()=>run({ok:true,concurrentMerge:true,revision:503},{shipments:[{}]},{revision:502},{},[],true),/read timeout/);
  assert.throws(()=>run({ok:true,ackOnly:true,concurrentMerge:true},{shipments:[{}]},{revision:502},{},[],false),/read timeout/);
});

test('RC1627: RC1112 build applies the ack-merge fix after RC1600 for all environments',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(build,/const paginated=patchRc1718PrintIframeHtml\(patchRc1716PodBatchHtml\(patchRc1602PodBrowserHtml\(hardenAckMergeSaveHtml\(hardened\)\),file\),file\)/);
  assert.match(build,/import \{patchRc1716PodBatchHtml\} from '\.\.\/\.\.\/scripts\/rc1716-pod-batch-completeness\.mjs'/);
});
