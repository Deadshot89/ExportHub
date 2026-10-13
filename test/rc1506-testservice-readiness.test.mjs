import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const config=fs.readFileSync('playwright.config.mjs','utf8');
const setupPath='e2e/helpers/testservice-readiness.mjs';

test('RC1506: TESTSERVICE-Live-Browser startet erst nach stabilem State-Health',()=>{
  assert.equal(fs.existsSync(setupPath),true,'RC1506 Readiness-Setup fehlt');
  const setup=fs.readFileSync(setupPath,'utf8');
  assert.match(config,/globalSetup:\s*['"]\.\/e2e\/helpers\/testservice-readiness\.mjs['"]/);
  assert.match(setup,/EXPORTHUB_E2E_LIVE/);
  assert.match(setup,/EXPORTHUB_E2E_PUBLIC_ENV/);
  assert.match(setup,/testservice/);
  assert.match(setup,/\/api\/exporthub-state\?mode=health/);
  assert.match(setup,/healthy\s*>?=\s*2/);
});
