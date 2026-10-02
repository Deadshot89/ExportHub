import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const flow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1396 blockiert nur neuere deploy-relevante Änderungen vor TESTSERVICE und Produktion',()=>{
  assert.match(flow,/RC1381 TESTSERVICE stale-deploy guard/);
  assert.match(flow,/RC1381 PRODUCTION stale-deploy guard/);
  assert.equal((flow.match(/git ls-remote origin refs\/heads\/main/g)||[]).length,2);
  assert.equal((flow.match(/git diff --name-only "\$GITHUB_SHA" "\$remote_sha"/g)||[]).length,2);
  assert.equal((flow.match(/RC1396: neuerer main-Head enthält nur nicht-deploy-relevante Änderungen/g)||[]).length,2);
  assert.equal((flow.match(/\.github\/workflows\/azure-static-web-apps-wonderful-forest-0f315e310\\\.yml\$/g)||[]).length,2);
  assert.equal((flow.match(/\.github\/rc\[0-9\]\+\//g)||[]).length,2);
  assert.doesNotMatch(flow,/\[ -z "\$remote_sha" \] \|\| \[ "\$remote_sha" != "\$GITHUB_SHA" \]/);

  const testGuard=flow.indexOf('RC1381 TESTSERVICE stale-deploy guard');
  const testDeploy=flow.indexOf('Deploy ExportHUB TESTSERVICE');
  const prodGuard=flow.indexOf('RC1381 PRODUCTION stale-deploy guard');
  const prodDeploy=flow.indexOf('Deploy ExportHUB production');
  assert.ok(testGuard>=0&&testDeploy>testGuard,'TESTSERVICE-Guard muss vor dem Deploy stehen');
  assert.ok(prodGuard>=0&&prodDeploy>prodGuard,'Produktions-Guard muss vor dem Deploy stehen');
});
