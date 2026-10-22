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
