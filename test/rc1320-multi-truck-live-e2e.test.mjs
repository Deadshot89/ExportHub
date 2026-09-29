import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const specPath='e2e/specs/multi-truck-live.spec.mjs';
const workflowPath='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const spec=fs.readFileSync(specPath,'utf8');
const workflow=fs.readFileSync(workflowPath,'utf8');
const loaderAdmin=fs.readFileSync('api/loader-pins-admin/index.js','utf8');

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
