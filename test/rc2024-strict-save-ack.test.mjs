import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {patchRc2024StrictSaveAckHtml} from '../scripts/rc2024-strict-save-ack.mjs';
import {patchRc1982MetaDeltaHtml} from '../scripts/rc1982-save-meta-delta.mjs';

const original=fs.readFileSync('index.html','utf8');
const hardened=patchRc1982MetaDeltaHtml(original);
const start=hardened.indexOf('const confirmed=serverAck||(');
const end=hardened.indexOf(';if(!confirmed){runtime.dirty=true;runtime.pendingSave=true;',start);
assert.ok(start>0&&end>start,'The built saver must guard false acknowledgements and preserve pending deltas');
const expression=hardened.slice(start+'const confirmed='.length,end);
const contextBase={
 Array,
 isObject:value=>value!==null&&typeof value==='object'&&!Array.isArray(value),
 criticalSaveDeltaConfirmed:()=>true,
 syncedCollectionsContainDelta:()=>true
};
function confirmed({serverAck=false,stateDelta={shipments:[{id:'S1'}]},authoritative={state:{shipments:[{id:'S1'}]}}}={}){
 const ctx={...contextBase,serverAck,stateDelta,authoritative};
 return Boolean(vm.runInNewContext(expression,ctx));
}

test('RC2024: valid Azure server ACK still approves actual changes',()=>{
 assert.equal(confirmed({serverAck:true}),true);
 assert.equal(confirmed({serverAck:true,authoritative:null}),true);
});

test('RC2024: no customer changes never imply persisted shipment, ABD or pack state',()=>{
 for(const key of ['shipments','savedShipments','abdRequests','packNotifications','shipmentDocuments','tasks']){
  const stateDelta={[key]:[{id:'REC-1'}]};
  assert.equal(confirmed({serverAck:false,stateDelta}),false,key+' cannot use a customer-only predicate');
 }
 assert.equal(confirmed({serverAck:false,stateDelta:{}}),false);
 assert.equal(confirmed({serverAck:false,stateDelta:{_teamSyncMeta:{tombstones:[{id:'deleted'}]}}}),false);
});

test('RC2024: customer fallback needs actual remote evidence, not synthesized client copy',()=>{
 const stateDelta={customers:[{id:'C1'}],shipments:[{id:'S1'}]};
 assert.equal(confirmed({stateDelta,authoritative:{clientSaveAck:true,state:{}}}),false);
 assert.equal(confirmed({stateDelta,authoritative:null}),false);
 assert.equal(confirmed({stateDelta,authoritative:{state:{customers:[{id:'C1'}],shipments:[]}}}),true,
   'A full remote result may be accepted only when the actual collection matcher confirms it');
 const ctx={...contextBase,serverAck:false,stateDelta,
  authoritative:{state:{customers:[{id:'C1'}],shipments:[]}},syncedCollectionsContainDelta:()=>false};
 assert.equal(Boolean(vm.runInNewContext(expression,ctx)),false,'partial remote collection must fail closed');
});

test('RC2024: failed confirmation retains local dirty delta for idempotent retry',()=>{
 assert.match(hardened,/if\(!confirmed\)\{runtime\.dirty=true;runtime\.pendingSave=true;/);
 assert.doesNotMatch(hardened,/if\(!confirmed\)\{rebaseLiveStateFromRemote\(authoritative,baseBefore,currentLive\)/);
 assert.match(hardened,/e\.code='SAVE_NOT_CONFIRMED';throw e/);
 assert.match(hardened,/runtime\.lastSavedGeneration=generation;/);
 assert.ok(hardened.indexOf("if(!confirmed){")<hardened.indexOf("runtime.lastSavedGeneration=generation;"),
   'The durable local success counter follows a positive confirmation only');
});

test('RC2024: three-environment build inherits guard and patch is idempotent/fail-closed',()=>{
 const script=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(script,/patchRc1982MetaDeltaHtml\(rc1718Printed\.replace\(/);
 const patcher=fs.readFileSync('scripts/rc1982-save-meta-delta.mjs','utf8');
 assert.match(patcher,/patchRc2024StrictSaveAckHtml\(html\.replace\(BEFORE,AFTER\)/);
 assert.equal(patchRc2024StrictSaveAckHtml(hardened),hardened);
 assert.equal(patchRc1982MetaDeltaHtml(hardened),hardened);
 assert.throws(()=>patchRc2024StrictSaveAckHtml(original.replace(
  'const confirmed=serverAck||criticalSaveDeltaConfirmed(authoritative&&authoritative.state,stateDelta);',
  'const confirmed=serverAck||unverifiedNewCondition(authoritative);'
 )),/RC2024 save confirmation anchor missing or ambiguous/);
 assert.equal(patchRc2024StrictSaveAckHtml('<html>Demo without authenticated saver</html>','demo.html'),
  '<html>Demo without authenticated saver</html>');
});
