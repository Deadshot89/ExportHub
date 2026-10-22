import test from 'node:test';
import assert from 'node:assert/strict';
import {SCOPES,validateConfiguration,assertAccount,collectScope,collectAll,ageBucket} from '../scripts/testservice-expanded-storage-inventory.mjs';

function env() {
  const out={};
  for(const scope of SCOPES) {
    out[scope.credential]='placeholder-read-only-secret';
    if(scope.accountEnv)out[scope.accountEnv]='verifiedaccount';
  }
  return out;
}
const blob=(name,contentLength,extra={})=>({name,properties:{contentLength},...extra});
function containerFor(scope,entries) {
  return {listBlobsFlat(options){
    assert.ok(scope.prefixes.includes(options.prefix));
    assert.equal(options.includeSnapshots,true);
    assert.equal(options.includeVersions,true);
    assert.equal(options.includeDeleted,true);
    return (async function*(){for(const item of entries.filter(x=>x.name.startsWith(options.prefix)))yield item;})();
  }};
}
test('requires all six independently supplied read/list credentials before Azure reads',()=>{
  const config=validateConfiguration(env());
  assert.equal(config.length,6);
  assert.equal(config[0].account,'exporthubtestde89');
  for(const scope of SCOPES) {
    const missing=env();delete missing[scope.credential];
    assert.throws(()=>validateConfiguration(missing),/MISSING_DEDICATED_CREDENTIAL/);
    if(scope.accountEnv){
      const missingAccount=env();delete missingAccount[scope.accountEnv];
      assert.throws(()=>validateConfiguration(missingAccount),/MISSING_CONFIRMED_ACCOUNT/);
    }
  }
});
test('all credentials must point to their explicitly confirmed HTTPS Azure account',()=>{
  assert.doesNotThrow(()=>assertAccount({url:'https://verifiedaccount.blob.core.windows.net'},'verifiedaccount'));
  for(const url of ['http://verifiedaccount.blob.core.windows.net','https://other.blob.core.windows.net','https://verifiedaccount.blob.core.windows.net.evil.invalid','invalid']) {
    assert.throws(()=>assertAccount({url},'verifiedaccount'),/WRONG_ACCOUNT/);
  }
});
test('all six inventory scopes include delivery docs, pickup, POD, ABD and backups, excluding production',async()=>{
  const data={
    team:[blob('testservice/team-state.json',15)],
    documents:[blob('rc1059/testservice/ab/aabb',40),blob('testservice/TEST01/Containerdokumentation/01.jpg',5)],
    pickup:[blob('rc995/testservice/records/token.json',20)],
    pod:[blob('rc995/testservice/token/automatic/example.pdf',30)],
    'abd-quarantine':[blob('rc1294/testservice/scope/file.pdf',15)],
    'pod-backup':[blob('rc1220/testservice/token/archive.pdf',50)]
  };
  const report=await collectAll(async scope=>containerFor(scope,data[scope.id]||[]));
  assert.equal(report.complete,true);
  assert.equal(report.scopes.length,6);
  assert.equal(report.logicalBytes,175);
  assert.equal(report.records,7);
  assert.equal(report.billingVerified,false);
  assert.equal(report.sharedProductionDependenciesResolved,false);
  assert.equal(report.scopes[1].prefixes['testservice/'].logicalBytes,5);
  assert.ok(!JSON.stringify(report).includes('token.json'));
  assert.ok(!JSON.stringify(report).includes('TEST01'));
});
test('rejects incorrect prefixes and missing sizes rather than reporting partial totals',async()=>{
  const scope=SCOPES[0];
  await assert.rejects(collectScope({listBlobsFlat(){return (async function*(){yield blob('team-state.json',40)})();}},scope),/OUT_OF_SCOPE/);
  await assert.rejects(collectScope(containerFor(scope,[blob('testservice/a',undefined)]),scope),/INVALID_SIZE/);
});
test('missing a known scope cannot be presented as a complete inventory',async()=>{
  await assert.rejects(collectAll(async()=>({}),SCOPES.slice(0,-1)),/INVENTORY_SCOPE_INCOMPLETE/);
});

test('classifies age from Azure lastModified without revealing names or recommending deletion',async()=>{
  const asOf='2026-10-22T12:00:00Z';
  const scope=SCOPES[0];
  const rows=[
    blob('testservice/current.json',10,{properties:{contentLength:10,lastModified:new Date('2026-10-21T12:00:00Z')}}),
    blob('testservice/month-old.json',20,{properties:{contentLength:20,lastModified:new Date('2026-09-01T12:00:00Z')}}),
    blob('testservice/old-version.json',30,{versionId:'v1',properties:{contentLength:30,lastModified:new Date('2026-01-01T00:00:00Z')}}),
    blob('testservice/unknown.json',40,{properties:{contentLength:40}})
  ];
  const report=await collectAll(async listedScope=>containerFor(listedScope,listedScope===scope?rows:[]),SCOPES,{asOf});
  const bucket=report.scopes[0].ageBuckets;
  assert.equal(bucket.last30Days.logicalBytes,10);
  assert.equal(bucket.days31To90.logicalBytes,20);
  assert.equal(bucket.olderThan90Days.logicalBytes,30);
  assert.equal(bucket.unknown.logicalBytes,40);
  assert.equal(report.liveLogicalBytes,70);
  assert.equal(report.historicalLogicalBytes,30);
  assert.equal(report.ageBuckets.olderThan90Days.records,1);
  assert.ok(report.caveats.some(x=>x.includes('must NOT be deleted')));
  assert.ok(!JSON.stringify(report).includes('current.json'));
  assert.ok(!JSON.stringify(report).includes('old-version.json'));
});
test('rejects invalid reference date and classifies missing or future lastModified as unknown',async()=>{
  assert.equal(ageBucket(undefined,'2026-10-22T12:00:00Z'),'unknown');
  assert.equal(ageBucket('2027-01-01','2026-10-22T12:00:00Z'),'unknown');
  assert.throws(()=>ageBucket(new Date(),'not-a-date'),/INVALID_AS_OF/);
  await assert.rejects(collectAll(async()=>{throw Error('must not fetch')},SCOPES,{asOf:'nonsense'}),/INVALID_AS_OF/);
});
