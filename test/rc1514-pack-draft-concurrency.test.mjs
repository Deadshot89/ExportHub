import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('api/pack-notification/index.js','utf8');

test('RC1514: Pack state mutations use the hardened conditional-write retry contract',()=>{
  assert.match(source,/const MAX_RETRIES=12/);
  assert.match(source,/const CONFLICT_BACKOFF_BASE_MS=12/);
  assert.match(source,/function sleep\(ms\)/);
  assert.match(source,/function isStorageWriteConflict\(e\)/);
  assert.match(source,/status===409\|\|status===412/);
  assert.match(source,/ConditionNotMet\|PreconditionFailed\|BlobAlreadyExists/);
  assert.match(source,/if\(isStorageWriteConflict\(e\)\)/);
  assert.match(source,/if\(attempt<MAX_RETRIES-1\)\{await sleep/);
  assert.match(source,/throw error\('PACK_CONCURRENT_UPDATE'/);
});
