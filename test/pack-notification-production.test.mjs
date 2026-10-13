import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const verification=fs.readFileSync('.github/workflows/packmeldungen-production.yml','utf8');
const production=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');

test('RC1505: standalone pack workflow is verification-only and never auto-deploys production',()=>{
  assert.match(verification,/workflow_dispatch:/);
  assert.doesNotMatch(verification,/workflow_run:/);
  assert.doesNotMatch(verification,/Deploy ExportHUB production/);
  assert.doesNotMatch(verification,/Azure\/static-web-apps-deploy/);
  assert.doesNotMatch(verification,/AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_FOREST_0F315E310/);
});

test('RC1505: SHA-pinned Production Release builds and packages Packmeldungen',()=>{
  assert.match(production,/\.github\/packmeldungen\/build-three-env\.mjs/);
  assert.match(production,/dist-rc1112\/pack\.html/);
  assert.match(production,/pack-notification-nav\.js\?v=1/);
  assert.match(production,/\.rc1112_production_app/);
  assert.match(production,/AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_FOREST_0F315E310/);
  assert.match(production,/api_location: api/);
});

test('RC1505: Production Release verifies public pack page after the single production upload',()=>{
  assert.match(production,/\/pack\/production-smoke/);
  assert.match(production,/Packmeldung/);
  assert.match(production,/RC1505 Production-Basisprüfung erfolgreich/);
});
