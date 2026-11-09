import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');
const spec=fs.readFileSync('e2e/specs/rc1570-tasks-focus-production.spec.mjs','utf8');

test('RC1570 production workflow enforces live, exact SHA and read-only browser smoke',()=>{
  const begin=workflow.indexOf('      - name: RC1570 Aufgabenansicht Production Read-only Liveprüfung');
  const after=workflow.indexOf('      - name: RC1530 Dashboard-Personalisierung Production-Liveprüfung',begin);
  assert.ok(begin>=0&&after>begin,'Dedicated RC1570 gate must precede next production check');
  const block=workflow.slice(begin,after);
  assert.match(block,/id: rc1570_tasks_focus_production/);
  assert.match(block,/EXPORTHUB_E2E_LIVE: '1'/);
  assert.match(block,/EXPORTHUB_E2E_PUBLIC_ENV: production/);
  assert.match(block,/source_spec='e2e\/specs\/rc1570-tasks-focus-production\.spec\.mjs'/);
  assert.match(block,/git show "\$GITHUB_SHA:\$source_spec" > "\$gate_spec"/);
  assert.match(block,/npx playwright test "\$gate_spec" --project=laptop/);
  assert.doesNotMatch(block,/\bcurl\b|\bPOST\b|\bPUT\b|\bPATCH\b|\bDELETE\b/);
});

test('RC1570 browser smoke uses only public source GETs and an isolated about:blank fixture',()=>{
  assert.match(spec,/request\.get\('\/assets\/i18n\/rc1570-tasks-focus\.js/);
  assert.match(spec,/request\.get\('\/assets\/rc1570-tasks-focus\.js/);
  assert.match(spec,/await page\.goto\('about:blank'\)/);
  assert.match(spec,/window\.__EXPORTHUB_GET_STATE__=\(\)=>state/);
  assert.match(spec,/window\.fetch=function\(\)\{network\.push\('fetch'\)/);
  assert.match(spec,/await api\._deleteManagedTask\('rc1570-manual-late'\)/);
  assert.match(spec,/expect\(result\.network\)\.toEqual\(\[\]\)/);
  assert.doesNotMatch(spec,/page\.goto\(['"]https:|page\.request\.(?:post|put|patch|delete)\(/i);
});

test('RC1570 failed production browser check saves diagnosis but never weakens deployment gates',()=>{
  const begin=workflow.indexOf('      - name: RC1570 Aufgabenansicht Production Browser-Artefakte');
  const end=workflow.indexOf('      - name: RC1530 Dashboard Production Browser-Artefakte',begin);
  assert.ok(begin>=0&&end>begin);
  const block=workflow.slice(begin,end);
  assert.match(block,/failure\(\) && steps\.rc1570_tasks_focus_production\.outcome == 'failure'/);
  assert.match(block,/actions\/upload-artifact@v7/);
  assert.match(block,/retention-days: 14/);
  assert.match(workflow,/RC1381 PRODUCTION stale-deploy guard/);
  assert.match(workflow,/RC1553 PRODUCTION deployment identity prüfen/);
});
