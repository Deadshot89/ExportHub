import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowPath='.github/workflows/exporthub-production-release.yml';
const workflow=fs.readFileSync(workflowPath,'utf8');
const productionSpecPath='e2e/specs/taskplanner-v2-production.spec.mjs';
const productionSpec=fs.readFileSync(productionSpecPath,'utf8');

function stepBlock(name,nextName){
  const start=workflow.indexOf(`      - name: ${name}`);
  assert.notEqual(start,-1,`${name} fehlt im Production-Release`);
  const next=nextName?workflow.indexOf(`      - name: ${nextName}`,start+1):-1;
  return workflow.slice(start,next>start?next:workflow.length);
}

test('RC1547: Production Release enthält dedizierte TaskPlanner-V2 Read-only Liveprüfung',()=>{
  const block=stepBlock(
    'RC1547 TaskPlanner V2 Production Read-only Liveprüfung',
    'RC1530 Dashboard-Personalisierung Production-Liveprüfung'
  );
  assert.match(block,/id:\s*rc1547_taskplanner_v2_production/);
  assert.match(block,/EXPORTHUB_E2E_LIVE:\s*'1'/);
  assert.match(block,/EXPORTHUB_E2E_BASE_URL:\s*https:\/\/wonderful-forest-0f315e310\.7\.azurestaticapps\.net/);
  assert.match(block,/EXPORTHUB_E2E_PUBLIC_ENV:\s*production/);
  assert.match(block,/npx playwright test ['"]?\$gate_spec['"]? --project=laptop/);
});

test('RC1547: TaskPlanner-Production-Smoke bleibt explizit read-only',()=>{
  const block=stepBlock(
    'RC1547 TaskPlanner V2 Production Read-only Liveprüfung',
    'RC1530 Dashboard-Personalisierung Production-Liveprüfung'
  );
  assert.doesNotMatch(block,/taskplanner-v2-(?:mutation|write|migration|rehearsal)/i);
  assert.doesNotMatch(block,/POST|PUT|PATCH|DELETE/);
});

test('RC1547: eigener Browser-Artefakt-Schritt sichert Fehlnachweis',()=>{
  const block=stepBlock('RC1547 TaskPlanner V2 Production Browser-Artefakte','RC1530 Dashboard Production Browser-Artefakte');
  assert.match(block,/failure\(\).*steps\.rc1547_taskplanner_v2_production\.outcome == 'failure'/);
  assert.match(block,/name:\s*rc1547-taskplanner-production-\$\{\{ inputs\.release_sha \}\}/);
  assert.match(block,/test-results/);
  assert.match(block,/playwright-report/);
});

test('RC1547: Live-Gate-Spec kommt aus dem Workflow-SHA statt aus einem älteren Release-Snapshot',()=>{
  const block=stepBlock(
    'RC1547 TaskPlanner V2 Production Read-only Liveprüfung',
    'RC1530 Dashboard-Personalisierung Production-Liveprüfung'
  );
  assert.match(block,/source_spec=['"]e2e\/specs\/taskplanner-v2-production\.spec\.mjs['"]/);
  assert.match(block,/gate_spec=['"]e2e\/specs\/rc1547-workflow-production\.spec\.mjs['"]/);
  assert.match(block,/git show ['"]?\$GITHUB_SHA:\$source_spec['"]? > ['"]?\$gate_spec['"]?/);
  assert.match(block,/npx playwright test ['"]?\$gate_spec['"]? --project=laptop/);
});

test('RC1547: Production-Smoke zählt genau die Task-Karte und nicht Button/Detail mit gleicher data-task-id',()=>{
  assert.match(
    productionSpec,
    /taskCount:list\.querySelectorAll\(['"]\.tpv2-task-card\[data-task-id=[\\"']rc1547-prod-smoke[\\"']\]['"]\)\.length/,
    'taskCount muss auf .tpv2-task-card eingeschränkt sein'
  );
  assert.doesNotMatch(
    productionSpec,
    /taskCount:list\.querySelectorAll\(['"]\[data-task-id=/,
    'generischer data-task-id-Selector zählt Karte und Öffnen-Button doppelt'
  );
});
