import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const HELPER='api/shared/rc1453-mail-contamination-cleanup.js';
const API='api/rc1453-mail-cleanup/index.js';
const FUNCTION='api/rc1453-mail-cleanup/function.json';
const WORKFLOW='.github/workflows/rc1453-mail-cleanup.yml';

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

test('RC1453: dedicated API is production-only, OIDC-protected, backed up, ETag guarded and verifies both refs after write',()=>{
  assert.ok(fs.existsSync(API),'RC1453 API is missing');
  assert.ok(fs.existsSync(FUNCTION),'RC1453 function binding is missing');
  const src=fs.readFileSync(API,'utf8');
  assert.match(src,/githubOidcAuthorized/);
  assert.match(src,/rc1453-mail-cleanup\.yml/);
  assert.match(src,/refs\/heads\/main/);
  assert.match(src,/environment!=='production'/);
  assert.match(src,/createVerifiedBackup/);
  assert.match(src,/conditions:\{ifMatch:etag\}/);
  assert.match(src,/cleanHistoricMailDescriptions/);
  assert.match(src,/inspectHistoricMailDescriptions/);
  assert.match(src,/MAIL_CLEANUP_VERIFY_FAILED/);
  assert.match(src,/7YJUPL/);
  assert.match(src,/4UXU92/);
});

test('RC1453: production workflow runs only after successful main deploy and fails unless both references are verified clean',()=>{
  assert.ok(fs.existsSync(WORKFLOW),'RC1453 production workflow is missing');
  const workflow=fs.readFileSync(WORKFLOW,'utf8');
  assert.match(workflow,/workflow_run:/);
  assert.match(workflow,/ExportHUB RC1112 Drei-Umgebungen Deploy/);
  assert.match(workflow,/id-token: write/);
  assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow,/github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(workflow,/audience=exporthub-rc1453-mail-cleanup/);
  assert.match(workflow,/\/api\/rc1453-mail-cleanup/);
  assert.match(workflow,/7YJUPL/);
  assert.match(workflow,/4UXU92/);
  assert.match(workflow,/contaminatedFields/);
  assert.match(workflow,/backupVerified/);
  assert.match(workflow,/verified/);
});
