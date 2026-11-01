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

test('RC1718: älteren main-Commit vor Release und unmittelbar vor Azure-Upload blockieren',()=>{
  const flow=read(productionPath);
  const first=flow.slice(
    flow.indexOf('RC1505 Release-SHA und main-Herkunft verifizieren'),
    flow.indexOf('RC1505 Erfolgreiche Main Verification für Release-SHA verlangen')
  );
  const beforeDeploy=flow.slice(
    flow.indexOf('RC1381 PRODUCTION stale-deploy guard'),
    flow.indexOf('RC1505 SHA unmittelbar vor Production-Upload erneut prüfen')
  );
  assert.ok(first.length>0&&beforeDeploy.length>0,'beide Guards müssen existieren');
  for (const block of [first,beforeDeploy]) {
    assert.match(block,/git fetch --no-tags origin main/,'main vor der SHA-Prüfung aktualisieren');
    assert.match(block,/latest_main_sha="\$\(git rev-parse FETCH_HEAD\)"/,'exakten Remote-main-HEAD bestimmen');
    assert.match(block,/if \[ "\$RELEASE_SHA" != "\$latest_main_sha" \]; then/,'ältere release_sha ablehnen');
    assert.match(block,/exit 1/,'bei veralteter Freigabe ohne Upload abbrechen');
  }
  assert.match(beforeDeploy,/RC1718 Stale Deploy verhindert/);
  assert.ok(flow.indexOf('RC1381 PRODUCTION stale-deploy guard')<flow.indexOf('Deploy ExportHUB production'));
  assert.match(flow,/PRODUCTION FREIGEBEN/,'manuelle Production-Freigabe bleibt Pflicht');
});
