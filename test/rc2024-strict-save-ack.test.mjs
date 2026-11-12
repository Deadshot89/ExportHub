import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {hardenCustomerSaveHtml} from '../scripts/rc1600-customer-save-readback.mjs';
import {hardenAckMergeSaveHtml} from '../scripts/rc1627-ack-merge-save.mjs';
import {patchRc2024StrictSaveAckHtml} from '../scripts/rc2024-strict-save-ack.mjs';
import {patchRc1982MetaDeltaHtml} from '../scripts/rc1982-save-meta-delta.mjs';

const original=fs.readFileSync('index.html','utf8');
const afterRc1600=hardenAckMergeSaveHtml(hardenCustomerSaveHtml(original));
const hardened=patchRc1982MetaDeltaHtml(afterRc1600);
const start=hardened.indexOf('const confirmed=serverAck||(');
const end=hardened.indexOf(';if(!confirmed){runtime.dirty=true;runtime.pendingSave=true;',start);
assert.ok(start>0&&end>start,'RC2024 built saver must preserve unconfirmed data');
const expression=hardened.slice(start+'const confirmed='.length,end);

const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const hasDelta=(remote,delta,name)=>{
 if(!Array.isArray(delta?.[name])||delta[name].length===0)return true;
 if(!Array.isArray(remote?.[name]))return false;
 return delta[name].every(part=>remote[name].some(row=>
  row.id===part.id&&Object.entries(part).every(([k,v])=>JSON.stringify(row[k])===JSON.stringify(v))
 ));
};
const matchingCollections=(remote,delta)=>
 Object.keys(delta||{}).filter(k=>Array.isArray(delta[k])).every(k=>hasDelta(remote,delta,k));
const collectionsStart=original.indexOf('const SYNC_COLLECTION_KEYS=');
const collectionsEnd=original.indexOf(';',collectionsStart);
assert.ok(collectionsStart>=0&&collectionsEnd>collectionsStart,'Actual collection key registry exists');
const SYNC_COLLECTION_KEYS=vm.runInNewContext(
 '('+original.slice(collectionsStart+'const SYNC_COLLECTION_KEYS='.length,collectionsEnd)+')'
);
const sameValue=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const contextBase={
 Array,Object,isObject,SYNC_COLLECTION_KEYS,sameValue,
 criticalSaveDeltaConfirmed:(remote,delta)=>hasDelta(remote,delta,'customers'),
 syncedCollectionsContainDelta:matchingCollections
};
function confirmed({serverAck=false,stateDelta={shipments:[{id:'S1'}]},authoritative={state:{shipments:[{id:'S1'}]}}}={}){
 const ctx={...contextBase,serverAck,stateDelta,authoritative};
 return Boolean(vm.runInNewContext(expression,ctx));
}

test('RC2024: verified Azure server ACK remains sufficient for persisted changes',()=>{
 assert.equal(confirmed({serverAck:true}),true);
 assert.equal(confirmed({serverAck:true,authoritative:null}),true);
});

test('RC2024: non-customer changes do not pass without a server ACK',()=>{
 for(const key of ['shipments','savedShipments','abdRequests','packNotifications','shipmentDocuments','tasks']){
  const stateDelta={[key]:[{id:'REC-1'}]};
  assert.equal(confirmed({serverAck:false,stateDelta}),false,key+' cannot use a customer-only predicate');
 }
 assert.equal(confirmed({serverAck:false,stateDelta:{}}),false);
 assert.equal(confirmed({serverAck:false,stateDelta:{_teamSyncMeta:{tombstones:[{id:'deleted'}]}}}),false);
});

test('RC2024: customer and shipment fallback requires independent complete remote evidence',()=>{
 const stateDelta={customers:[{id:'C1'}],shipments:[{id:'S1'}]};
 assert.equal(confirmed({stateDelta,authoritative:{clientSaveAck:true,
  state:{customers:[{id:'C1'}],shipments:[{id:'S1'}]}}}),false);
 assert.equal(confirmed({stateDelta,authoritative:null}),false);
 assert.equal(confirmed({stateDelta,authoritative:{state:{customers:[{id:'C1'}],shipments:[]}}}),false);
 assert.equal(confirmed({stateDelta,authoritative:{state:{customers:[{id:'C1'}]}}}),false);
 assert.equal(confirmed({stateDelta,authoritative:{state:{customers:[{id:'C1'}],shipments:[{id:'S1'}]}}}),true);
 assert.equal(confirmed({stateDelta:{customers:[{id:'C1'}]},authoritative:{state:{customers:[{id:'C1'}]}}}),true);
});

test('RC2024: customer fallback must independently confirm metadata tombstones and scalar changes',()=>{
 const customers=[{id:'C1'}],shipments=[{id:'S1'}];
 const meta={fields:{},tombstones:[{collection:'shipments',id:'S-DELETED',deletedAt:'2026-11-12T09:00:00Z'}]};
 const stateDelta={customers,shipments,_teamSyncMeta:meta,lastManualSync:'2026-11-12T09:00:00Z'};
 const fullyVerified={customers,shipments,_teamSyncMeta:meta,lastManualSync:stateDelta.lastManualSync};
 for(const state of [
  {customers,shipments},
  {customers,shipments,_teamSyncMeta:{fields:{},tombstones:[]}},
  {customers,shipments,_teamSyncMeta:meta},
  {customers,shipments,_teamSyncMeta:meta,lastManualSync:'stale'}
 ])assert.equal(confirmed({stateDelta,authoritative:{state}}),false,
   'A matching customer and shipment cannot conceal unconfirmed sync metadata or scalar values');
 assert.equal(confirmed({stateDelta,authoritative:{state:fullyVerified}}),true);
 assert.equal(confirmed({serverAck:true,stateDelta,authoritative:null}),true,
   'A separately verified server acknowledgement continues to cover all changed keys');
});

test('RC2024: unconfirmed changes remain dirty and pending for safe retry',()=>{
 assert.match(hardened,/if\(!confirmed\)\{runtime\.dirty=true;runtime\.pendingSave=true;/);
 assert.doesNotMatch(hardened,/if\(!confirmed\)\{rebaseLiveStateFromRemote\(authoritative,baseBefore,currentLive\)/);
 assert.match(hardened,/e\.code='SAVE_NOT_CONFIRMED';throw e/);
 assert.ok(hardened.indexOf('if(!confirmed){')<hardened.indexOf('runtime.lastSavedGeneration=generation;'),
  'local success counters may only advance after positive confirmation');
});

test('RC2024: existing RC1600 shipment guard and RC1627 merge path stay intact',()=>{
 assert.match(afterRc1600,/const confirmed=\(Array\.isArray\(stateDelta\.customers\)/);
 assert.match(hardened,/const confirmed=serverAck\|\|\(/);
 assert.match(hardened,/newerAfterConfirm=newer\|\|Number\(runtime.changeGeneration\|\|0\)>generation/);
 assert.equal(patchRc2024StrictSaveAckHtml(hardened),hardened,'patch is idempotent');
 assert.equal(patchRc1982MetaDeltaHtml(hardened),hardened);
 assert.equal(patchRc2024StrictSaveAckHtml(original),original,'canonical source remains for RC1982 tests');
 const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(build,/patchRc1982MetaDeltaHtml\(rc1718Printed\.replace\(/);
 const patcher=fs.readFileSync('scripts/rc1982-save-meta-delta.mjs','utf8');
 assert.match(patcher,/patchRc2024StrictSaveAckHtml\(html\.replace\(BEFORE,AFTER\)/);
});

test('RC2024: unexpected source drift fails closed, never silently bypasses build patch',()=>{
 const unexpected=afterRc1600.replace(
  'const confirmed=(Array.isArray(stateDelta.customers)&&stateDelta.customers.length>0)?',
  'const confirmed=unverifiedCustomChecker()?'
 );
 assert.throws(()=>patchRc2024StrictSaveAckHtml(unexpected,'TESTVERSION.html'),
  /RC2024 post-RC1600 save confirmation anchor missing or ambiguous/);
 assert.throws(()=>patchRc2024StrictSaveAckHtml('<html>Broken app without saver</html>','index.html'),
  /RC2024 post-RC1600 save confirmation anchor missing or ambiguous/);
 assert.throws(()=>patchRc2024StrictSaveAckHtml('<html>Broken testservice app</html>','TESTVERSION.html'),
  /RC2024 post-RC1600 save confirmation anchor missing or ambiguous/);
 const demo='<html>Demo without authenticated saver</html>';
 assert.equal(patchRc2024StrictSaveAckHtml(demo,'demo.html'),demo);
});
