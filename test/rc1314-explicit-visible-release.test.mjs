import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const markerPath='release-version.json';
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const spec=fs.readFileSync('e2e/specs/version-display.spec.mjs','utf8');
const probe=fs.readFileSync('production-version.js','utf8');
const workflow=fs.readFileSync('.github/workflows/rc1193-visible-version-pr.yml','utf8');
const deployWorkflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1314: sichtbare Produktversion besitzt eine explizite autoritative Quelle',()=>{
  assert.equal(fs.existsSync(markerPath),true,'release-version.json fehlt');
  const marker=JSON.parse(fs.readFileSync(markerPath,'utf8'));
  assert.match(String(marker.visibleRelease||''),/^RC\d+$/);
  assert.equal(marker.visibleRelease,'RC1312');
  assert.equal(marker.technicalBuild,'RC1112');
});

test('RC1314: Builder leitet sichtbare Version nicht mehr aus Commit-Titeln ab',()=>{
  assert.match(builder,/release-version\.json/);
  assert.doesNotMatch(builder,/git',['"]log['"]/);
  assert.doesNotMatch(builder,/--pretty=%s/);
  assert.match(builder,/EXPORTHUB_VISIBLE_RELEASE_VERSION/);
});

test('RC1314: Browser-Gate erwartet denselben expliziten Release-Marker',()=>{
  assert.match(spec,/release-version\.json/);
  assert.doesNotMatch(spec,/git',['"]log['"]/);
  assert.doesNotMatch(spec,/--pretty=%s/);
});

test('RC1314: production-version.js ist nur technischer RC1112-Probe-Marker',()=>{
  assert.match(probe,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1112'/);
  assert.doesNotMatch(probe,/autoritative Quelle für die in ExportHUB angezeigte Release-Version/);
});

test('RC1314: Release-Marker löst den Visible-Version-Browser-Gate samt Vertrag aus',()=>{
  assert.match(workflow,/release-version\.json/);
  assert.match(workflow,/test\/rc1314-explicit-visible-release\.test\.mjs/);
  assert.match(workflow,/node --test test\/rc1193-visible-release-version\.test\.mjs test\/rc1314-explicit-visible-release\.test\.mjs/);
});

test('RC1314: sichtbarer Release-Marker löst den Drei-Umgebungen-Deploy aus',()=>{
  assert.match(deployWorkflow,/push:[\s\S]*paths:[\s\S]*release-version\.json/);
});
