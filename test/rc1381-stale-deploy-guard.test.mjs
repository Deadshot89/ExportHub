import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainPath='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const productionPath='.github/workflows/exporthub-production-release.yml';
const read=p=>fs.readFileSync(p,'utf8');

test('RC1505: Main Verification schützt TESTSERVICE vor stale deploys',()=>{
  const flow=read(mainPath);
  assert.match(flow,/RC1381 TESTSERVICE stale-deploy guard/);
  assert.doesNotMatch(flow,/RC1381 PRODUCTION stale-deploy guard/);
  const testGuard=flow.indexOf('RC1381 TESTSERVICE stale-deploy guard');
  const testDeploy=flow.indexOf('Deploy ExportHUB TESTSERVICE');
  assert.ok(testGuard>=0&&testDeploy>testGuard,'TESTSERVICE-Guard muss vor dem Deploy stehen');
  assert.match(flow,/git ls-remote origin refs\/heads\/main/);
  assert.match(flow,/git diff --name-only "\$GITHUB_SHA" "\$remote_sha"/);
  assert.match(flow,/RC1396: neuerer main-Head enthält nur nicht-deploy-relevante Änderungen/);
});

test('RC1505: Production stale-deploy guard lebt nur im manuellen Production-Release',()=>{
  assert.equal(fs.existsSync(productionPath),true,'Production-Release-Workflow fehlt');
  const flow=read(productionPath);
  assert.match(flow,/RC1381 PRODUCTION stale-deploy guard/);
  assert.match(flow,/release_sha/);
  const prodGuard=flow.indexOf('RC1381 PRODUCTION stale-deploy guard');
  const prodDeploy=flow.indexOf('Deploy ExportHUB production');
  assert.ok(prodGuard>=0&&prodDeploy>prodGuard,'Produktions-Guard muss vor dem Deploy stehen');
});
