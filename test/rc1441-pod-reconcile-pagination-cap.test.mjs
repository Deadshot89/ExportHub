import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');

test('RC1441: POD-Reconcile kann mehr als die bisherige 500-State-Grenze vollständig scannen',()=>{
  assert.equal((workflow.match(/for batch in \$\(seq 1 200\); do/g)||[]).length,2);
  assert.equal((workflow.match(/scanPageSize:10/g)||[]).length,2);
  assert.equal((workflow.match(/Backlog nach 200 Batches noch nicht vollständig geleert/g)||[]).length,2);
  assert.doesNotMatch(workflow,/seq 1 50/);
});

test('RC1441/RC1442: ein wirklich festhängender Continuation-Token beendet den Reconcile fail-closed',()=>{
  assert.equal((workflow.match(/previous_continuation_token="\$continuation_token"/g)||[]).length,2);
  assert.equal((workflow.match(/progress_count=/g)||[]).length,2);
  assert.equal((workflow.match(/Continuation-Token bewegt sich ohne Fortschritt nicht weiter/g)||[]).length,2);
  assert.equal((workflow.match(/\[ "\$progress_count" -le 0 \]/g)||[]).length,2);
  assert.equal((workflow.match(/exit 9/g)||[]).length,2);
});
