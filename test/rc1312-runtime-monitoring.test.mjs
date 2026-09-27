import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/rc1050-storage-probe.yml','utf8');

test('RC1312: Runtime-Monitoring läuft stündlich zusätzlich zu Deploy und manuell',()=>{
  assert.match(workflow,/schedule:\s*\n\s*- cron: '17 \* \* \* \*'/);
  assert.match(workflow,/github\.event_name == 'schedule'/);
  assert.match(workflow,/workflow_dispatch/);
  assert.match(workflow,/workflow_run/);
});

test('RC1312: öffentliche Production-Domain, Azure-Origin und TESTSERVICE werden überwacht',()=>{
  assert.match(workflow,/prod='https:\/\/www\.exporthub360\.de'/);
  assert.match(workflow,/azure_prod='https:\/\/wonderful-forest-0f315e310\.7\.azurestaticapps\.net'/);
  assert.match(workflow,/testservice='https:\/\/ashy-grass-065b7b803-testservice\.westeurope\.6\.azurestaticapps\.net'/);
  assert.match(workflow,/check_json "\$azure_prod \/api\/exporthub-health"/);
  assert.match(workflow,/for base in "\$prod" "\$testservice"/);
});

test('RC1312: Runtime-Monitoring prüft API, Auth und Storage-Readiness',()=>{
  assert.match(workflow,/\/api\/exporthub-health/);
  assert.match(workflow,/\/api\/exporthub-auth-probe/);
  assert.match(workflow,/mode=ping/);
  assert.match(workflow,/mode=health/);
  assert.match(workflow,/storageReachable===true/);
  assert.match(workflow,/teamStateReadable===true/);
});
