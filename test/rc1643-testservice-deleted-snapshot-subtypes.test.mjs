import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {collectTestserviceTeamInventory}=require('../api/shared/testservice-team-inventory.js');

test('RC1643: deleted snapshots share the deleted parent kind without double counting',async()=>{
 const rows=[
  {name:'testservice/team-state.json',snapshot:'2026-10-22T11:00:00Z',deleted:true,properties:{contentLength:90}},
  {name:'testservice/team-state.json',deleted:true,properties:{contentLength:70}},
  {name:'testservice/team-state.json',snapshot:'2026-10-21T10:00:00Z',properties:{contentLength:80}},
  {name:'testservice/team-state.json',properties:{contentLength:100}}
 ];
 const container={async *listBlobsFlat(options){
  assert.equal(options.prefix,'testservice/');
  assert.equal(options.includeSnapshots,true);assert.equal(options.includeDeleted,true);
  for(const x of rows)yield x;
 }};
 const r=await collectTestserviceTeamInventory(container,{
  teamBlobName:'testservice/team-state.json',referenceTime:Date.parse('2026-10-23T12:00:00Z')
 });
 assert.equal(r.records,4);
 assert.equal(r.logicalBytes,340);
 assert.equal(r.teamState.kinds.deleted.records,2);
 assert.equal(r.teamState.kinds.deleted.logicalBytes,160);
 assert.deepEqual(r.teamState.deletedMarkers,{
  snapshotMarked:{records:1,logicalBytes:90},
  withoutSnapshotMarker:{records:1,logicalBytes:70}
 });
 assert.equal(r.teamState.kinds.snapshot.records,1);
 assert.equal(r.teamState.kinds.snapshot.logicalBytes,80);
 assert.equal(r.teamState.deletedAgeVerifiable,false);
 assert.equal(r.billingVerified,false);
});
test('RC1643: signed workflow prints only fixed categories; never raw metadata or invites deletion',()=>{
 const src=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
 const read=src.indexOf('fixture inventory-team'),report=src.indexOf('RC1643 TESTSERVICE-Teamdatei-SoftDelete-Typ');
 const mutation=src.indexOf('prepared="$(fixture prepare)"');
 assert.ok(read>=0&&report>read&&mutation>report);
 const snippet=src.slice(report-750,report+510);
 assert.match(snippet,/snapshotMarked/);
 assert.match(snippet,/withoutSnapshotMarker/);
 assert.match(snippet,/t\.kinds\.deleted\.records/);
 assert.match(snippet,/t\.kinds\.deleted\.logicalBytes/);
 assert.match(snippet,/deletedAgeVerifiable:false/);
 assert.match(snippet,/retentionChangeApproved:false/);
 assert.doesNotMatch(snippet,/JSON\.stringify\(v\)|\.delete\(|\.upload\(/);
});
