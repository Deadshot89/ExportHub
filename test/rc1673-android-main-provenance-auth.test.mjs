import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/exporthub-android-test-app.yml','utf8');
const provenance=fs.readFileSync('.github/rc1473/verify-main-pr-provenance.mjs','utf8');

test('RC1673: Android main-push release contract can read merged PR provenance without write permission',()=>{
  const permissions=workflow.match(/\npermissions:\n([\s\S]*?)\nconcurrency:/);
  assert.ok(permissions,'Workflow permission contract missing');
  assert.match(permissions[1],/^  contents: read\s*$/m);
  assert.match(permissions[1],/^  pull-requests: read\b/m);
  assert.doesNotMatch(permissions[1],/\bwrite\b/);
  assert.match(workflow,/\n  build:\n    runs-on: ubuntu-latest\n    timeout-minutes: 30\n    env:\n      GITHUB_TOKEN: \$\{\{ github\.event_name == 'push' && github\.token \|\| '' \}\}/);
  assert.match(provenance,/const token=text\(env\.GITHUB_TOKEN\)/);
  assert.match(provenance,/if\(token\)headers\.Authorization=`Bearer \$\{token\}`/);
  assert.match(provenance,/DIRECT_MAIN_PUSH_BLOCKED/);
});
