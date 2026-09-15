import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1124 Playwright release gate files exist',()=>{
  for(const p of [
    'playwright.config.mjs',
    'e2e/helpers/exporthub-browser.mjs',
    'e2e/specs/navigation.spec.mjs',
    'e2e/specs/notifications.spec.mjs',
    'e2e/specs/public-smoke.spec.mjs'
  ]) assert.equal(fs.existsSync(p),true,p+' fehlt');
});

test('RC1124 config contains all five required viewports',()=>{
  const compact=read('playwright.config.mjs').replace(/\s+/g,'');
  for(const size of ['width:360,height:800','width:390,height:844','width:768,height:1024','width:1366,height:768','width:1920,height:1080']){
    assert.ok(compact.includes(size),size+' fehlt');
  }
});

test('RC1124 production deploy is gated by TESTSERVICE browser checks',()=>{
  const wf=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  const testDeploy=wf.indexOf('Deploy ExportHUB TESTSERVICE');
  const browserGate=wf.indexOf('RC1124 TESTSERVICE Browser Gate');
  const prodDeploy=wf.indexOf('Deploy ExportHUB production');
  assert.ok(testDeploy>=0&&browserGate>testDeploy&&prodDeploy>browserGate,'Reihenfolge muss TESTSERVICE -> Browser Gate -> Produktion sein');
  assert.match(wf,/@playwright\/test@1\.55\.0/);
  assert.match(wf,/playwright install --with-deps chromium/);
  assert.match(wf,/'e2e\/\*\*'/);
});

test('RC1124 production smoke stays non-destructive',()=>{
  const smoke=read('e2e/specs/public-smoke.spec.mjs');
  assert.match(smoke,/non-destructive production smoke/i);
  assert.doesNotMatch(smoke,/complete-task|saveShipment|pickup-confirm|action\s*[:=]\s*['"]appointment/i);
});
