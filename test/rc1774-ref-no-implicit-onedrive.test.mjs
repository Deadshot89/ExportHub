import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const moduleId = require.resolve('../api/shared/reference-folder-upload.js');
const envKeys = [
  'EXPORTHUB_GRAPH_TENANT_ID', 'EXPORTHUB_GRAPH_CLIENT_ID', 'EXPORTHUB_GRAPH_CLIENT_SECRET',
  'EXPORTHUB_REFERENCE_DRIVE_USER', 'EXPORTHUB_POD_DRIVE_USER',
  'EXPORTHUB_REFERENCE_DRIVE_ID', 'EXPORTHUB_REFERENCE_FOLDER_ID',
  'EXPORTHUB_TEST_REFERENCE_DRIVE_ID', 'EXPORTHUB_TEST_REFERENCE_FOLDER_ID'
];

test('RC1774: REF must not use an implicit personal OneDrive user; absent destination fails closed', async () => {
  const previous = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
  const oldFetch = globalThis.fetch;
  let networkCalls = 0;
  try {
    for (const key of envKeys) delete process.env[key];
    process.env.EXPORTHUB_GRAPH_TENANT_ID = 'synthetic-tenant';
    process.env.EXPORTHUB_GRAPH_CLIENT_ID = 'synthetic-client';
    process.env.EXPORTHUB_GRAPH_CLIENT_SECRET = 'synthetic-secret';
    // POD credentials alone may never enable REF access at module initialization.
    process.env.EXPORTHUB_POD_DRIVE_USER = 'synthetic-pod@example.invalid';
    delete require.cache[moduleId];
    const ref = require(moduleId);
    globalThis.fetch = async () => { networkCalls++; throw Error('no Graph request without explicit target'); };

    assert.equal(ref.DRIVE_USER, '', 'no personal account may be selected implicitly');
    assert.throws(() => ref.config(), e => e.code === 'GRAPH_NOT_CONFIGURED' && e.status === 503);
    await assert.rejects(ref.getFolder('ABC123'), e => e.code === 'GRAPH_NOT_CONFIGURED' && e.status === 503);
    await assert.rejects(ref.listFiles('ABC123'), e => e.code === 'GRAPH_NOT_CONFIGURED' && e.status === 503);
    assert.equal(networkCalls, 0, 'a missing destination must not query or mutate Graph');

    // Explicitly reject the POD-only fallback when REF IDs and user are absent.
    assert.equal(ref.DRIVE_USER, '', 'POD user is not an authorized REF identity');
    assert.throws(() => ref.config(), e => e.code === 'GRAPH_NOT_CONFIGURED');
    await assert.rejects(ref.getFolder('ABC123'), e => e.code === 'GRAPH_NOT_CONFIGURED');
    assert.equal(networkCalls, 0, 'POD-only configuration must not contact Graph for REF');

    process.env.EXPORTHUB_REFERENCE_DRIVE_ID = 'prod-sharepoint-library';
    process.env.EXPORTHUB_REFERENCE_FOLDER_ID = 'prod-sendungen-root';
    assert.deepEqual(ref.config(), {
      tenant: 'synthetic-tenant', clientId: 'synthetic-client', secret: 'synthetic-secret'
    }, 'an exact SharePoint target must work without any user-drive identity');

    assert.throws(() => ref.config('testservice'),
      e => e.code === 'GRAPH_TEST_REFERENCE_TARGET_NOT_CONFIGURED');
    process.env.EXPORTHUB_TEST_REFERENCE_DRIVE_ID = 'prod-sharepoint-library';
    process.env.EXPORTHUB_TEST_REFERENCE_FOLDER_ID = 'prod-sendungen-root';
    assert.throws(() => ref.config('testservice'),
      e => e.code === 'GRAPH_TEST_REFERENCE_TARGET_NOT_ISOLATED');
    process.env.EXPORTHUB_TEST_REFERENCE_DRIVE_ID = 'test-sharepoint-library';
    process.env.EXPORTHUB_TEST_REFERENCE_FOLDER_ID = 'test-sendungen-root';
    assert.equal(ref.config('testservice').clientId, 'synthetic-client');
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    delete require.cache[moduleId];
  }
});

test('RC1774: AV file endpoint validates environment-specific exact IDs without a legacy user', () => {
  const shared = readFileSync(new URL('../api/shared/reference-folder-upload.js', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../api/reference-files/index.js', import.meta.url), 'utf8');
  for (const source of [shared, api]) {
    assert.doesNotMatch(source, /tobiaslimberg@essentra\.com/i,
      'no personal account belongs in a source-code fallback');
    assert.match(source, /const DRIVE_USER=\(process\.env\.EXPORTHUB_REFERENCE_DRIVE_USER\|\|''\)\.trim\(\)/);
  }
  assert.match(api, /function graphConfig\(environment='production'\)\{const target=referenceFolder\.exactTarget\(environment\)/);
  assert.match(api, /async function graphToken\(environment='production'\)\{const c=graphConfig\(environment\)/);
  assert.match(api, /graphFetch\(url,undefined,environment\)/);
  assert.match(api, /graphFetch\(url,\{headers:\{Accept:'\*\/\*'\}\},env\)/);
  assert.match(shared, /const c=config\(environment\);[\s\S]*?if\(tokenCache/);
});

test('RC1774: vanished REF child folder fails closed instead of returning partial documents', async () => {
  const vm = await import('node:vm');
  const source = readFileSync(new URL('../api/reference-files/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function listFiles(ref,req){');
  const end = source.indexOf('\nfunction disposition(', start);
  assert.ok(start > 0 && end > start, 'use the real REF listFiles implementation');
  const functionText = source.slice(start, end).trim();

  function prepare(graphFetch) {
    return vm.runInNewContext('(' + functionText + ')', {
      GRAPH_BASE: 'https://graph.example.invalid/v1.0',
      DRIVE_USER: 'synthetic-ref@example.invalid',
      publicAccess: { environment: () => 'production' },
      referenceFolder: { exactTarget: () => null },
      folderPath: ref => 'REF/' + ref,
      encPath: path => path,
      text: value => String(value == null ? '' : value).trim(),
      apiI18n: { t: () => 'Dokument' },
      error: (code, message, status) => Object.assign(new Error(message), { code, status }),
      graphFetch
    });
  }
  function response(status, body) {
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  }
  function expectIncomplete(error) {
    return error.code === 'GRAPH_REFERENCE_FOLDER_LIST_INCOMPLETE' && error.status === 503;
  }

  const childMissing = prepare(async url => url.includes('/items/folder-1/children')
    ? response(404, { error: { code: 'itemNotFound' } })
    : response(200, { value: [{ id: 'folder-1', folder: {} }] }));
  await assert.rejects(childMissing('ABC123', {}), expectIncomplete);

  let page = 0;
  const secondPageMissing = prepare(async () => ++page === 1
    ? response(200, { value: [], '@odata.nextLink': 'https://graph.example.invalid/next' })
    : response(404, { error: { code: 'itemNotFound' } }));
  await assert.rejects(secondPageMissing('ABC123', {}), expectIncomplete);

  const malformedListing = prepare(async () => response(200, { unexpected: 'no value array' }));
  await assert.rejects(malformedListing('ABC123', {}),
    error => error.code === 'GRAPH_REFERENCE_FOLDER_LIST_INVALID');

  const invalidFile = prepare(async () => response(200, { value: [{ name: 'invoice.pdf', file: {} }] }));
  await assert.rejects(invalidFile('ABC123', {}),
    error => error.code === 'GRAPH_REFERENCE_FOLDER_LIST_INVALID');
});
