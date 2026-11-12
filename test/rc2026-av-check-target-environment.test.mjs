import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('P0 AV Graph readiness uses isolated TESTSERVICE target, never production fallback', async () => {
  const keys = [
    'EXPORTHUB_GRAPH_TENANT_ID', 'EXPORTHUB_GRAPH_CLIENT_ID',
    'EXPORTHUB_GRAPH_CLIENT_SECRET', 'EXPORTHUB_REFERENCE_DRIVE_USER',
    'EXPORTHUB_REFERENCE_DRIVE_ID', 'EXPORTHUB_REFERENCE_FOLDER_ID',
    'EXPORTHUB_TEST_REFERENCE_DRIVE_ID', 'EXPORTHUB_TEST_REFERENCE_FOLDER_ID'
  ];
  const old = new Map(keys.map(key => [key, process.env[key]]));
  const refPath = require.resolve('../api/shared/reference-folder-upload.js');
  const apiPath = require.resolve('../api/av-check/index.js');
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, {
      EXPORTHUB_GRAPH_TENANT_ID: 'synthetic-tenant',
      EXPORTHUB_GRAPH_CLIENT_ID: 'synthetic-client',
      EXPORTHUB_GRAPH_CLIENT_SECRET: 'test',
      EXPORTHUB_TEST_REFERENCE_DRIVE_ID: 'isolated-test-drive',
      EXPORTHUB_TEST_REFERENCE_FOLDER_ID: 'isolated-test-folder'
    });
    delete require.cache[refPath];
    delete require.cache[apiPath];
    const ref = require(refPath);
    assert.throws(() => ref.config(), err => err.code === 'GRAPH_NOT_CONFIGURED',
      'production REF target is deliberately absent');
    assert.doesNotThrow(() => ref.config('testservice'),
      'isolated TESTSERVICE target must be accepted with shared app credentials');
    assert.equal(ref.assertTargetForEnvironment('testservice'), true);

    const api = require(apiPath);
    const state = { shipments: [{
      id: 'synthetic-shipment', ref: 'ABC123',
      abdFiles: [{ id: 'synthetic-abd', name: 'ABD_ABC123.pdf' }],
      status: 'Abgeholt', pickupStatus: 'abgeholt',
      actualPickupDate: '2026-10-13', pickedUpAt: '2026-10-13T09:00:00.000Z'
    }], tasks: [] };
    const graphCalls = [];
    let writes = 0;
    const handler = api.createHandler({
      authorize: async () => true,
      now: () => new Date('2026-11-02T11:00:00.000Z'),
      readState: async () => structuredClone(state),
      mutateState: async (environment, fn) => {
        assert.equal(environment, 'testservice', 'production state must never be mutated');
        const result = fn(state);
        if (result.changed) writes++;
        return result;
      },
      listFiles: async (reference, environment) => {
        graphCalls.push({ reference, environment });
        assert.equal(environment, 'testservice');
        return [{ name: 'AV_ABC123.pdf' }];
      },
      listArchivedFiles: async () => []
    });

    const production = await handler({
      method: 'POST', headers: {},
      body: { environment: 'production', minAgeMinutes: 0 }
    });
    assert.equal(production.status, 503,
      'missing production REF configuration must still fail closed');
    assert.equal(production.body.code, 'GRAPH_NOT_CONFIGURED');
    assert.equal(writes, 0);
    assert.deepEqual(graphCalls, []);

    const testservice = await handler({
      method: 'POST', headers: {},
      body: { environment: 'testservice', minAgeMinutes: 0 }
    });
    assert.equal(testservice.status, 200);
    assert.equal(testservice.body.ok, true);
    assert.equal(testservice.body.graphConfigured, true);
    assert.equal(testservice.body.present, 1);
    assert.deepEqual(graphCalls, [{ reference: 'ABC123', environment: 'testservice' }]);
    assert.equal(writes, 1);
  } finally {
    for (const [key, value] of old) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[apiPath];
    delete require.cache[refPath];
  }
});
