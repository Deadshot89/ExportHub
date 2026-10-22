import test from 'node:test';
import assert from 'node:assert/strict';
import { collectInventory } from '../scripts/testservice-storage-inventory.mjs';

function container(items, fail=false) {
  return { listBlobsFlat(options) {
    assert.deepEqual(options,{prefix:'testservice/',includeSnapshots:true,includeVersions:true,includeDeleted:true});
    return (async function*(){for(const item of items) yield item; if(fail) throw new Error('denied');})();
  }};
}
const blob=(name,size,extra={})=>({name,properties:{contentLength:size},...extra});
test('includes live blobs, snapshots, versions and deleted records without treating logical bytes as a bill',async()=>{
  const report=await collectInventory(container([
    blob('testservice/team-state.json',20),
    blob('testservice/team-state.json',10,{snapshot:'s1'}),
    blob('testservice/team-state.json',15,{versionId:'v1'}),
    blob('testservice/state-backups/daily/a.json',30),
    blob('testservice/old.json',5,{deleted:true}),
  ]));
  assert.equal(report.complete,true);
  assert.equal(report.records,5);
  assert.equal(report.logicalBytes,80);
  assert.equal(report.kinds.snapshot.records,1);
  assert.equal(report.kinds.version.records,1);
  assert.equal(report.kinds.deleted.records,1);
  assert.equal(report.areas['state-backups'].logicalBytes,30);
  assert.equal(report.billingVerified,false);
  assert.equal(report.archiveVerified,false);
});
test('rejects production records returned unexpectedly',async()=>{
  await assert.rejects(collectInventory(container([blob('team-state.json',20)])),/OUT_OF_SCOPE/);
});
test('does not silently count missing sizes as zero',async()=>{
  await assert.rejects(collectInventory(container([{name:'testservice/a',properties:{}}])),/INVALID_SIZE/);
});
test('fails instead of reporting a partial inventory as complete',async()=>{
  await assert.rejects(collectInventory(container([blob('testservice/a',20)],true)),/denied/);
});
test('rejects unsafe and negative byte counts',async()=>{
  for(const size of [-1,1.5,Number.MAX_SAFE_INTEGER+1])
    await assert.rejects(collectInventory(container([blob('testservice/a',size)])),/INVALID_SIZE/);
});
test('detects total overflow',async()=>{
  await assert.rejects(collectInventory(container([blob('testservice/a',Number.MAX_SAFE_INTEGER),blob('testservice/b',1)])),/SIZE_OVERFLOW/);
});
