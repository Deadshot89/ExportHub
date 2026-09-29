import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const specPath='e2e/specs/multi-truck-live.spec.mjs';
const workflowPath='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const spec=fs.readFileSync(specPath,'utf8');
const workflow=fs.readFileSync(workflowPath,'utf8');
const loaderAdmin=fs.readFileSync('api/loader-pins-admin/index.js','utf8');
const loaderPins=fs.readFileSync('api/shared/loader-pin-store.js','utf8');
const pickupConfirm=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');

test('RC1320: Mehr-LKW-Live-E2E ist syntaktisch gültig und mutierend',()=>{
  execFileSync(process.execPath,['--check',specPath],{stdio:'pipe'});
  assert.match(spec,/EXPORTHUB_E2E_MUTATION/);
  assert.match(spec,/70 Euro-Paletten/);
  assert.match(spec,/rc1017-qr-subshipment/);
  assert.match(spec,/rc1017-print-subshipment/);
  assert.match(spec,/rc1017-stow-subshipment/);
  assert.match(spec,/\/api\/loader-pins-admin/);
  assert.match(spec,/\/pickup\.html\?token=/);
  assert.match(spec,/Teilweise abgeholt/);
  assert.match(spec,/toBe\('Abgeholt'\)/);
});

test('RC1320: TESTSERVICE-Release-Gate führt den vollständigen Mehr-LKW-Test aus',()=>{
  const start=workflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate');
  const end=workflow.indexOf('- name: Deploy ExportHUB production',start);
  assert.ok(start>=0&&end>start,'TESTSERVICE Browser Gate fehlt');
  const gate=workflow.slice(start,end);
  assert.match(gate,/e2e\/specs\/multi-truck-live\.spec\.mjs/);
  assert.match(gate,/EXPORTHUB_E2E_MUTATION='1'/);
});


test('RC1338 P0: TESTSERVICE-E2E-Adminsession liest Verlader-PIN-Rechte aus dem isolierten Test-Team-State',()=>{
  assert.match(loaderAdmin,/const TEST_TEAM_BLOB = process\.env\.EXPORTHUB_TEST_STORAGE_BLOB/);
  assert.match(loaderAdmin,/lower\(signed\.environment\) === 'testservice'/);
  assert.match(loaderAdmin,/\^E2E-USER-/);
  assert.match(loaderAdmin,/\^e2e\\\./);
  assert.match(loaderAdmin,/const teamBlobName = testserviceE2E \? TEST_TEAM_BLOB : TEAM_BLOB/);
  assert.match(loaderAdmin,/getBlockBlobClient\(teamBlobName\)/);
  assert.doesNotMatch(loaderAdmin,/x-exporthub-environment[^\n]{0,120}\?\s*TEST_TEAM_BLOB/,'Ein bloßer Header darf niemals Produktions-Adminrechte in den Test-Team-State umleiten');
});


test('RC1339 P0: TESTSERVICE-Verlader-PINs bleiben vollständig von Produktion getrennt',()=>{
  assert.match(loaderPins,/const TEST_BLOB_NAME = process\.env\.EXPORTHUB_TEST_LOADER_PIN_BLOB/);
  assert.match(loaderPins,/function blobNameForEnvironment\(value\)[\s\S]*TEST_BLOB_NAME[\s\S]*BLOB_NAME/);
  assert.match(loaderPins,/function initialRecords\(targetEnvironment\)[\s\S]*testservice' \? \[\] : envDefaults\(\)\.map\(makeRecord\)/);
  assert.match(loaderAdmin,/const environment = testserviceE2E \? 'testservice' : auditStore\.environmentFromRequest\(req\)/);
  assert.match(loaderAdmin,/pins\.list\(environment\)/);
  assert.match(loaderAdmin,/pins\.create\(payload, environment\)/);
  assert.match(loaderAdmin,/pins\.update\(payload, environment\)/);
  assert.match(loaderAdmin,/pins\.toggle\(payload, environment\)/);
  assert.match(loaderAdmin,/pins\.remove\(payload, environment\)/);
  assert.match(loaderAdmin,/auditStore\.mutateTeamForEnvironment\(environment/);
  assert.match(pickupConfirm,/pins\.findByPin\(personalPin,resolved\.environment\)/);
});

test('RC1339 P0: geänderte PIN- und Pickup-Dateien bleiben syntaktisch gültig',()=>{
  for(const file of ['api/shared/loader-pin-store.js','api/loader-pins-admin/index.js','api/pickup-confirm-v2/index.js']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
