import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { isTransientStorageWriteError } = require('../api/shared/state-save-retry.js');

function productionUploadJson() {
  const source = readFileSync(new URL('../api/exporthub-state/index.js', import.meta.url), 'utf8');
  const begin = source.indexOf('async function uploadJson(');
  const end = source.indexOf('function isStorageWriteConflict(', begin);
  assert.ok(begin >= 0 && end > begin);
  return new Function('Buffer', source.slice(begin, end) + ';return uploadJson;')(Buffer);
}

test('P0 #1159: Azure PUT without ETag cannot claim state save success', async () => {
  const uploadJson = productionUploadJson();
  const calls = [];
  const data = {schemaVersion:3, revision:23, state:{shipments:[{ref:'ABC123'}]}};
  const blob = {upload:async (raw, bytes, opts) => {
    calls.push({bytes, opts, raw});
    return {lastModified:'2026-11-04T08:00:00Z'}; // HTTP transport completed but ETag absent
  }};
  await assert.rejects(uploadJson(blob, data, '"previous-etag"'), error =>
    error.code === 'STORAGE_WRITE_ACK_UNVERIFIED' &&
    error.status === 503 &&
    isTransientStorageWriteError(error) === true);
  assert.equal(calls.length, 1, 'must not repeat the ambiguous upload inside uploadJson');
  assert.equal(calls[0].opts.conditions.ifMatch, '"previous-etag"');
  assert.deepEqual(JSON.parse(calls[0].raw.toString('utf8')), data);
});

test('P0 #1159: explicit metadata fallback also refuses a missing Azure ETag', async () => {
  const calls = [];
  const blob = {upload:async (_raw,_bytes,opts) => {
    calls.push(opts);
    if(calls.length === 1) throw Object.assign(new Error('InvalidMetadata'),{statusCode:400,code:'InvalidMetadata'});
    return {lastModified:'2026-11-04T08:00:00Z'};
  }};
  await assert.rejects(productionUploadJson()(blob,{schemaVersion:3,revision:24,state:{}},'"previous"'),
    error => error.code === 'STORAGE_WRITE_ACK_UNVERIFIED');
  assert.equal(calls.length,2,'metadata fallback may happen only for an explicit metadata error');
  assert.equal(calls[0].conditions.ifMatch,'"previous"');
  assert.equal(calls[1].conditions.ifMatch,'"previous"');
  assert.ok(calls[0].metadata);
  assert.equal(calls[1].metadata,undefined);
});

test('P0 #1159: valid Azure ETag still permits conditional write acknowledgment', async () => {
  const sent = [];
  const result = await productionUploadJson()({upload:async (raw,bytes,opts) => {
    sent.push({raw,bytes,opts});
    return {etag:'"new-etag"'};
  }},{schemaVersion:3,revision:25,state:{}},'"old-etag"');
  assert.equal(result.etag,'"new-etag"');
  assert.equal(sent.length,1);
  assert.equal(sent[0].opts.conditions.ifMatch,'"old-etag"');
  assert.equal(sent[0].opts.metadata.revision,'25');
});

test('P0 #1159: missing ETag preserves bounded authoritative re-read, not blind retries', () => {
  const source = readFileSync(new URL('../api/exporthub-state/index.js', import.meta.url), 'utf8');
  assert.match(source,/if\(attempt>0\)\{const retryStarted=Date\.now\(\);d=await readJson\(blob,emptyTeam\(\)\)/);
  assert.match(source,/operationId&&recentOperations\.some/);
  assert.match(source,/ifMatch:etag/);
  assert.match(source,/if\(bytes>=16\*1024\*1024\)base\.transportAttempts=1/);
  assert.match(source,/transientSaveRetries<MAX_TRANSIENT_SAVE_RETRIES/);
});
