'use strict';

import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=fs.readFileSync('api/exporthub-state/index.js','utf8');

test('P0: Azure conditional-write variants are classified as conflicts',()=>{
  assert.match(source,/function isStorageWriteConflict\\(e\\)/);
  assert.match(source,/status===409\\|\\|status===412/);
  assert.match(source,/ConditionNotMet\\|PreconditionFailed\\|BlobAlreadyExists/);
  assert.match(source,/condition specified using HTTP conditional header\\|precondition failed/);
});

test('P0: exhausted conditional-write retries return CONCURRENT_UPDATE, not raw Azure 412',()=>{
  const start=source.indexOf('async function saveMerged(');
  const end=source.indexOf('/* RC614:',start);
  assert.ok(start>=0&&end>start);
  const save=source.slice(start,end);
  assert.match(save,/if\\(isStorageWriteConflict\\(e\\)\\)/);
  assert.match(save,/if\\(attempt<MAX_RETRIES-1\\)continue/);
  assert.match(save,/throw error\\('CONCURRENT_UPDATE','api\\.state\\.concurrentSaveFailed',409/);
});
