import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {collectTestserviceTeamInventory,MAX_RECORDS}=require('../api/shared/testservice-team-inventory.js');
const {parseListXml}=require('../api/shared/blob-rest.js');

function row(name,contentLength,extras={}){
 return{name,properties:{contentLength},...extras};
}
function container(items,options={}){
 const got=[];
 return{
  got,
  async *listBlobsFlat(request){
   got.push(request);
   for(const item of items){
    if(options.ignorePrefix||item.name.startsWith(request.prefix))yield item;
   }
  }
 };
}

test('RC1627: current versionId stays live, old versions, snapshots, deleted separate; no names in report',async()=>{
 const rows=[
  row('testservice/team-state.json',80,{versionId:'v3',isCurrentVersion:true}),
  row('testservice/team-state.json',70,{versionId:'v2',isCurrentVersion:false}),
  row('testservice/team-state.json',60,{versionId:'v1'}),
  row('testservice/team-state.json',50,{snapshot:'2026-10-21T00:00:00Z'}),
  row('testservice/deleted.json',40,{deleted:true}),
  row('testservice/plain.json',30),
  row('exporthub-state.json',1000000)
 ];
 const c=container(rows),r=await collectTestserviceTeamInventory(c);
 assert.equal(r.complete,true);
 assert.equal(r.environment,'testservice');
 assert.equal(r.scope,'team-prefix');
 assert.deepEqual({r:r.records,b:r.logicalBytes,live:r.liveLogicalBytes,history:r.historicalLogicalBytes},
  {r:6,b:330,live:110,history:220});
 assert.deepEqual(Object.fromEntries(Object.entries(r.kinds).map(([k,v])=>[k,v.logicalBytes])),
  {live:110,version:130,snapshot:50,deleted:40});
 assert.equal(r.billingVerified,false);
 assert.equal(r.archiveVerified,false);
 assert.equal(r.sharedProductionDependenciesResolved,false);
 assert.deepEqual(c.got,[{prefix:'testservice/',includeVersions:true,includeSnapshots:true,includeDeleted:true}]);
 assert.ok(!JSON.stringify(r).includes('team-state'));
 assert.ok(!JSON.stringify(r).includes('deleted.json'));
});

test('RC1627: zero-size blobs can be counted, never claim billed size',async()=>{
 const r=await collectTestserviceTeamInventory(container([row('testservice/empty.json',0)]));
 assert.equal(r.logicalBytes,0);
 assert.equal(r.kinds.live.records,1);
 assert.equal(r.billingVerified,false);
});

test('RC1627: unknown size, unsafe integer, and prefix leakage fail closed',async()=>{
 for(const value of [undefined,-1,1.5,Number.MAX_SAFE_INTEGER+1]){
  await assert.rejects(()=>collectTestserviceTeamInventory(container([row('testservice/missing.json',value)])),/INVENTORY_SIZE_UNKNOWN/);
 }
 await assert.rejects(()=>collectTestserviceTeamInventory(container([row('production/team-state.json',30)],{ignorePrefix:true})),/INVENTORY_OUT_OF_SCOPE/);
});

test('RC1627: oversized inventories are rejected, never partial success',async()=>{
 const c={async *listBlobsFlat(){for(let i=0;i<=MAX_RECORDS;i++)yield row('testservice/a',1)}};
 await assert.rejects(()=>collectTestserviceTeamInventory(c),/INVENTORY_INCOMPLETE/);
});

test('RC1627: provider failure cannot be represented as complete report',async()=>{
 const c={async *listBlobsFlat(){yield row('testservice/a',10);throw Error('NETWORK_FAILED')}};
 await assert.rejects(()=>collectTestserviceTeamInventory(c),/NETWORK_FAILED/);
});

test('RC1627: Azure REST XML parser includes sizes and current version flag',()=>{
 const xml='<EnumerationResults><Blobs>'+
  '<Blob><Name>testservice/team.json</Name><VersionId>2026-10-22</VersionId>'+
  '<IsCurrentVersion>true</IsCurrentVersion><Properties><Content-Length>1024</Content-Length>'+
  '<Etag>&quot;x&quot;</Etag></Properties></Blob>'+
  '<Blob><Name>testservice/old.json</Name><Properties><Content-Length>0</Content-Length></Properties></Blob>'+
  '<Blob><Name>testservice/missing.json</Name><Properties></Properties></Blob>'+
  '</Blobs><NextMarker></NextMarker></EnumerationResults>';
 const r=parseListXml(xml);
 assert.equal(r.items.length,3);
 assert.equal(r.items[0].versionId,'2026-10-22');
 assert.equal(r.items[0].isCurrentVersion,true);
 assert.equal(r.items[0].properties.contentLength,1024);
 assert.equal(r.items[1].properties.contentLength,0);
 assert.equal(r.items[2].properties.contentLength,undefined);
});

test('RC1627: OIDC authorization occurs before listing; no full state GET or storage writes for inventory',()=>{
 const src=fs.readFileSync('api/state-maintenance/index.js','utf8');
 const auth=src.indexOf('if(!await githubOidcAuthorized(req))');
 const early=src.indexOf("if(action==='inventory-testservice-team'){");
 const stateDownload=src.indexOf('const currentRead=await readJson(blob)');
 assert.ok(auth>0&&early>auth&&stateDownload>early);
 assert.match(src,/action==='inventory-testservice-team'&&environment!=='testservice'/);
 const section=src.slice(early,stateDownload);
 assert.doesNotMatch(section,/\.upload\(|uploadTeam\(|createVerifiedSnapshot\(|readJson\(/);
 assert.match(section,/collectTestserviceTeamInventory\(container\)/);
});

test('RC1627: runs only inside existing scheduled OIDC backup without new storage credentials',()=>{
 const y=fs.readFileSync('.github/workflows/rc1267-state-backup.yml','utf8');
 assert.match(y,/GITHUB_EVENT_NAME:-}" = "schedule"/);
 assert.match(y,/inventory-testservice-team/);
 assert.match(y,/x-exporthub-github-oidc: \$oidc_token/);
 assert.match(y,/RC1627: Team-Inventur nicht verifiziert/);
 assert.doesNotMatch(y,/EXPORTHUB_TEST_INVENTORY_CONNECTION_STRING/);
});

test('RC1633: group TESTSERVICE storage by fixed backup categories without leaking names',async()=>{
 const inputs=[
  row('testservice/exporthub-state.json',40,{versionId:'v2',isCurrentVersion:true}),
  row('testservice/exporthub-state.json',30,{snapshot:'snapshot-id'}),
  row('testservice/state-backups/daily/2026/10/23/team-state-20261023T010000000Z.json',20),
  row('testservice/state-backups/monthly/2026/10/team-state.json',15),
  row('testservice/state-backups/yearly/2026/team-state.json',10),
  row('testservice/recovery-backups/SENSITIVE_CUSTOMER_REFERENCE.json',8),
  row('testservice/recovery-drills/team-state-restore-drill-latest.json',5),
  row('testservice/other/secret-customer-123.pdf',7,{deleted:true})
 ];
 const result=await collectTestserviceTeamInventory(container(inputs));
 const sizes=Object.fromEntries(Object.entries(result.areas).map(([name,area])=>[name,area.logicalBytes]));
 assert.deepEqual(sizes,{
  'root-files':70,'daily-backups':20,'monthly-backups':15,'yearly-backups':10,
  'recovery-backups':8,'recovery-drills':5,'other':7
 });
 assert.equal(result.logicalBytes,135);
 assert.equal(Object.values(result.areas).reduce((sum,a)=>sum+a.records,0),result.records);
 assert.equal(Object.values(result.areas).reduce((sum,a)=>sum+a.logicalBytes,0),result.logicalBytes);
 assert.equal(result.areas['root-files'].kinds.snapshot.logicalBytes,30);
 assert.equal(result.areas.other.kinds.deleted.logicalBytes,7);
 assert.doesNotMatch(JSON.stringify(result),/SENSITIVE_CUSTOMER_REFERENCE|secret-customer|team-state-20261023/);
 assert.equal(result.billingVerified,false);
 assert.equal(result.archiveVerified,false);
});
test('RC1633: out-of-scope and unknown-size blobs still fail closed before producing area totals',async()=>{
 await assert.rejects(
  ()=>collectTestserviceTeamInventory(container([row('production/state-backups/daily/private',1)],{ignorePrefix:true})),
  /INVENTORY_OUT_OF_SCOPE/
 );
 await assert.rejects(
  ()=>collectTestserviceTeamInventory(container([row('testservice/secret-customer',undefined)])),
  /INVENTORY_SIZE_UNKNOWN/
 );
});


test('RC1638: primary TEAM-state live and historical entries aggregate separately from other root files',async()=>{
 const items=[
  row('testservice/team-state.json',43,{versionId:'v2',isCurrentVersion:true}),
  row('testservice/team-state.json',41,{snapshot:'old'}),
  row('testservice/team-state.json',42,{deleted:true}),
  row('testservice/other-root.json',900,{deleted:true}),
  row('testservice/state-backups/daily/2026/10/23/name.json',8)
 ];
 const r=await collectTestserviceTeamInventory(container(items),{teamBlobName:'testservice/team-state.json'});
 assert.equal(r.teamState.status,'listed');
 assert.equal(r.teamState.records,3);
 assert.equal(r.teamState.logicalBytes,126);
 assert.equal(r.teamState.kinds.live.logicalBytes,43);
 assert.equal(r.teamState.kinds.snapshot.logicalBytes,41);
 assert.equal(r.teamState.kinds.deleted.logicalBytes,42);
 assert.equal(r.areas['root-files'].logicalBytes,1026);
 assert.equal(r.areas['daily-backups'].logicalBytes,8);
 assert.doesNotMatch(JSON.stringify(r),/team-state\.json|other-root\.json|name\.json/);
});
test('RC1638: configured nondefault TEAM blob is matched; invalid or production paths stay unverified',async()=>{
 const items=[row('testservice/custom-state.json',10),row('testservice/team-state.json',999)];
 const list=container(items);
 const good=await collectTestserviceTeamInventory(list,{teamBlobName:'testservice/custom-state.json'});
 assert.equal(good.teamState.status,'listed');
 assert.equal(good.teamState.logicalBytes,10);
 assert.equal(good.teamState.records,1);
 for(const invalid of ['production/team-state.json','testservice/../prod.json','testservice/','testservice/x\ny.json']){
  const bad=await collectTestserviceTeamInventory(container(items),{teamBlobName:invalid});
  assert.equal(bad.teamState.status,'unverified');
  assert.equal(bad.teamState.records,null);
  assert.equal(bad.teamState.logicalBytes,null);
 }
});
