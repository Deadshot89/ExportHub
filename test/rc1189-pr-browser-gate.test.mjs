import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path='.github/workflows/rc1189-mobile-navigation-pr-browser.yml';

test('RC1189: PR-Änderungen an E2E-Navigation erhalten vor Merge einen echten lokalen Browser-Gate',()=>{
  assert.ok(fs.existsSync(path),'RC1189 PR-Browser-Workflow fehlt');
  const workflow=fs.readFileSync(path,'utf8');
  assert.match(workflow,/pull_request:/);
  assert.match(workflow,/e2e\/\*\*/);
  assert.match(workflow,/test\/rc1189-/);
  assert.match(workflow,/node \.github\/rc1112\/build-three-env\.mjs/);
  assert.match(workflow,/@playwright\/test@1\.63\.0/);
  assert.match(workflow,/npx playwright install --with-deps chromium/);
  assert.match(workflow,/npx playwright test e2e\/specs\/navigation\.spec\.mjs/);
  assert.match(workflow,/navigation\.spec\.mjs e2e\/specs\/notifications\.spec\.mjs e2e\/specs\/public-smoke\.spec\.mjs/);
  assert.doesNotMatch(workflow,/Azure\/static-web-apps-deploy|deployment_token|Deploy ExportHUB/i);
});

// RC1189/RC1592: the full Node regression plus two real browser passes needs a bounded
// end-to-end budget. Keep the final print-signature proof rather than skipping it.
test('RC1189: 45-minute budget still requires Node and final browser print verification',()=>{
  const workflow=fs.readFileSync(path,'utf8');
  assert.match(workflow,/timeout-minutes:\s*45\b/);
  assert.match(workflow,/RC1592 Main-Vertrag vor zweiter Druckprüfung simulieren/);
  assert.match(workflow,/npm test\s*\n\s*node \.github\/rc1112\/build-three-env\.mjs/);
  assert.match(workflow,/RC1592 Print-Signatur nach Main-Vertrag im echten Browser prüfen/);
  assert.match(workflow,/e2e\/specs\/rc1604-pickup-print\.spec\.mjs/);
});
