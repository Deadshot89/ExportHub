import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const storePath = require.resolve('../api/shared/pickup-store.js');
// The receipt predicate is pure; suppress external Azure dependencies in this unit.
require.cache[storePath] = {
  id: storePath, filename: storePath, loaded: true, exports: {}
};
const archive = require('../api/shared/pod-archive.js');

test('RC1683: historic driveSaved without a Graph item ID is not confirmed', () => {
  assert.equal(archive.confirmedDriveBackup({ driveSaved: true, driveItemId: '' }), false);
  assert.equal(archive.confirmedDriveBackup({ driveSaved: true }), false);
  assert.equal(archive.confirmedDriveBackup({ driveSaved: false, driveItemId: 'file-old' }), false);
  assert.equal(archive.confirmedDriveBackup({ driveSaved: true, driveItemId: 'file-stored' }), true);
});

test('RC1683: reconcile requeues uncertain historic copies and never reports them saved', () => {
  const source = fs.readFileSync(new URL('../api/shared/pod-archive.js', import.meta.url), 'utf8');
  assert.match(source, /const driveBackfillRequired = [^\n]*!confirmedDriveBackup\(backup\)/);
  assert.match(source, /const driveWasSaved = confirmedDriveBackup\(backup\)/);
  assert.match(source, /driveSaved: confirmedDriveBackup\(record\.podBackup\)/);
});
