import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const graph = require('../api/shared/graph-drive.js');
const keys = [
  'EXPORTHUB_GRAPH_TENANT_ID', 'EXPORTHUB_GRAPH_CLIENT_ID', 'EXPORTHUB_GRAPH_CLIENT_SECRET',
  'EXPORTHUB_POD_DRIVE_USER', 'EXPORTHUB_POD_FOLDER',
  'EXPORTHUB_POD_DRIVE_ID', 'EXPORTHUB_POD_FOLDER_ID'
];
function withSettings(overrides, check) {
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, {
      EXPORTHUB_GRAPH_TENANT_ID: 'test-tenant',
      EXPORTHUB_GRAPH_CLIENT_ID: 'test-client',
      EXPORTHUB_GRAPH_CLIENT_SECRET: 'dummy-value-for-readiness-only',
      ...overrides
    });
    return check();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('RC1712: an exact Drive ID and folder ID activate Graph without a user or folder path', () => {
  withSettings({
    EXPORTHUB_POD_DRIVE_ID: 'resolved-drive',
    EXPORTHUB_POD_FOLDER_ID: 'resolved-folder'
  }, () => {
    assert.deepEqual(graph.readiness().missing, []);
    assert.equal(graph.readiness().configured, true);
    const cfg = graph.config();
    assert.equal(cfg.driveId, 'resolved-drive');
    assert.equal(cfg.folderId, 'resolved-folder');
    assert.equal(cfg.user, '');
    assert.equal(cfg.folder, '');
  });
});

test('RC1712: user-path discovery still requires both user and folder when no IDs are set', () => {
  withSettings({}, () => {
    const status = graph.readiness();
    assert.equal(status.configured, false);
    assert.deepEqual(status.missing, ['EXPORTHUB_POD_DRIVE_USER', 'EXPORTHUB_POD_FOLDER']);
    assert.throws(() => graph.config(), error => error.code === 'GRAPH_NOT_CONFIGURED');
  });
  withSettings({
    EXPORTHUB_POD_DRIVE_USER: 'test@example.invalid',
    EXPORTHUB_POD_FOLDER: 'ExportHub/POD'
  }, () => assert.equal(graph.readiness().configured, true));
});

test('RC1712: incomplete ID pair must fail closed even if an unrelated user path exists', () => {
  withSettings({
    EXPORTHUB_POD_DRIVE_USER: 'test@example.invalid',
    EXPORTHUB_POD_FOLDER: 'ExportHub/POD',
    EXPORTHUB_POD_DRIVE_ID: 'drive-only'
  }, () => {
    assert.equal(graph.readiness().configured, false);
    assert.deepEqual(graph.readiness().missing, ['EXPORTHUB_POD_FOLDER_ID']);
  });
  withSettings({
    EXPORTHUB_POD_DRIVE_USER: 'test@example.invalid',
    EXPORTHUB_POD_FOLDER: 'ExportHub/POD',
    EXPORTHUB_POD_FOLDER_ID: 'folder-only'
  }, () => {
    assert.equal(graph.readiness().configured, false);
    assert.deepEqual(graph.readiness().missing, ['EXPORTHUB_POD_DRIVE_ID']);
  });
});

test('RC1712: Graph credentials remain mandatory for both exact IDs and path discovery', () => {
  withSettings({
    EXPORTHUB_GRAPH_CLIENT_SECRET: '',
    EXPORTHUB_POD_DRIVE_ID: 'drive',
    EXPORTHUB_POD_FOLDER_ID: 'folder'
  }, () => {
    assert.equal(graph.readiness().configured, false);
    assert.ok(graph.readiness().missing.includes('EXPORTHUB_GRAPH_CLIENT_SECRET'));
  });
});
