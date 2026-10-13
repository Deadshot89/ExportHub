import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');

test('RC1506: Live-Browser wartet auf stabilen TESTSERVICE-State bevor die UI als bereit gilt',()=>{
  assert.match(helper,/async function waitForLiveStateReady\(page\)/);
  assert.match(helper,/\/api\/exporthub-state\?mode=health/);
  assert.match(helper,/page\.request\.get\(/);
  assert.match(helper,/await waitForLiveStateReady\(page\);/);
});
