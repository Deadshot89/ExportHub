import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const flow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1381 blockiert veraltete Workflow-Runs vor TESTSERVICE und Produktion',()=>{
  assert.match(flow,/RC1381 TESTSERVICE stale-deploy guard/);
  assert.match(flow,/RC1381 PRODUCTION stale-deploy guard/);
  const guards=(flow.match(/git ls-remote origin refs\/heads\/main/g)||[]).length;
  assert.equal(guards,2,'Stale-Guard muss direkt vor beiden Deployments greifen');
  const checks=(flow.match(/\[ "\$remote_sha" != "\$GITHUB_SHA" \]/g)||[]).length;
  assert.equal(checks,2,'Jeder Deploy muss GITHUB_SHA gegen den aktuellen main-Head prüfen');

  const testGuard=flow.indexOf('RC1381 TESTSERVICE stale-deploy guard');
  const testDeploy=flow.indexOf('Deploy ExportHUB TESTSERVICE');
  const prodGuard=flow.indexOf('RC1381 PRODUCTION stale-deploy guard');
  const prodDeploy=flow.indexOf('Deploy ExportHUB production');
  assert.ok(testGuard>=0&&testDeploy>testGuard,'TESTSERVICE-Guard muss vor dem Deploy stehen');
  assert.ok(prodGuard>=0&&prodDeploy>prodGuard,'Produktions-Guard muss vor dem Deploy stehen');
});
