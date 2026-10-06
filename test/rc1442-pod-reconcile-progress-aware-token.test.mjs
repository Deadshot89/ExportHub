import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');
const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');

test('RC1442: absichtlich wiederholter Token bleibt bei nachweisbarem Fortschritt erlaubt',()=>{
  assert.match(archive,/if \(!reference && requiredWorkDeferred\) \{\s*nextContinuationToken = continuationToken;\s*scanComplete = false;/s);
  assert.equal((workflow.match(/progress_count=/g)||[]).length,2);
  assert.equal((workflow.match(/integrityChecks/g)||[]).length>=4,true);
  assert.equal((workflow.match(/repairedStateCount/g)||[]).length>=4,true);
  assert.equal((workflow.match(/savedCount/g)||[]).length>=4,true);
  assert.equal((workflow.match(/teamRelinkedCount/g)||[]).length>=2,true);
  assert.equal((workflow.match(/teamRelinkSkippedCount/g)||[]).length>=2,true);
});

test('RC1442: gleicher nicht-leerer Token bricht nur ohne Fortschritt fail-closed ab',()=>{
  assert.equal((workflow.match(/\[ "\$progress_count" -le 0 \]/g)||[]).length,2);
  assert.equal((workflow.match(/Continuation-Token bewegt sich ohne Fortschritt nicht weiter/g)||[]).length,2);
  assert.doesNotMatch(workflow,/\[ "\$continuation_token" = "\$previous_continuation_token" \]; then\s*echo '[^']*Continuation-Token bewegt sich nicht weiter/s);
  assert.equal((workflow.match(/exit 9/g)||[]).length,2);
});
