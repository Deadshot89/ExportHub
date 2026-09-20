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
  assert.match(workflow,/@playwright\/test@1\.55\.0/);
  assert.match(workflow,/npx playwright install --with-deps chromium/);
  assert.match(workflow,/npx playwright test e2e\/specs\/navigation\.spec\.mjs/);
  assert.doesNotMatch(workflow,/Azure\/static-web-apps-deploy|deployment_token|Deploy ExportHUB/i);
});
