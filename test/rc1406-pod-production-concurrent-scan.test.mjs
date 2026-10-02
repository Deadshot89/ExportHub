import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('api/shared/pod-archive.js', 'utf8');

test('RC1406: POD-Reconcile liest Pickup-Records begrenzt parallel', () => {
  assert.match(source, /async function readReconcileRecords\(/);
  assert.match(source, /const concurrency = 12;/);
  assert.match(source, /await Promise\.all\(batch\.map\(async item =>/);
  assert.match(source, /const recordScan = await readReconcileRecords\(clients, prefix\);/);
});

test('RC1406: Reconcile verwendet vorgelesenen accessKey statt veraltetem match', () => {
  const start = source.indexOf('async function reconcilePendingBackups');
  const end = source.indexOf('\nmodule.exports =', start);
  assert.ok(start >= 0 && end > start);
  const reconcile = source.slice(start, end);
  assert.doesNotMatch(reconcile, /match\[1\]\.toLowerCase\(\)/);
  assert.match(reconcile, /const accessKey = scannedRecord\.accessKey;/);
  assert.match(reconcile, /checkAzureArchive\(clients, record, accessKey, true\)/);
  assert.match(reconcile, /persistBackupState\(accessKey, environment/);
});
