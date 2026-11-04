import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { RestBlobClient } from '../api/shared/blob-rest.js';

const require = createRequire(import.meta.url);
const { isTransientStorageWriteError } = require('../api/shared/state-save-retry.js');

const TEMPORARY_UNDICI = [
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
  'EPIPE'
];

test('P0 #1159: Node fetch / Undici temporary network errors permit only guarded save retry', () => {
  for (const code of TEMPORARY_UNDICI) {
    const wrapped = new TypeError('fetch failed', { cause: Object.assign(new Error('network interruption'), {code}) });
    assert.equal(isTransientStorageWriteError(wrapped), true, code + ' through cause');
    assert.equal(isTransientStorageWriteError(Object.assign(new Error('network interruption'), {code})), true, code + ' directly');
  }
});

test('P0 #1159: hard Azure failures and invalid requests never become retryable', () => {
  for (const statusCode of [400, 401, 403, 409, 412]) {
    const err = Object.assign(new Error('no retry'), {
      statusCode,
      cause: Object.assign(new Error('network interruption'), {code: 'UND_ERR_SOCKET'})
    });
    assert.equal(isTransientStorageWriteError(err), false, 'HTTP ' + statusCode + ' must fail closed');
  }
  for (const code of ['UND_ERR_INVALID_ARG', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_SSL_WRONG_VERSION_NUMBER']) {
    assert.equal(isTransientStorageWriteError(new TypeError('fetch failed', {cause: Object.assign(new Error('invalid'), {code})})), false,
      'permanent or unknown error ' + code);
  }
  assert.equal(isTransientStorageWriteError(new TypeError('fetch failed')), false,
    'generic fetch failed has no trustworthy transient classification');
});

test('P0 #1159: an ambiguous Undici PUT error propagates after exactly one transport request', async () => {
  const original = globalThis.fetch;
  const networkError = new TypeError('fetch failed', {
    cause: Object.assign(new Error('socket closed during Azure PUT'), {code: 'UND_ERR_SOCKET'})
  });
  let requests = 0;
  globalThis.fetch = async () => {requests++; throw networkError;};
  try {
    const blob = new RestBlobClient({sas:'sig=synthetic',endpoint:'https://blob.example.invalid'}, 'synthetic', 'team-state.json');
    await assert.rejects(blob.upload(Buffer.from('synthetic'), 9, {transportAttempts:1}),
      err => err === networkError && isTransientStorageWriteError(err));
    assert.equal(requests, 1, 'never blindly send a second ambiguous PUT at the transport layer');
  } finally {
    globalThis.fetch = original;
  }
});

test('P0 #1159: saveMerged retains bounded authoritative re-read and ETag/operationId guard', () => {
  const source = readFileSync(new URL('../api/exporthub-state/index.js', import.meta.url), 'utf8');
  assert.match(source, /if\(bytes>=16\*1024\*1024\)base\.transportAttempts=1/);
  assert.match(source, /if\(attempt>0\)\{const retryStarted=Date\.now\(\);d=await readJson\(blob,emptyTeam\(\)\)/);
  assert.match(source, /operationId&&recentOperations\.some/);
  assert.match(source, /ifMatch:etag/);
  assert.match(source, /isTransientStorageWriteError\(e\)/);
  assert.match(source, /transientSaveRetries<MAX_TRANSIENT_SAVE_RETRIES/);
});
