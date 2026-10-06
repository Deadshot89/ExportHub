import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const HELPER='api/shared/rc1453-mail-contamination-cleanup.js';
const MAINTENANCE='api/state-maintenance/index.js';
const WORKFLOW='.github/workflows/rc1137-state-compaction.yml';

function mail(){
  return 'Sehr geehrte Damen und Herren\n\nLIEFERAVIS\nFür diese Sendung steht Ihnen unser digitales Lieferavis zur Verfügung.\nhttps://exporthub360.com/avis/ABC123\n\nMit freundlichen Grüßen';
}

test('RC1453: helper exists and cleans only mail contamination for 7YJUPL and 4UXU92 across shipment collections',()=>{
  assert.ok(fs.existsSync(HELPER),'RC1453 cleanup helper is missing');
  const {TARGET_REFS,inspectHistoricMailDescriptions,cleanHistoricMailDescriptions}=require('../'+HELPER);
  assert.deepEqual([...TARGET_REFS],['7YJUPL','4UXU92']);
  const team={state:{
    shipments:[
      {ref:'7YJUPL',goodsDescription:mail(),description:mail(),warenbeschreibung:'Kunststoffteile'},
      {ref:'SAFE01',goodsDescription:'Legitime Warenbeschreibung'}
    ],
    savedShipments:[{reference:'4UXU92',goodsDescription:mail()}],
    salesSharedShipments:[{referenceNumber:'7YJUPL',description:mail()}],
    sharedShipments:[],
    shipmentArchive:[{shipmentRef:'4UXU92',warenbeschreibung:mail()}],
    archivedShipments:[],
    archive:[]
  }};
  const before=inspectHistoricMailDescriptions(team);
  assert.equal(before.targets['7YJUPL'].found,true);
  assert.equal(before.targets['4UXU92'].found,true);
  assert.ok(before.targets['7YJUPL'].contaminatedFields>=3);
  assert.ok(before.targets['4UXU92'].contaminatedFields>=2);

  const result=cleanHistoricMailDescriptions(team,{at:'2026-10-06T10:00:00.000Z',actor:'RC1453 GitHub Workflow'});
  assert.equal(result.changed,true);
  assert.ok(result.clearedFields>=5);
  assert.equal(team.state.shipments[0].goodsDescription,'');
  assert.equal(team.state.shipments[0].description,'');
  assert.equal(team.state.shipments[0].warenbeschreibung,'Kunststoffteile','legitimate non-mail text must survive');
  assert.equal(team.state.shipments[1].goodsDescription,'Legitime Warenbeschreibung','unrelated shipment must survive');
  assert.equal(team.state.savedShipments[0].goodsDescription,'');
  assert.equal(team.state.shipmentArchive[0].warenbeschreibung,'');

  const after=inspectHistoricMailDescriptions(team);
  assert.equal(after.targets['7YJUPL'].contaminatedFields,0);
  assert.equal(after.targets['4UXU92'].contaminatedFields,0);
});

test('RC1453: maintenance API exposes production-only verified cleanup with backup and ETag write',()=>{
  const src=fs.readFileSync(MAINTENANCE,'utf8');
  assert.match(src,/cleanup-mail-contamination-7yjupl-4uxu92/);
  assert.match(src,/cleanupHistoricMailContamination/);
  assert.match(src,/createVerifiedBackup\(/);
  assert.match(src,/uploadTeam\(blob,working,currentRead\.etag\)/);
  assert.match(src,/MAIL_CLEANUP_VERIFY_FAILED/);
  assert.match(src,/environment!=='production'/);
});

test('RC1453: production maintenance workflow executes cleanup and requires both references verified clean',()=>{
  const workflow=fs.readFileSync(WORKFLOW,'utf8');
  assert.match(workflow,/cleanup-mail-contamination-7yjupl-4uxu92/);
  assert.match(workflow,/7YJUPL/);
  assert.match(workflow,/4UXU92/);
  assert.match(workflow,/contaminatedFields/);
  assert.match(workflow,/backupVerified/);
  assert.match(workflow,/verified/);
});
