import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/packmeldungen-production.yml','utf8');

test('pack production deploy runs only after successful main release or explicit dispatch',()=>{
  assert.match(workflow,/workflow_run:/);
  assert.match(workflow,/ExportHUB RC1112 Drei-Umgebungen Deploy/);
  assert.match(workflow,/workflow_run\.conclusion == 'success'/);
  assert.match(workflow,/workflow_run\.head_branch == 'main'/);
  assert.match(workflow,/workflow_dispatch:/);
});

test('pack production deploy uses tested pack build and production deployment token',()=>{
  assert.match(workflow,/\.github\/packmeldungen\/build-three-env\.mjs/);
  assert.match(workflow,/\.packmeldungen_production_app/);
  assert.match(workflow,/AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_FOREST_0F315E310/);
  assert.match(workflow,/api_location: api/);
  assert.match(workflow,/cp dist-rc1112\/pack\.html/);
});

test('pack production deploy verifies internal runtime and public pack page live',()=>{
  assert.match(workflow,/pack-notification-nav\.js\?v=1/);
  assert.match(workflow,/pack-notification-internal\.js\?v=1/);
  assert.match(workflow,/\/pack\/production-smoke/);
  assert.match(workflow,/Packmeldungen Production erfolgreich live verifiziert/);
});
