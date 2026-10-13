'use strict';

import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=fs.readFileSync('api/pack-notification/index.js','utf8');

test('RC1499: pack writes survive sustained Azure ETag contention instead of leaking raw 412',()=>{
  assert.match(source,/const MAX_RETRIES=12;/);
  assert.match(source,/const CONFLICT_BACKOFF_BASE_MS=12;/);
  assert.match(source,/function sleep\(ms\)/);
  assert.match(source,/function isStorageWriteConflict\(e\)/);
  assert.match(source,/status===409\|\|status===412/);
  assert.match(source,/ConditionNotMet\|PreconditionFailed\|BlobAlreadyExists/);

  const start=source.indexOf('function defaultMutateState()');
  const end=source.indexOf('function validateSessionForStation',start);
  assert.ok(start>=0&&end>start,'defaultMutateState must remain inspectable');
  const mutate=source.slice(start,end);
  assert.match(mutate,/if\(isStorageWriteConflict\(e\)\)/);
  assert.match(mutate,/if\(attempt<MAX_RETRIES-1\)\{await sleep\(Math\.min\(250,CONFLICT_BACKOFF_BASE_MS\*Math\.pow\(2,Math\.min\(attempt,4\)\)\)\);continue;\}/);
  assert.match(mutate,/throw error\('PACK_CONCURRENT_UPDATE','Packmeldung konnte wegen paralleler Änderungen nicht gespeichert werden\.',409\);/);
});
